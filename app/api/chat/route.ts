import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const CATEGORIES = ['Bills', 'Loans', 'Subscriptions', 'Family', 'Other'];

interface SnapItem {
  id: string;
  name: string;
  amount: number;
  dueDay: number | null;
  category: string;
  paid: boolean;
  recurring: boolean;
}
interface Snapshot {
  monthKey: string;
  monthLabel: string;
  today: number;
  salary: number;
  items: SnapItem[];
  totals: { total: number; paid: number; left: number; leftOver: number };
}

const tools = [
  {
    name: 'add_item',
    description: 'Add a new outgoing (bill/loan/subscription) to the current month.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        amount: { type: 'number', description: 'Amount in GBP' },
        dueDay: { type: 'integer', description: 'Day of month 1-31, omit if no date' },
        note: { type: 'string' },
        category: { type: 'string', enum: CATEGORIES },
        recurring: { type: 'boolean', description: 'true if it repeats monthly (default true)' },
      },
      required: ['name', 'amount'],
    },
  },
  {
    name: 'update_item',
    description: 'Change fields of an existing outgoing. Reference it by its id.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        amount: { type: 'number' },
        dueDay: { type: 'integer' },
        note: { type: 'string' },
        category: { type: 'string', enum: CATEGORIES },
        recurring: { type: 'boolean' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_item',
    description: 'Remove an outgoing by id.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'set_paid',
    description: 'Mark an outgoing paid or unpaid by id.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' }, paid: { type: 'boolean' } },
      required: ['id', 'paid'],
    },
  },
  {
    name: 'mark_all_paid',
    description: 'Mark every outgoing this month paid (true) or unpaid (false).',
    input_schema: {
      type: 'object',
      properties: { paid: { type: 'boolean' } },
      required: ['paid'],
    },
  },
  {
    name: 'set_salary',
    description: "Set this month's salary/income in GBP.",
    input_schema: {
      type: 'object',
      properties: { amount: { type: 'number' } },
      required: ['amount'],
    },
  },
];

function systemPrompt(snap: Snapshot): string {
  return `You are the assistant built into MoneyFlow, a personal app that tracks monthly outgoings against salary. All amounts are GBP (£).

You can answer questions and give reports directly from the data below, and you can make changes using the provided tools. Only make changes the user clearly asks for. When you change something, do it with a tool AND give a short natural-language confirmation. Keep replies concise and friendly; format money like £1,234.56. Use British spelling.

Today is the ${snap.today}${ordinalSuffix(snap.today)}. Current view: ${snap.monthLabel}.

Current data (JSON):
${JSON.stringify(snap)}

Notes:
- To change or remove an item, use its "id" from the data above.
- Categories must be one of: ${CATEGORIES.join(', ')}.
- "left" is still-to-pay this month; "leftOver" is salary minus total outgoings.
- If a request is ambiguous (e.g. which of two similar items), ask a brief clarifying question instead of guessing.`;
}

function ordinalSuffix(d: number): string {
  const r = d % 100;
  if (r >= 11 && r <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][d % 10] || 'th';
}

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ needsKey: true });

  let body: { messages?: { role: string; content: string }[]; snapshot?: Snapshot };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const messages = (body.messages ?? []).slice(-20);
  const snap = body.snapshot;
  if (!snap || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt(snap),
        tools,
        messages,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: `Assistant error (${res.status})`, detail: detail.slice(0, 300) },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      content: { type: string; text?: string; name?: string; input?: unknown }[];
    };
    let text = '';
    const actions: { name: string; input: Record<string, unknown> }[] = [];
    for (const block of data.content ?? []) {
      if (block.type === 'text' && block.text) text += block.text;
      else if (block.type === 'tool_use' && block.name) {
        actions.push({ name: block.name, input: (block.input as Record<string, unknown>) ?? {} });
      }
    }
    return NextResponse.json({ text: text.trim(), actions });
  } catch {
    return NextResponse.json({ error: 'Could not reach the assistant.' }, { status: 502 });
  }
}

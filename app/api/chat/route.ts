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
  accent: string;
}
interface Snapshot {
  monthKey: string;
  monthLabel: string;
  today: number;
  userName?: string;
  salary: number;
  items: SnapItem[];
  totals: { total: number; paid: number; left: number; leftOver: number };
  /** actual bank spending (read-only), present when a bank is connected */
  spending?: unknown;
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
        accent: {
          type: 'string',
          description: "Icon colour — a name like 'pink'/'blue'/'green' or a #hex value",
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'recolor_items',
    description:
      "Change the icon colour of many outgoings at once. Omit both category and ids to recolour EVERY item (use this for 'all bills'/'all outgoings'). Pass category to recolour just one group, or ids for specific ones.",
    input_schema: {
      type: 'object',
      properties: {
        color: {
          type: 'string',
          description: "Colour name like 'pink'/'blue'/'green'/'purple' or a #hex value",
        },
        category: { type: 'string', enum: CATEGORIES },
        ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['color'],
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

Today is the ${snap.today}${ordinalSuffix(snap.today)}. Current view: ${snap.monthLabel}.${
    snap.userName ? ` The user's name is ${snap.userName} — it's natural to greet them by their first name, especially in short/spoken replies.` : ''
  }
Replies may be read aloud by a voice assistant, so keep them conversational and concise — a sentence or two is ideal unless asked for detail.
The user can attach images, PDFs or text (e.g. a bank/loan statement, a bill letter, a receipt). Read them and answer their question. If a statement shows an outstanding balance, monthly payment, APR or a bill amount, offer to add or update the relevant outgoing using the tools (e.g. add_item), and confirm the exact figures you found.

Current data (JSON):
${JSON.stringify(snap)}

Bank spending:
- If a "spending" section is present, it's the user's REAL bank transactions from Open Banking (read-only) — completely separate from the planned "items"/bills above. Use it to answer any question about actual spending: totals, categories, specific shops/merchants, month-to-month comparisons, "how much did I spend at X", "what's my biggest expense", "where can I cut back", etc.
- In spending, a negative amount is money OUT, positive is money IN. "recentTransactions" is the latest ~120 (for specifics). The summaries cover the WHOLE cached history (usually up to ~12–24 months, see historyFrom/historyTo): "monthlySpend" is total spend per calendar month, "byCategoryAllTime"/"byCategoryThisMonth"/"byCategoryLastMonth" are category totals, "topMerchants" is total per shop, and "thisMonthSpend/lastMonthSpend" are month totals. Use monthlySpend for trends/"last N months", byCategoryAllTime + topMerchants for "how much on X ever", and recentTransactions for individual items.
- "safeToSpend" is what's genuinely left to spend this month (salary − planned bills − day-to-day spend already gone out); "perDay" spreads it over the days to payday. "subscriptions" lists recurring payments detected from repeat charges, with a "monthlyTotal" — use it for "what am I paying for", "which subscriptions could I cut", "how much on subscriptions". "budgets" (present only if the user set any) lists each budgeted category with its monthly "cap" and "spent" so far — flag ones at/over cap.
- The app can AUTO-TICK a planned bill as paid when a matching money-OUT payment appears in the bank feed (an item with "paidTxnId"/"paidOn" set was ticked automatically on the date the payment left). This never happens from income or a due date — only a real outgoing payment. If asked why a bill is ticked, explain that its payment was seen leaving the bank on paidOn.
- You CANNOT edit bank transactions (there are no tools for that) — only report and analyse them. If asked to change a transaction, explain they're read from the bank and can't be edited. (The add/edit tools only affect the planned outgoings.)
- If the user asks about spending but no "spending" section is present, tell them to connect their bank on the Spending tab (or open it once so it loads).

Notes:
- To change or remove an item, use its "id" from the data above.
- Categories must be one of: ${CATEGORIES.join(', ')}.
- Each item has an "accent" — the colour of its round icon. To recolour one item use update_item with "accent"; to recolour many at once use recolor_items. Colours can be plain names (pink, blue, green, purple, yellow, orange, cyan, lime, grey) or a #hex.
- "bills", "outgoings" and "everything" all mean ALL items unless the user names a specific category. So "make all the bill icons pink" = recolor_items with color "pink" and no category.
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

  let body: {
    messages?: { role: string; content: string }[];
    snapshot?: Snapshot;
    attachments?: { kind: string; mediaType?: string; data: string; name?: string }[];
  };
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

  // Attach any images/PDFs/text to the latest user turn as content blocks.
  const apiMessages: { role: string; content: unknown }[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const atts = body.attachments ?? [];
  if (atts.length) {
    const last = apiMessages[apiMessages.length - 1];
    const blocks: unknown[] = [
      { type: 'text', text: typeof last.content === 'string' && last.content ? last.content : 'Please look at the attached file.' },
    ];
    for (const a of atts.slice(0, 5)) {
      if (a.kind === 'image') {
        blocks.push({ type: 'image', source: { type: 'base64', media_type: a.mediaType || 'image/jpeg', data: a.data } });
      } else if (a.kind === 'pdf') {
        blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.data } });
      } else if (a.kind === 'text') {
        blocks.push({ type: 'text', text: `Attached file "${a.name || 'file'}":\n${a.data}` });
      }
    }
    last.content = blocks;
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
        messages: apiMessages,
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

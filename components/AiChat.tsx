'use client';

import { useEffect, useRef, useState } from 'react';
import { computeTotals, useStore } from '@/lib/store';
import { money, monthLabel } from '@/lib/format';
import { HAPTIC } from '@/lib/haptics';
import { ACCENTS, CATEGORIES, type Category } from '@/lib/types';
import { useToast } from './Toast';
import { Close, Mic, Send, Sparkle } from './icons';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const CLOSE_MS = 460;

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'How much am I spending on subscriptions?',
  "What's due in the next 7 days?",
  'How does this month compare to last?',
  'Where could I cut back?',
];

export function AiChat({ onClose }: { onClose: () => void }) {
  const {
    month,
    monthKey,
    addItem,
    updateItem,
    deleteItem,
    setAllPaid,
    setSalary,
    snapshot,
    undo,
  } = useStore();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const timer = useRef<number | null>(null);

  // Voice dictation (Web Speech API — where the browser supports it)
  const recRef = useRef<SpeechRec | null>(null);
  const [listening, setListening] = useState(false);
  const [micOk, setMicOk] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setMicOk(!!SR);
    return () => recRef.current?.stop();
  }, []);

  const toggleMic = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec: SpeechRec = new SR();
    rec.lang = 'en-GB';
    rec.interimResults = true;
    rec.continuous = false;
    const base = input.trim() ? input.trim() + ' ' : '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) t += e.results[i][0].transcript;
      setInput(base + t);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    HAPTIC.light();
    rec.start();
  };

  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    const t = window.setTimeout(() => setOpen(true), 32);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, []);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy]);

  const requestClose = () => {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    timer.current = window.setTimeout(onClose, CLOSE_MS);
  };

  const buildSnapshot = () => {
    const t = computeTotals(month);
    return {
      monthKey,
      monthLabel: monthLabel(monthKey).label,
      today: new Date().getDate(),
      salary: month.salary,
      items: month.items.map((it) => ({
        id: it.id,
        name: it.name,
        amount: it.amount,
        dueDay: it.dueDay,
        category: it.category,
        paid: it.paid,
        recurring: it.recurring,
      })),
      totals: { total: t.total, paid: t.paid, left: t.left, leftOver: t.leftOver },
    };
  };

  const applyActions = (actions: { name: string; input: Record<string, unknown> }[]): number => {
    if (!actions.length) return 0;
    snapshot(); // one-level undo for the whole batch
    for (const a of actions) {
      const inp = a.input;
      const asCat = (c: unknown): Category =>
        CATEGORIES.includes(c as Category) ? (c as Category) : 'Bills';
      switch (a.name) {
        case 'add_item':
          addItem({
            name: String(inp.name || 'Untitled'),
            amount: Number(inp.amount) || 0,
            dueDay: inp.dueDay == null ? null : Number(inp.dueDay),
            note: String(inp.note || ''),
            paid: false,
            accent: ACCENTS[Math.floor(Math.random() * ACCENTS.length)],
            category: asCat(inp.category),
            recurring: inp.recurring !== false,
          });
          break;
        case 'update_item': {
          if (!inp.id) break;
          const patch: Record<string, unknown> = {};
          for (const k of ['name', 'amount', 'dueDay', 'note', 'category', 'recurring']) {
            if (inp[k] !== undefined) patch[k] = k === 'category' ? asCat(inp[k]) : inp[k];
          }
          updateItem(String(inp.id), patch);
          break;
        }
        case 'delete_item':
          if (inp.id) deleteItem(String(inp.id));
          break;
        case 'set_paid':
          if (inp.id) updateItem(String(inp.id), { paid: !!inp.paid });
          break;
        case 'mark_all_paid':
          setAllPaid(!!inp.paid);
          break;
        case 'set_salary':
          setSalary(Number(inp.amount) || 0);
          break;
      }
    }
    return actions.length;
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    HAPTIC.light();
    const next = [...msgs, { role: 'user' as const, content: q }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next, snapshot: buildSnapshot() }),
      });
      const data = await res.json();
      if (data.needsKey) {
        setNeedsKey(true);
        setBusy(false);
        return;
      }
      const applied = applyActions(data.actions ?? []);
      const reply: string =
        data.text || (applied ? `Done — applied ${applied} change${applied === 1 ? '' : 's'}.` : '');
      setMsgs((m) => [...m, { role: 'assistant', content: reply || '…' }]);
      if (applied > 0) {
        HAPTIC.success();
        toast({ message: `${applied} change${applied === 1 ? '' : 's'} applied`, action: { label: 'Undo', run: undo } });
      }
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: 'Sorry — I couldn’t reach the assistant just now.' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="veil" data-on={open} onClick={requestClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="ai-panel"
        data-on={open}
        role="dialog"
        aria-modal="true"
        aria-label="Ask MoneyFlow"
      >
        <div className="ai-head">
          <div className="ai-title">
            <Sparkle size={18} />
            <b>Ask MoneyFlow</b>
          </div>
          <button className="ghost-btn" onClick={requestClose} aria-label="Close">
            <Close size={17} />
          </button>
        </div>

        <div className="ai-thread" ref={threadRef}>
          {msgs.length === 0 && !needsKey && (
            <div className="ai-intro">
              <div className="ai-orb">
                <Sparkle size={26} />
              </div>
              <p>Ask about your money, or tell me to change something.</p>
              <div className="ai-chips">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => void send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {needsKey && (
            <div className="ai-note">
              <b>Almost there</b>
              <p>
                The assistant needs an Anthropic API key. Add <code>ANTHROPIC_API_KEY</code> in your
                Vercel project settings (Environment Variables), then redeploy. It stays server-side
                and is never exposed in the app.
              </p>
            </div>
          )}

          {msgs.map((m, i) => (
            <div key={i} className={`ai-msg ${m.role}`}>
              {m.content}
            </div>
          ))}

          {busy && (
            <div className="ai-msg assistant ai-typing" aria-label="Thinking">
              <i />
              <i />
              <i />
            </div>
          )}
        </div>

        <form
          className="ai-bar"
          onSubmit={(e) => {
            e.preventDefault();
            recRef.current?.stop();
            void send(input);
          }}
        >
          {micOk && (
            <button
              type="button"
              className={`ai-mic${listening ? ' on' : ''}`}
              onClick={toggleMic}
              aria-label={listening ? 'Stop dictation' : 'Speak'}
            >
              <Mic size={18} />
            </button>
          )}
          <input
            className="ai-input"
            value={input}
            placeholder={listening ? 'Listening…' : 'Ask or tell me to change something…'}
            autoComplete="off"
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="ai-send" type="submit" disabled={busy || !input.trim()} aria-label="Send">
            <Send size={18} />
          </button>
        </form>
      </div>
    </>
  );
}

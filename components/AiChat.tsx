'use client';

import { useEffect, useRef, useState } from 'react';
import { computeTotals, useStore } from '@/lib/store';
import { money, monthLabel } from '@/lib/format';
import { daysUntilPayday } from '@/lib/derive';
import { detectRecurring, safeToSpend } from '@/lib/insights';
import { HAPTIC } from '@/lib/haptics';
import { ACCENTS, CATEGORIES, type Category } from '@/lib/types';
import { getCachedTxns } from '@/lib/bankClient';
import { useToast } from './Toast';
import { Close, Mic, Send, Sparkle, Voice } from './icons';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onstart?: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
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

// Render the small bit of markdown the model uses (**bold**); newlines are
// preserved by white-space: pre-wrap on the bubble.
function renderRich(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export function AiChat({ onClose }: { onClose: () => void }) {
  const {
    store,
    month,
    monthKey,
    bank,
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
  // Hands-free voice mode: listen → (auto-stop on silence) → send → speak → listen.
  const [voiceOn, setVoiceOn] = useState(false);
  const [phase, setPhase] = useState<'listening' | 'thinking' | 'speaking' | 'idle'>('listening');
  const voiceRef = useRef(false);
  const silenceRef = useRef<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setMicOk(!!SR);
    return () => {
      voiceRef.current = false;
      recRef.current?.stop();
      try {
        if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    };
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
    endVoice();
    closing.current = true;
    setOpen(false);
    timer.current = window.setTimeout(onClose, CLOSE_MS);
  };

  const buildSnapshot = () => {
    const t = computeTotals(month);
    const snap: Record<string, unknown> = {
      monthKey,
      monthLabel: monthLabel(monthKey).label,
      today: new Date().getDate(),
      userName: store.profile?.name?.trim() || undefined,
      salary: month.salary,
      items: month.items.map((it) => ({
        id: it.id,
        name: it.name,
        amount: it.amount,
        dueDay: it.dueDay,
        category: it.category,
        paid: it.paid,
        recurring: it.recurring,
        accent: it.accent,
      })),
      totals: { total: t.total, paid: t.paid, left: t.left, leftOver: t.leftOver },
    };

    // Real bank spending (read-only) so the AI can answer spending questions.
    if (bank) {
      const cached = getCachedTxns();
      const all = (cached?.txns ?? []).filter((x) => bank.selected.includes(x.accountId));
      const r = (n: number) => Math.round(n * 100) / 100;
      const spend = all.filter((x) => x.amount < 0);
      const now = new Date();
      const mKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lmKey = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}`;
      const sumBy = (list: typeof spend, key: (x: (typeof spend)[number]) => string) => {
        const m: Record<string, number> = {};
        for (const x of list) m[key(x)] = (m[key(x)] ?? 0) + Math.abs(x.amount);
        return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, r(v)]));
      };
      const total = (k: string) => r(spend.filter((x) => x.date.startsWith(k)).reduce((s, x) => s + Math.abs(x.amount), 0));
      const merchants = sumBy(spend, (x) => x.merchant);
      const acctName = (id: string) => bank.accounts.find((a) => a.id === id)?.name;
      // total spend per month, most recent first (up to 15 months)
      const perMonth: Record<string, number> = {};
      for (const x of spend) perMonth[x.date.slice(0, 7)] = (perMonth[x.date.slice(0, 7)] ?? 0) + Math.abs(x.amount);
      const monthlySpend = Object.fromEntries(
        Object.entries(perMonth)
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .slice(0, 15)
          .map(([k, v]) => [k, r(v)]),
      );
      const dates = spend.map((x) => x.date).filter(Boolean).sort();
      const subs = detectRecurring(spend);
      const reconciledTxnIds = new Set(
        month.items.map((i) => i.paidTxnId).filter(Boolean) as string[],
      );
      const safe = safeToSpend({
        salary: month.salary,
        billsTotal: t.total,
        txns: all,
        reconciledTxnIds,
        daysToPayday: daysUntilPayday(store.settings.payday ?? 25),
      });
      const budgetRows = (() => {
        const b = store.settings.budgets ?? {};
        const keys = Object.keys(b);
        if (!keys.length) return undefined;
        const byCat: Record<string, number> = {};
        for (const x of spend.filter((y) => y.date.startsWith(mKey)))
          byCat[x.category || 'Other'] = (byCat[x.category || 'Other'] ?? 0) + Math.abs(x.amount);
        return keys.map((k) => ({ category: k, cap: b[k], spent: r(byCat[k] ?? 0) }));
      })();
      snap.spending = {
        note: 'Actual bank transactions (read-only). Separate from the planned "items"/bills above. Negative amount = money out, positive = money in.',
        historyFrom: dates[0],
        historyTo: dates[dates.length - 1],
        accounts: bank.accounts
          .filter((a) => bank.selected.includes(a.id))
          .map((a) => ({ name: a.name, provider: a.provider, last4: a.sortLast4 })),
        thisMonthSpend: total(mKey),
        lastMonthSpend: total(lmKey),
        monthlySpend,
        byCategoryThisMonth: sumBy(spend.filter((x) => x.date.startsWith(mKey)), (x) => x.category || 'Other'),
        byCategoryLastMonth: sumBy(spend.filter((x) => x.date.startsWith(lmKey)), (x) => x.category || 'Other'),
        byCategoryAllTime: sumBy(spend, (x) => x.category || 'Other'),
        topMerchants: Object.entries(merchants)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 25)
          .map(([name, spent]) => ({ name, spent })),
        recentTransactions: all.slice(0, 120).map((x) => ({
          date: x.date,
          merchant: x.merchant,
          amount: r(x.amount),
          category: x.category,
          account: acctName(x.accountId),
        })),
        safeToSpend: {
          note: 'What is genuinely left to spend this month: salary − all planned bills − day-to-day spending already gone out (excluding transfers and payments already counted as a tracked bill).',
          ...safe,
        },
        subscriptions: {
          note: 'Recurring payments detected from repeat charges. monthlyTotal is the normalised per-month cost of all of them.',
          monthlyTotal: r(subs.reduce((s, x) => s + x.monthly, 0)),
          items: subs.slice(0, 20).map((x) => ({
            merchant: x.merchant,
            amount: x.amount,
            monthly: x.monthly,
            cadence: x.cadence,
            count: x.count,
            lastDate: x.lastDate,
          })),
        },
        budgets: budgetRows,
      };
    }

    return snap;
  };

  // Map a colour name (or #hex) onto the app's accent palette.
  const COLOR_MAP: Record<string, string> = {
    blue: '#7c9cff',
    periwinkle: '#7c9cff',
    indigo: '#7c9cff',
    purple: '#b98bff',
    violet: '#b98bff',
    lavender: '#b98bff',
    green: '#4be3a8',
    mint: '#4be3a8',
    emerald: '#4be3a8',
    yellow: '#ffd166',
    amber: '#ffd166',
    gold: '#ffd166',
    pink: '#ff6b8b',
    red: '#ff6b8b',
    rose: '#ff6b8b',
    coral: '#ff6b8b',
    crimson: '#ff6b8b',
    cyan: '#5ad2f4',
    teal: '#5ad2f4',
    sky: '#5ad2f4',
    turquoise: '#5ad2f4',
    orange: '#ff9f6b',
    peach: '#ff9f6b',
    lime: '#a0e86f',
    magenta: '#f78bd0',
    fuchsia: '#f78bd0',
    grey: '#c0c6e0',
    gray: '#c0c6e0',
    silver: '#c0c6e0',
    white: '#c0c6e0',
  };
  const resolveColor = (c: unknown): string => {
    const s = String(c ?? '').trim().toLowerCase();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s;
    return COLOR_MAP[s] || ACCENTS[0];
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
          for (const k of ['name', 'amount', 'dueDay', 'note', 'category', 'recurring', 'accent']) {
            if (inp[k] === undefined) continue;
            patch[k] =
              k === 'category' ? asCat(inp[k]) : k === 'accent' ? resolveColor(inp[k]) : inp[k];
          }
          updateItem(String(inp.id), patch);
          break;
        }
        case 'recolor_items': {
          const color = resolveColor(inp.color);
          const ids = Array.isArray(inp.ids) ? (inp.ids as string[]) : null;
          const targets = month.items.filter((it) =>
            ids && ids.length
              ? ids.includes(it.id)
              : inp.category
                ? it.category === asCat(inp.category)
                : true,
          );
          for (const it of targets) updateItem(it.id, { accent: color });
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

  /* -------- hands-free voice mode -------- */

  // Strip the bits that don't read aloud well (markdown, emoji).
  const forSpeech = (t: string) =>
    t
      .replace(/\*\*/g, '')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

  // iOS won't speak later (post-network) unless speech was unlocked inside a
  // user gesture first. Call this from every tap that starts a voice turn.
  const primeSpeech = () => {
    try {
      if (typeof speechSynthesis === 'undefined') return;
      speechSynthesis.resume();
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  };

  const speak = (text: string, onDone?: () => void) => {
    if (typeof speechSynthesis === 'undefined') return onDone?.();
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(forSpeech(text) || 'Done.');
      u.lang = 'en-GB';
      const gb = speechSynthesis.getVoices().find((v) => /en[-_]GB/i.test(v.lang));
      if (gb) u.voice = gb;
      u.onend = () => onDone?.();
      u.onerror = () => onDone?.();
      setPhase('speaking');
      speechSynthesis.speak(u);
    } catch {
      onDone?.();
    }
  };

  const clearSilence = () => {
    if (silenceRef.current) {
      window.clearTimeout(silenceRef.current);
      silenceRef.current = null;
    }
  };

  const listenOnce = (auto = false) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return endVoice();
    const rec: SpeechRec = new SR();
    rec.lang = 'en-GB';
    rec.interimResults = true;
    rec.continuous = false;
    let heard = '';
    let live = false; // did any event confirm it's actually listening?
    const stopSoon = (ms: number) => {
      clearSilence();
      silenceRef.current = window.setTimeout(() => {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }, ms);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rec as any).onstart = () => {
      live = true;
      if (voiceRef.current) setPhase('listening');
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      live = true;
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) t += e.results[i][0].transcript;
      heard = t;
      setInput(t);
      stopSoon(1500); // ~1.5s after you stop talking → send
    };
    rec.onerror = () => {};
    rec.onend = () => {
      clearSilence();
      recRef.current = null;
      if (!voiceRef.current) return;
      const q = heard.trim();
      if (q) {
        setInput('');
        void send(q);
      } else {
        setPhase('idle'); // heard nothing — wait for a tap (don't loop / hang)
      }
    };
    recRef.current = rec;
    setPhase('listening');
    try {
      rec.start();
    } catch {
      setPhase('idle');
      return;
    }
    stopSoon(7000); // safety: never hang on "Listening" if onstart never fires
    // Auto-restarts (after the reply) can be silently blocked by iOS; if nothing
    // has happened shortly after, fall back to tap-to-talk rather than hang.
    if (auto) {
      window.setTimeout(() => {
        if (voiceRef.current && !live) {
          try {
            rec.abort();
          } catch {
            /* ignore */
          }
          setPhase('idle');
        }
      }, 2500);
    }
  };

  const beginVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    HAPTIC.light();
    primeSpeech(); // unlock iOS text-to-speech within this tap
    voiceRef.current = true;
    setVoiceOn(true);
    listenOnce();
  };

  const endVoice = () => {
    voiceRef.current = false;
    setVoiceOn(false);
    clearSilence();
    try {
      recRef.current?.abort();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    try {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    HAPTIC.light();
    const next = [...msgs, { role: 'user' as const, content: q }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    if (voiceRef.current) setPhase('thinking');
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
      if (voiceRef.current) speak(reply || 'Done.', () => voiceRef.current && listenOnce(true));
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: 'Sorry — I couldn’t reach the assistant just now.' }]);
      if (voiceRef.current)
        speak('Sorry, I could not reach the assistant just now.', () => voiceRef.current && listenOnce(true));
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
          <div className="ai-head-actions">
            {micOk && (
              <button
                className={`ghost-btn ai-voice-btn${voiceOn ? ' on' : ''}`}
                onClick={() => (voiceOn ? endVoice() : beginVoice())}
                aria-label={voiceOn ? 'Stop voice' : 'Voice check-in'}
              >
                <Voice size={18} />
              </button>
            )}
            <button className="ghost-btn" onClick={requestClose} aria-label="Close">
              <Close size={17} />
            </button>
          </div>
        </div>

        {voiceOn && (
          <div
            className="ai-voice-status"
            data-phase={phase}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (phase === 'idle') {
                primeSpeech();
                listenOnce();
              }
            }}
          >
            <span className="ai-voice-dot" />
            <span>
              {phase === 'listening'
                ? 'Listening…'
                : phase === 'thinking'
                  ? 'Thinking…'
                  : phase === 'speaking'
                    ? 'Speaking…'
                    : 'Tap to talk'}
            </span>
            <button
              className="ai-voice-stop"
              onClick={(e) => {
                e.stopPropagation();
                endVoice();
              }}
            >
              Stop
            </button>
          </div>
        )}

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
              {m.role === 'assistant' ? renderRich(m.content) : m.content}
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

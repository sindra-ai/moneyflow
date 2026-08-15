'use client';

import { useEffect, useRef, useState } from 'react';
import { computeTotals, useStore } from '@/lib/store';
import { money, monthLabel } from '@/lib/format';
import { daysUntilPayday } from '@/lib/derive';
import { detectRecurring, safeToSpend } from '@/lib/insights';
import { HAPTIC } from '@/lib/haptics';
import { ACCENTS, CATEGORIES, type Category } from '@/lib/types';
import { getCachedTxns } from '@/lib/bankClient';
import { fetchPrice } from '@/lib/marketClient';
import { fileToAttachment, type ChatAttachment } from '@/lib/attach';
import { useToast } from './Toast';
import { Close, Mic, Paperclip, Send, Sparkle, Voice } from './icons';

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

// A tiny silent WAV — played inside the first tap to unlock audio playback on
// iOS, so the fetched neural-voice audio can play later without a gesture.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

interface MsgAtt {
  kind: string;
  name: string;
  preview?: string;
}
interface Msg {
  role: 'user' | 'assistant';
  content: string;
  atts?: MsgAtt[];
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
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const [fx, setFx] = useState<number | null>(null); // GBP/USD, for extra income
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (store.extraIncome?.currency === 'USD') void fetchPrice('GBPUSD=X').then(setFx);
  }, [store.extraIncome?.currency]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const f of files.slice(0, 4)) {
      const a = await fileToAttachment(f);
      if (a) setPending((p) => [...p, a].slice(0, 4));
      else toast({ message: `Couldn’t attach ${f.name}` });
    }
  };

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
  // Voice conversation history (kept off-screen so voice mode stays text-free).
  const voiceMsgs = useRef<Msg[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setMicOk(!!SR);
    // Warm the TTS voice list (some browsers load it asynchronously).
    try {
      if (typeof speechSynthesis !== 'undefined') {
        speechSynthesis.getVoices();
        speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
      }
    } catch {
      /* ignore */
    }
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

    // Temporary extra-income (contract) forecast, converted to GBP.
    if (store.extraIncome) {
      const ei = store.extraIncome;
      const rate = fx ?? 1.3;
      const toGBP = (n: number) => (ei.currency === 'GBP' ? n : n / rate);
      const now = new Date();
      const payDate = (key: string) => {
        const [y, m, d] = key.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        dt.setDate(dt.getDate() + 9);
        return dt;
      };
      const inMonth = (dt: Date) =>
        dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
      const wgbp = (h: number) => toGBP(h * ei.rate);
      const r0 = (n: number) => Math.round(n);
      snap.extraIncome = {
        note: 'A temporary extra-income contract, paid weekly in arrears (work a week, get paid the following Wednesday). Amounts are EXPECTED (a forecast) and mostly NOT yet received — never treat unpaid amounts as money already available to spend. Figures below are GBP.',
        name: ei.name,
        ratePerHour: ei.rate,
        currency: ei.currency,
        weeklyHourCap: ei.capHours,
        expectedUnpaidGBP: r0(ei.weeks.filter((w) => !w.received).reduce((s, w) => s + wgbp(w.hours), 0)),
        arrivingThisMonthGBP: r0(
          ei.weeks.filter((w) => !w.received && inMonth(payDate(w.key))).reduce((s, w) => s + wgbp(w.hours), 0),
        ),
        receivedTotalGBP: r0(ei.weeks.filter((w) => w.received).reduce((s, w) => s + wgbp(w.hours), 0)),
        weeks: ei.weeks
          .slice(-8)
          .map((w) => ({ weekOf: w.key, hours: w.hours, received: !!w.received, approxGBP: r0(wgbp(w.hours)) })),
      };
    }

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
      if (typeof speechSynthesis !== 'undefined') {
        speechSynthesis.resume();
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        speechSynthesis.speak(u);
      }
    } catch {
      /* ignore */
    }
    try {
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = SILENT_WAV;
      void audioRef.current.play().catch(() => {});
    } catch {
      /* ignore */
    }
  };

  // Pick a warm British female voice where one exists, with sensible fallbacks.
  const pickVoice = (): SpeechSynthesisVoice | null => {
    try {
      const vs = speechSynthesis.getVoices();
      if (!vs.length) return null;
      const byName = (re: RegExp) => vs.find((v) => re.test(v.name));
      const male = /daniel|arthur|oliver|george|male|reed|rishi/i;
      return (
        byName(/serena/i) ||
        byName(/(^|\W)kate/i) ||
        byName(/martha/i) ||
        byName(/stephanie/i) ||
        byName(/fiona/i) ||
        byName(/google uk english female/i) ||
        vs.find((v) => /en[-_]GB/i.test(v.lang) && !male.test(v.name)) ||
        byName(/samantha/i) ||
        vs.find((v) => /en[-_]GB/i.test(v.lang)) ||
        vs.find((v) => /^en/i.test(v.lang)) ||
        null
      );
    } catch {
      return null;
    }
  };

  // The good voice: ElevenLabs via /api/tts, played through the primed <audio>.
  // Resolves false if unavailable so we can fall back to the browser voice.
  const speakNeural = async (text: string, onDone?: () => void): Promise<boolean> => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: forSpeech(text) }),
      });
      if (!res.ok) return false; // 503 (no key) or error → fall back
      if (!voiceRef.current) return true; // user stopped while fetching
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = audioRef.current ?? new Audio();
      audioRef.current = a;
      a.src = url;
      a.onended = () => {
        URL.revokeObjectURL(url);
        onDone?.();
      };
      a.onerror = () => {
        URL.revokeObjectURL(url);
        onDone?.();
      };
      setPhase('speaking');
      await a.play();
      return true;
    } catch {
      return false;
    }
  };

  const speakBrowser = (text: string, onDone?: () => void) => {
    if (typeof speechSynthesis === 'undefined') return onDone?.();
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(forSpeech(text) || 'Done.');
      u.lang = 'en-GB';
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = 1;
      u.pitch = 1.08;
      u.onend = () => onDone?.();
      u.onerror = () => onDone?.();
      setPhase('speaking');
      speechSynthesis.speak(u);
    } catch {
      onDone?.();
    }
  };

  const speak = (text: string, onDone?: () => void) => {
    void speakNeural(text, onDone).then((ok) => {
      if (!ok) speakBrowser(text, onDone);
    });
  };

  const clearSilence = () => {
    if (silenceRef.current) {
      window.clearTimeout(silenceRef.current);
      silenceRef.current = null;
    }
  };

  // Fully detach + stop the current recognition so its callbacks can never
  // race a newer one (the cause of "Tap to talk" doing nothing).
  const teardownRec = () => {
    clearSilence();
    const r = recRef.current;
    recRef.current = null;
    if (r) {
      try {
        r.onstart = null;
        r.onresult = null;
        r.onend = null;
        r.onerror = null;
        r.abort();
      } catch {
        /* ignore */
      }
    }
  };

  const listenOnce = (auto = false, retry = true) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return endVoice();
    teardownRec(); // clear any previous session first
    const rec: SpeechRec = new SR();
    rec.lang = 'en-GB';
    rec.interimResults = true;
    rec.continuous = false;
    recRef.current = rec;
    const active = () => recRef.current === rec && voiceRef.current;
    let heard = '';
    let live = false;
    const stopSoon = (ms: number) => {
      clearSilence();
      silenceRef.current = window.setTimeout(() => {
        if (recRef.current === rec) {
          try {
            rec.stop();
          } catch {
            /* ignore */
          }
        }
      }, ms);
    };
    rec.onstart = () => {
      if (!active()) return;
      live = true;
      setPhase('listening');
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      if (!active()) return;
      live = true;
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) t += e.results[i][0].transcript;
      heard = t;
      setInput(t);
      stopSoon(1600); // ~1.6s after you stop talking → send
    };
    rec.onerror = () => {};
    rec.onend = () => {
      if (recRef.current !== rec) return; // stale — a newer session replaced us
      recRef.current = null;
      clearSilence();
      if (!voiceRef.current) return;
      const q = heard.trim();
      if (q) {
        setInput('');
        void send(q);
      } else {
        setPhase('idle');
      }
    };
    setPhase('listening');
    try {
      rec.start();
    } catch {
      // iOS throws if the last mic session hasn't fully released — retry once.
      recRef.current = null;
      if (retry) window.setTimeout(() => voiceRef.current && listenOnce(auto, false), 350);
      else setPhase('idle');
      return;
    }
    stopSoon(7000); // safety: never hang on "Listening"
    // Auto-restart after a reply is often blocked on iOS; fall back to a
    // (working) tap-to-talk instead of a dead "Listening".
    if (auto) {
      window.setTimeout(() => {
        if (recRef.current === rec && voiceRef.current && !live) {
          teardownRec();
          setPhase('idle');
        }
      }, 2200);
    }
  };

  const beginVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    HAPTIC.light();
    primeSpeech(); // unlock iOS text-to-speech within this tap
    voiceMsgs.current = []; // fresh spoken conversation
    voiceRef.current = true;
    setVoiceOn(true);
    listenOnce();
  };

  const endVoice = () => {
    voiceRef.current = false;
    setVoiceOn(false);
    teardownRec();
    try {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    try {
      audioRef.current?.pause();
    } catch {
      /* ignore */
    }
  };

  const send = async (text: string) => {
    const q = text.trim();
    const isVoice = voiceRef.current;
    // Attachments only apply to the typed chat (not voice).
    const outAtts = isVoice ? [] : pending;
    if ((!q && outAtts.length === 0) || busy) return;
    HAPTIC.light();
    let outgoing: Msg[];
    if (isVoice) {
      voiceMsgs.current = [...voiceMsgs.current, { role: 'user' as const, content: q }].slice(-20);
      outgoing = voiceMsgs.current;
    } else {
      outgoing = [
        ...msgs,
        {
          role: 'user' as const,
          content: q,
          atts: outAtts.map((a) => ({ kind: a.kind, name: a.name, preview: a.preview })),
        },
      ];
      setMsgs(outgoing);
      setPending([]);
    }
    setInput('');
    setBusy(true);
    if (isVoice) setPhase('thinking');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: outgoing.map((m) => ({ role: m.role, content: m.content })),
          snapshot: buildSnapshot(),
          attachments: outAtts.map((a) => ({
            kind: a.kind,
            mediaType: a.mediaType,
            data: a.data,
            name: a.name,
          })),
        }),
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
      if (isVoice) {
        voiceMsgs.current = [...voiceMsgs.current, { role: 'assistant' as const, content: reply || '…' }].slice(-20);
        if (applied > 0) HAPTIC.success();
        speak(reply || 'Done.', () => voiceRef.current && listenOnce(true));
      } else {
        setMsgs((m) => [...m, { role: 'assistant', content: reply || '…' }]);
        if (applied > 0) {
          HAPTIC.success();
          toast({ message: `${applied} change${applied === 1 ? '' : 's'} applied`, action: { label: 'Undo', run: undo } });
        }
      }
    } catch {
      if (isVoice)
        speak('Sorry, I could not reach the assistant just now.', () => voiceRef.current && listenOnce(true));
      else setMsgs((m) => [...m, { role: 'assistant', content: 'Sorry — I couldn’t reach the assistant just now.' }]);
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
              {m.atts && m.atts.length > 0 && (
                <div className="ai-msg-atts">
                  {m.atts.map((a, j) =>
                    a.preview ? (
                      <img key={j} src={a.preview} alt={a.name} />
                    ) : (
                      <span key={j} className="ai-msg-doc">
                        <Paperclip size={12} /> {a.name}
                      </span>
                    ),
                  )}
                </div>
              )}
              {m.content && (m.role === 'assistant' ? renderRich(m.content) : m.content)}
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

        {pending.length > 0 && (
          <div className="ai-atts">
            {pending.map((a, i) => (
              <div className="ai-att" key={i}>
                {a.kind === 'image' && a.preview ? (
                  <img src={a.preview} alt="" />
                ) : (
                  <span className="ai-att-doc">
                    <Paperclip size={13} />
                  </span>
                )}
                <span className="ai-att-name">{a.name}</span>
                <button
                  type="button"
                  className="ai-att-x"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                >
                  <Close size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          className="ai-bar"
          onSubmit={(e) => {
            e.preventDefault();
            recRef.current?.stop();
            void send(input);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf,text/plain,.csv,.md,.json"
            hidden
            multiple
            onChange={onPick}
          />
          <button
            type="button"
            className="ai-attach"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach a photo or document"
          >
            <Paperclip size={18} />
          </button>
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
            placeholder={
              pending.length ? 'Ask about the attachment…' : listening ? 'Listening…' : 'Ask, attach, or tell me to change something…'
            }
            autoComplete="off"
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            className="ai-send"
            type="submit"
            disabled={busy || (!input.trim() && pending.length === 0)}
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { HAPTIC } from '@/lib/haptics';
import { registerSW, runDueCheck } from '@/lib/reminders';
import type { Outgoing } from '@/lib/types';
import { Logo } from './Logo';
import LoginScreen from './LoginScreen';
import { BottomNav, type Tab } from './BottomNav';
import { HomeView } from './HomeView';
import { CalendarView } from './CalendarView';
import { SpendingView } from './SpendingView';
import { ProfileView } from './ProfileView';
import { checkNewActivity, getCachedTxns } from '@/lib/bankClient';
import { ItemEditor, type EditorTarget } from './ItemEditor';
import { AiChat } from './AiChat';
import { useToast } from './Toast';
import { Moon, Sparkle, Sun } from './icons';

export function AppShell() {
  const {
    ready,
    store,
    resolvedTheme,
    setSettings,
    addItem,
    updateItem,
    deleteItem,
    setBank,
    autoReconcile,
  } = useStore();
  const { session, loading } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('home');
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const storeRef = useRef(store);
  storeRef.current = store;

  // Register the notification service worker once.
  useEffect(() => {
    void registerSW();
  }, []);

  // Auto-update: if a newer version has been deployed, quietly refresh — on
  // return to foreground and shortly after load — but never mid-edit.
  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_BUILD_ID;
    // Only run when both ids are real deploy ids — never reload on the 'dev'
    // fallback, which would risk a loop if the runtime id were ever missing.
    if (!mine || mine === 'dev') return;
    let reloading = false;
    const check = async () => {
      if (reloading || document.visibilityState !== 'visible') return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        const { id } = (await res.json()) as { id?: string };
        if (id && id !== 'dev' && id !== mine) {
          reloading = true;
          window.location.reload();
        }
      } catch {
        /* offline — ignore */
      }
    };
    const t = window.setTimeout(check, 3000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Handle the return from the bank's OAuth screen. TrueLayer sends back a
  // ?code (success) or ?error (declined/blocked). We hand it to SpendingView
  // to finish the exchange and show any error — no fragile session flag.
  const [bankCode, setBankCode] = useState<string | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const err = params.get('error');
    if (!code && !err) return;
    window.history.replaceState({}, '', window.location.pathname);
    if (code) setBankCode(code);
    if (err) setBankError(err);
    setTab('spending');
  }, []);

  // "New activity" dot on the Spending tab: quietly check on open, when a
  // synced connection first appears, and when the app returns to foreground.
  const [bankDot, setBankDot] = useState(false);
  const bankKey = store.bank?.connectedAt ?? 0;
  useEffect(() => {
    const check = async () => {
      const cur = storeRef.current.bank;
      const { hasNew, conn } = await checkNewActivity(cur);
      setBankDot(hasNew);
      if (conn && cur && conn.tokens.accessToken !== cur.tokens.accessToken) setBank(conn);
      // Tick any bills whose payment has now cleared at the bank.
      const cached = getCachedTxns();
      if (cur && cached?.txns?.length) {
        const n = autoReconcile(cached.txns);
        if (n > 0)
          toast({ message: `${n} bill${n === 1 ? '' : 's'} auto-ticked — payment cleared` });
      }
    };
    void check();
    const onVis = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [bankKey, setBank, autoReconcile, toast]);

  // Surface any bills due soon shortly after load (giving cloud sync a moment
  // to land) and whenever the app is brought back to the foreground.
  useEffect(() => {
    if (!ready || !session) return;
    const t = window.setTimeout(() => void runDueCheck(storeRef.current), 1500);
    const onVis = () => {
      if (document.visibilityState === 'visible') void runDueCheck(storeRef.current);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [ready, session]);

  // Auth gate — keep the cloud login in front of the app.
  if (loading) {
    return (
      <div className="boot">
        <Logo size={56} />
      </div>
    );
  }
  if (!session) return <LoginScreen />;

  if (!ready) {
    return (
      <div className="boot">
        <Logo size={56} />
      </div>
    );
  }

  const openEdit = (item: Outgoing) => setEditor({ item });

  return (
    <>
      <div className="sky" />

      <div className="app">
        <div className="pinned">
          <div className="top">
            <div className="mark">
              <Logo size={30} />
            </div>
            <div className="top-actions">
              <button
                className="ghost-btn ai-open"
                aria-label="Ask MoneyFlow"
                onClick={() => {
                  HAPTIC.light();
                  setAiOpen(true);
                }}
              >
                <Sparkle size={18} />
              </button>
              <button
                className="ghost-btn"
                aria-label={resolvedTheme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                onClick={() => {
                  HAPTIC.light();
                  setSettings({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' });
                }}
              >
                {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* Keyed so each tab gets its own entrance and a fresh scroller. */}
        <Views
          key={tab}
          tab={tab}
          scrollerRef={scrollerRef}
          onAdd={() => setEditor({ item: null })}
          onEdit={openEdit}
          bankCode={bankCode}
          bankError={bankError}
          onBankSeen={() => setBankDot(false)}
        />

        <BottomNav tab={tab} onChange={setTab} dot={bankDot ? 'spending' : null} />
      </div>

      {editor && (
        <ItemEditor
          // Remount per target so the form re-seeds from the item it opened on.
          key={editor.item?.id ?? 'new'}
          target={editor}
          onClose={() => setEditor(null)}
          onSave={(data, id) => (id ? updateItem(id, data) : addItem(data))}
          onDelete={deleteItem}
        />
      )}

      {aiOpen && <AiChat onClose={() => setAiOpen(false)} />}
    </>
  );
}

function Views({
  tab,
  scrollerRef,
  onAdd,
  onEdit,
  bankCode,
  bankError,
  onBankSeen,
}: {
  tab: Tab;
  scrollerRef: React.RefObject<HTMLDivElement>;
  onAdd: () => void;
  onEdit: (item: Outgoing) => void;
  bankCode: string | null;
  bankError: string | null;
  onBankSeen: () => void;
}) {
  if (tab === 'calendar') return <CalendarView scrollerRef={scrollerRef} onEdit={onEdit} />;
  if (tab === 'spending')
    return (
      <SpendingView
        scrollerRef={scrollerRef}
        initialCode={bankCode}
        initialError={bankError}
        onSeen={onBankSeen}
      />
    );
  if (tab === 'profile') return <ProfileView scrollerRef={scrollerRef} />;
  return <HomeView scrollerRef={scrollerRef} onAdd={onAdd} onEdit={onEdit} />;
}

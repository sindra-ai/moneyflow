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
import { completeConnect, hasPendingConnect } from '@/lib/bankClient';
import { ItemEditor, type EditorTarget } from './ItemEditor';
import { AiChat } from './AiChat';
import { Moon, Sparkle, Sun } from './icons';

export function AppShell() {
  const { ready, store, resolvedTheme, setSettings, addItem, updateItem, deleteItem } = useStore();
  const { session, loading } = useAuth();
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

  // Handle the return from the bank's OAuth screen (?code=…): finish the
  // connection, clean the URL, and drop the user on the Spending tab.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code || !hasPendingConnect()) return;
    (async () => {
      try {
        await completeConnect(code);
      } catch {
        /* SpendingView will surface a reconnect prompt */
      } finally {
        window.history.replaceState({}, '', window.location.pathname);
        setTab('spending');
      }
    })();
  }, []);

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
        />

        <BottomNav tab={tab} onChange={setTab} />
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
}: {
  tab: Tab;
  scrollerRef: React.RefObject<HTMLDivElement>;
  onAdd: () => void;
  onEdit: (item: Outgoing) => void;
}) {
  if (tab === 'calendar') return <CalendarView scrollerRef={scrollerRef} onEdit={onEdit} />;
  if (tab === 'spending') return <SpendingView scrollerRef={scrollerRef} />;
  if (tab === 'profile') return <ProfileView scrollerRef={scrollerRef} />;
  return <HomeView scrollerRef={scrollerRef} onAdd={onAdd} onEdit={onEdit} />;
}

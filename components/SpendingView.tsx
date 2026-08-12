'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useStore } from '@/lib/store';
import { money } from '@/lib/format';
import { HAPTIC } from '@/lib/haptics';
import { bankLogo } from '@/lib/bankLogos';
import { CAT_ACCENT, type SpendCat } from '@/lib/spend';
import {
  beginConnect,
  cacheTxns,
  clearCache,
  completeConnect,
  getCachedTxns,
  loadTransactions,
  markSeen,
  type BankConn,
  type Txn,
} from '@/lib/bankClient';
import { Check, Plus, Rotate, Wallet } from './icons';

function startOfWeek(d: Date): number {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return s.getTime();
}

const HOLD_TOUCH = 240;
const HOLD_MOUSE = 150;
const CARD_GAP = 12;

interface Drag {
  from: number;
  to: number;
  dx: number;
  w: number;
}

export function SpendingView({
  scrollerRef,
  initialCode,
  initialError,
  onSeen,
}: {
  scrollerRef: RefObject<HTMLDivElement>;
  initialCode?: string | null;
  initialError?: string | null;
  onSeen?: () => void;
}) {
  // The connection lives in the synced store, so it follows you everywhere.
  const { bank: conn, setBank } = useStore();
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(!!initialCode);
  const [needsKeys, setNeedsKeys] = useState(false);
  const [error, setError] = useState<string | null>(
    initialError ? `Halifax returned: ${initialError}` : null,
  );
  const [confirmDc, setConfirmDc] = useState(false);
  const [txnQuery, setTxnQuery] = useState('');
  const loadedFor = useRef<string>('');
  const codeUsed = useRef(false);
  const connRef = useRef(conn);
  connRef.current = conn;

  // Finish an OAuth return (?code) once. Any failure is shown, not swallowed.
  useEffect(() => {
    if (!initialCode || codeUsed.current) return;
    codeUsed.current = true;
    (async () => {
      setConnecting(true);
      setError(null);
      try {
        setBank(await completeConnect(initialCode));
      } catch (e) {
        setError(`Couldn’t finish connecting — ${(e as Error).message}`);
      } finally {
        setConnecting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load ALL accounts' transactions; persist rotated tokens back to the store.
  const load = useCallback(
    async (c: BankConn, force = false) => {
      setLoading(true);
      setError(null);
      try {
        const cached = getCachedTxns();
        let list: Txn[];
        if (!force && cached && Date.now() - cached.at < 120_000) {
          list = cached.txns;
        } else {
          const res = await loadTransactions(c);
          list = res.txns;
          cacheTxns(list);
          if (res.conn.tokens.accessToken !== c.tokens.accessToken) setBank(res.conn);
        }
        setTxns(list);
        markSeen(list);
        onSeen?.();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [onSeen, setBank],
  );

  // Re-fetch only when the connection (not the selection or order) changes.
  useEffect(() => {
    const key = conn ? conn.connectedAt + '|' + conn.accounts.map((a) => a.id).join() : '';
    if (conn && loadedFor.current !== key) {
      loadedFor.current = key;
      void load(conn);
    }
  }, [conn, load]);

  const connect = async () => {
    HAPTIC.light();
    setError(null);
    const r = await beginConnect();
    if (r.needsKeys) setNeedsKeys(true);
    else if (r.error) setError(r.error);
    // otherwise the browser is navigating to the bank
  };

  const disconnect = () => {
    if (!confirmDc) {
      setConfirmDc(true);
      HAPTIC.light();
      return;
    }
    HAPTIC.success();
    clearCache();
    setBank(null);
    setTxns([]);
    setConfirmDc(false);
  };

  // Include/exclude an account from the view (clear, explicit toggle).
  const toggleSelected = (id: string) => {
    if (!conn) return;
    HAPTIC.select();
    const selected = conn.selected.includes(id)
      ? conn.selected.filter((x) => x !== id)
      : [...conn.selected, id];
    if (selected.length === 0) return; // keep at least one on
    setBank({ ...conn, selected });
  };

  /* ------------------------------------------------- drag to reorder cards */

  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const centers = useRef<number[]>([]);
  const startX = useRef(0);
  const hold = useRef<number | null>(null);

  const clearHold = () => {
    if (hold.current) {
      window.clearTimeout(hold.current);
      hold.current = null;
    }
  };
  useEffect(() => () => clearHold(), []);

  const beginDrag = (i: number) => {
    const el = cardRefs.current[i];
    if (!el) return;
    centers.current = cardRefs.current.map((c) => {
      const b = c?.getBoundingClientRect();
      return b ? b.left + b.width / 2 : 0;
    });
    HAPTIC.select();
    setDrag({ from: i, to: i, dx: 0, w: el.getBoundingClientRect().width + CARD_GAP });
  };

  const armTouch = (e: React.TouchEvent, i: number) => {
    if ((e.target as HTMLElement).closest('.acct-toggle')) return;
    startX.current = e.touches[0].clientX;
    clearHold();
    hold.current = window.setTimeout(() => beginDrag(i), HOLD_TOUCH);
  };
  const moveTouch = (e: React.TouchEvent) => {
    if (dragRef.current) return;
    if (Math.abs(e.touches[0].clientX - startX.current) > 9) clearHold();
  };
  const armMouse = (e: React.MouseEvent, i: number) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.acct-toggle')) return;
    startX.current = e.clientX;
    clearHold();
    hold.current = window.setTimeout(() => beginDrag(i), HOLD_MOUSE);
  };

  // One loop owns follow-the-finger + commit, for touch and mouse alike.
  useEffect(() => {
    if (!drag) return;
    const move = (e: TouchEvent | MouseEvent) => {
      const cur = dragRef.current;
      if (!cur) return;
      const x = 'touches' in e ? e.touches[0]?.clientX : (e as MouseEvent).clientX;
      if (x == null) return;
      if ('touches' in e) e.preventDefault(); // block the row scroll while dragging
      const dx = x - startX.current;
      const mid = centers.current[cur.from] + dx;
      let to = cur.from;
      while (to > 0 && mid < centers.current[to - 1]) to -= 1;
      while (to < centers.current.length - 1 && mid > centers.current[to + 1]) to += 1;
      if (to !== cur.to) HAPTIC.light();
      setDrag({ ...cur, dx, to });
    };
    const end = () => {
      const cur = dragRef.current;
      const c = connRef.current;
      if (cur && c && cur.to !== cur.from) {
        const next = c.accounts.slice();
        const [moved] = next.splice(cur.from, 1);
        next.splice(cur.to, 0, moved);
        HAPTIC.success();
        setBank({ ...c, accounts: next });
      }
      setDrag(null);
    };
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', end);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
    return () => {
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
      document.removeEventListener('touchcancel', end);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', end);
    };
  }, [drag !== null, setBank]); // eslint-disable-line react-hooks/exhaustive-deps

  const shiftFor = (i: number): number => {
    if (!drag || i === drag.from) return 0;
    if (drag.to > drag.from && i > drag.from && i <= drag.to) return -drag.w;
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return drag.w;
    return 0;
  };

  /* -------- derived spend figures (only the SELECTED accounts count) -------- */
  const shown = conn ? txns.filter((t) => conn.selected.includes(t.accountId)) : [];
  const spend = shown.filter((t) => t.amount < 0);
  // The transaction list can be searched by merchant or category.
  const q = txnQuery.trim().toLowerCase();
  const listed = q
    ? shown.filter((t) => `${t.merchant} ${t.category ?? ''}`.toLowerCase().includes(q))
    : shown;
  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const sum = (list: Txn[]) => list.reduce((s, t) => s + Math.abs(t.amount), 0);
  const weekSpend = sum(spend.filter((t) => new Date(t.date).getTime() >= weekStart));
  const monthSpend = sum(spend.filter((t) => t.date.startsWith(monthKey)));

  const byCat = new Map<string, number>();
  for (const t of spend.filter((x) => x.date.startsWith(monthKey)))
    byCat.set(t.category || 'Other', (byCat.get(t.category || 'Other') ?? 0) + Math.abs(t.amount));
  const cats = [...byCat.entries()].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  const catMax = cats.reduce((m, c) => Math.max(m, c.v), 0) || 1;

  /* -------- render -------- */
  return (
    <div className="scroll view" ref={scrollerRef}>
      {!conn ? (
        <div className="sp-hero">
          <div className="sp-orb">
            <Wallet size={30} />
          </div>
          <h3>{connecting ? 'Connecting…' : 'Track your spending'}</h3>
          {connecting ? (
            <p>Finishing the secure connection to your bank…</p>
          ) : needsKeys ? (
            <p>
              Add your TrueLayer keys (<code>TRUELAYER_CLIENT_ID</code> /{' '}
              <code>TRUELAYER_CLIENT_SECRET</code>) in Vercel and redeploy, then connect.
            </p>
          ) : (
            <p>
              Securely link your bank to see every payment, auto-categorised, with weekly and
              monthly totals. Read-only — it can never move money.
            </p>
          )}
          {error && <div className="sp-err">{error}</div>}
          {!needsKeys && !connecting && (
            <button
              className="btn btn-key"
              style={{ width: '100%', flex: 'none', height: 54 }}
              onClick={() => void connect()}
            >
              {error ? 'Try again' : 'Connect your bank'}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="tiles">
            <div className="tile">
              <div className="duo-k">This week</div>
              <div className="duo-v n">{money(weekSpend)}</div>
            </div>
            <div className="tile">
              <div className="duo-k">This month</div>
              <div className="duo-v n">{money(monthSpend)}</div>
            </div>
          </div>

          <div className="sec">
            <h3>Accounts</h3>
            <div className="sp-acts">
              <button className="sp-dc-link" onClick={disconnect}>
                {confirmDc ? 'Tap to confirm' : 'Disconnect'}
              </button>
              <button
                className="sp-refresh"
                onClick={() => void load(conn, true)}
                aria-label="Refresh"
                data-spin={loading}
              >
                <Rotate size={16} />
              </button>
            </div>
          </div>
          <div className="acct-row" data-dragging={!!drag}>
            {conn.accounts.map((a, i) => {
              const on = conn.selected.includes(a.id);
              const dragging = drag?.from === i;
              const logo = bankLogo(a.provider, a.providerLogo);
              return (
                <div
                  key={a.id}
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  className={`acct-card${dragging ? ' lift' : ''}${!dragging && drag ? ' slide' : ''}`}
                  data-off={!on}
                  style={{
                    transform: dragging
                      ? `translateX(${drag!.dx}px) scale(1.04)`
                      : shiftFor(i)
                        ? `translateX(${shiftFor(i)}px)`
                        : undefined,
                  }}
                  onTouchStart={(e) => armTouch(e, i)}
                  onTouchMove={moveTouch}
                  onTouchEnd={clearHold}
                  onMouseDown={(e) => armMouse(e, i)}
                  onMouseUp={clearHold}
                  onMouseLeave={clearHold}
                >
                  <button
                    className="acct-toggle"
                    data-on={on}
                    aria-label={on ? `Hide ${a.name}` : `Show ${a.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelected(a.id);
                    }}
                  >
                    {on && <Check size={12} />}
                  </button>
                  <div className="acct-logo">
                    {logo ? (
                      <img src={logo} alt={a.provider || ''} draggable={false} />
                    ) : (
                      <span className="acct-logo-fallback">
                        <Wallet size={20} />
                      </span>
                    )}
                  </div>
                  <div className="acct-info">
                    <div className="acct-name">{a.name}</div>
                    <div className="acct-meta">
                      {a.provider || 'Account'}
                      {a.sortLast4 ? ` ·${a.sortLast4}` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
            <button className="acct-add" onClick={() => void connect()}>
              <Plus size={18} />
              Add account
            </button>
          </div>

          {cats.length > 0 && (
            <>
              <div className="sec">
                <h3>This month by category</h3>
              </div>
              <div className="bd">
                {cats.map((c) => (
                  <div className="bd-row" key={c.k}>
                    <div className="bd-top">
                      <span className="bd-k">{c.k}</span>
                      <span className="bd-v n">{money(c.v)}</span>
                    </div>
                    <div className="bd-bar">
                      <i
                        style={{
                          width: `${Math.round((c.v / catMax) * 100)}%`,
                          background: CAT_ACCENT[c.k as SpendCat] || 'var(--accent)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="sec">
            <h3>Transactions</h3>
            <span className="n">{listed.length}</span>
          </div>
          {shown.length > 0 && (
            <input
              className="in search"
              value={txnQuery}
              placeholder="Search transactions"
              autoComplete="off"
              aria-label="Search transactions"
              onChange={(e) => setTxnQuery(e.target.value)}
            />
          )}
          {error && <div className="sp-err">{error}</div>}
          {loading && shown.length === 0 ? (
            <div className="blank">
              <p>Loading your transactions…</p>
            </div>
          ) : shown.length === 0 ? (
            <div className="blank">
              <h4>Nothing yet</h4>
              <p>New transactions appear here after they clear at your bank.</p>
            </div>
          ) : listed.length === 0 ? (
            <div className="blank">
              <h4>No matches</h4>
              <p>Nothing matches &ldquo;{txnQuery.trim()}&rdquo;.</p>
            </div>
          ) : (
            <div className="group">
              {/* Render a window for performance; totals above still use all. */}
              {listed.slice(0, 250).map((t) => (
                <div className="swipe" key={t.id}>
                  <div className="row">
                    <div
                      className="glyph"
                      style={{
                        background: `color-mix(in srgb, ${CAT_ACCENT[(t.category as SpendCat) || 'Other']} 16%, transparent)`,
                        color: CAT_ACCENT[(t.category as SpendCat) || 'Other'],
                      }}
                      aria-hidden="true"
                    >
                      {(t.merchant || '·')[0].toUpperCase()}
                    </div>
                    <div className="rbody">
                      <div className="rname">{t.merchant}</div>
                      <div className="rmeta">
                        {t.category} · {t.date}
                      </div>
                    </div>
                    <div className={`ramt n ${t.amount >= 0 ? 'up' : ''}`}>
                      {t.amount >= 0 ? '+' : '−'}
                      {money(Math.abs(t.amount))}
                    </div>
                  </div>
                </div>
              ))}
              {listed.length > 250 && (
                <div className="sp-more">Showing the latest 250 of {listed.length}</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

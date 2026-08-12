'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useStore } from '@/lib/store';
import { money } from '@/lib/format';
import { HAPTIC } from '@/lib/haptics';
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
import { Plus, Rotate, Wallet } from './icons';

function startOfWeek(d: Date): number {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return s.getTime();
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
  const loadedFor = useRef<string>('');
  const codeUsed = useRef(false);

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

  // Load transactions; persist any rotated tokens back to the synced store.
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

  useEffect(() => {
    if (conn && loadedFor.current !== conn.connectedAt + conn.selected.join()) {
      loadedFor.current = conn.connectedAt + conn.selected.join();
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

  /* -------- derived spend figures -------- */
  const spend = txns.filter((t) => t.amount < 0);
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
            <button
              className="sp-refresh"
              onClick={() => void load(conn, true)}
              aria-label="Refresh"
              data-spin={loading}
            >
              <Rotate size={16} />
            </button>
          </div>
          <div className="acct-row">
            {conn.accounts.map((a) => (
              <div className="acct-card" key={a.id}>
                <div className="acct-logo">
                  {a.providerLogo ? (
                    <img src={a.providerLogo} alt="" draggable={false} />
                  ) : (
                    <Wallet size={18} />
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
            ))}
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
            <span className="n">{txns.length}</span>
          </div>
          {error && <div className="sp-err">{error}</div>}
          {loading && txns.length === 0 ? (
            <div className="blank">
              <p>Loading your transactions…</p>
            </div>
          ) : txns.length === 0 ? (
            <div className="blank">
              <h4>Nothing yet</h4>
              <p>New transactions appear here after they clear at your bank.</p>
            </div>
          ) : (
            <div className="group">
              {txns.map((t) => (
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
            </div>
          )}

          <button className="sp-disconnect" onClick={disconnect}>
            {confirmDc ? 'Tap again to disconnect' : 'Disconnect bank'}
          </button>
        </>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { computeTotals, monthKeyOf, useStore } from '@/lib/store';
import { money, moneyCompact, moneyParts } from '@/lib/format';
import { daysUntilPayday, history, pacing } from '@/lib/derive';
import { safeToSpend } from '@/lib/insights';
import { getCachedTxns } from '@/lib/bankClient';
import { useCountUp } from '@/lib/useCountUp';
import { HAPTIC } from '@/lib/haptics';
import type { Outgoing } from '@/lib/types';
import { MonthSwitcher } from './MonthSwitcher';
import { Gauge } from './Gauge';
import { Sparkline } from './Sparkline';
import { Ledger } from './Ledger';
import { Celebration } from './Celebration';
import { useToast } from './Toast';
import { CheckAll, Plus, Rotate, Wallet } from './icons';

interface Props {
  scrollerRef: RefObject<HTMLDivElement>;
  onAdd: () => void;
  onEdit: (item: Outgoing) => void;
}

export function HomeView({ scrollerRef, onAdd, onEdit }: Props) {
  const { store, month, monthKey, bank, togglePaid, setAllPaid, reorder, deleteItem, undo } =
    useStore();
  const totals = computeTotals(month);
  const toast = useToast();

  const [min, setMin] = useState(false);
  const [mode, setMode] = useState<'order' | 'due'>('order');
  const [q, setQ] = useState('');
  const [party, setParty] = useState(false);

  const isCurrent = monthKey === monthKeyOf();
  const untilPay = isCurrent ? daysUntilPayday(store.settings.payday ?? 25) : null;

  // Safe-to-spend uses real bank spending, so it only shows on the live month
  // with a bank linked. Reconciled bill payments are excluded to avoid
  // double-counting them against both "bills" and "spent".
  const safe = (() => {
    if (!bank || !isCurrent) return null;
    const cached = getCachedTxns();
    const txns = (cached?.txns ?? []).filter((t) => bank.selected.includes(t.accountId));
    if (!txns.length) return null;
    const reconciledTxnIds = new Set(
      month.items.map((i) => i.paidTxnId).filter(Boolean) as string[],
    );
    return safeToSpend({
      salary: month.salary,
      billsTotal: totals.total,
      txns,
      reconciledTxnIds,
      daysToPayday: untilPay,
    });
  })();
  const query = q.trim().toLowerCase();
  const filtered = query
    ? month.items.filter((i) => i.name.toLowerCase().includes(query))
    : month.items;
  const lock = useRef(0);
  const wasAllPaid = useRef(totals.count > 0 && totals.paidCount === totals.count);

  // Collapsing grows the scroll viewport, which can clamp scrollTop back down
  // and bounce the state. Guards: only collapse a list long enough to be worth
  // it, hold the new state briefly, and re-check once the transition settles.
  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const y = el.scrollTop;
    const overflow = el.scrollHeight - el.clientHeight;

    if (!min && y > 30 && overflow > 180) {
      setMin(true);
      lock.current = performance.now() + 300;
      window.setTimeout(() => {
        const after = scrollerRef.current;
        if (after && after.scrollHeight - after.clientHeight < 8) setMin(false);
      }, 520);
    } else if (min && y < 4 && performance.now() > lock.current) {
      setMin(false);
    }
  }, [min, scrollerRef]);

  const shown = useCountUp(totals.left);
  const allPaid = totals.count > 0 && totals.paidCount === totals.count;
  const remaining = totals.total > 0 ? totals.left / totals.total : 0;
  const pace = pacing(monthKey, totals.left);

  // Fire the celebration on the transition into "everything paid", not on
  // every render where it happens to be true.
  useEffect(() => {
    if (allPaid && !wasAllPaid.current) {
      setParty(true);
      HAPTIC.success();
    }
    wasAllPaid.current = allPaid;
  }, [allPaid]);

  const handleToggle = (item: Outgoing) => togglePaid(item.id);

  const handleDelete = (item: Outgoing) => {
    deleteItem(item.id);
    toast({ message: `Deleted ${item.name}`, action: { label: 'Undo', run: undo } });
  };

  const payAll = () => {
    HAPTIC.success();
    setAllPaid(true);
    toast({ message: 'Everything marked paid', action: { label: 'Undo', run: undo } });
  };

  const resetAll = () => {
    HAPTIC.light();
    setAllPaid(false);
    toast({ message: 'Everything marked unpaid', action: { label: 'Undo', run: undo } });
  };

  return (
    <>
      {party && <Celebration onDone={() => setParty(false)} />}

      <div className="sub">
        <MonthSwitcher />

        <div className="hero" data-min={min}>
          <Gauge remaining={remaining}>
            <div className="gauge-cap-label">{allPaid ? 'All settled' : 'Left to pay'}</div>
            <div className="figure n">
              {moneyParts(shown).major}
              <i>{moneyParts(shown).minor}</i>
            </div>
            {pace ? (
              <div className="pace n">
                <b>{moneyCompact(pace.perDay)}</b> a day for {pace.daysLeft} days
              </div>
            ) : (
              <div className="pace n">
                {totals.paidCount} of {totals.count} paid
              </div>
            )}
          </Gauge>
        </div>

        <div className="mini" data-show={min}>
          <div>
            <div className="mini-lab">Left to pay</div>
            <div className="mini-fig n">{money(totals.left)}</div>
          </div>
          <div className="mini-bar">
            <i style={{ width: `${Math.round(totals.progress * 100)}%` }} />
          </div>
          <div className="mini-lab n">
            {totals.paidCount}/{totals.count}
          </div>
        </div>
      </div>

      <div className="scroll" ref={scrollerRef} onScroll={onScroll}>
        <SalaryDuo leftOver={totals.leftOver} />

        {safe && <SafeCard safe={safe} />}

        {untilPay !== null && (
          <div className="payday">
            <Wallet size={17} />
            <span>
              {untilPay === 0 ? 'Payday today' : `Payday in ${untilPay} day${untilPay === 1 ? '' : 's'}`}
            </span>
          </div>
        )}

        <div className="quick">
          <button className="key" onClick={onAdd}>
            <Plus size={17} />
            Add
          </button>
          <button className="pay" onClick={payAll}>
            <CheckAll size={17} />
            Pay all
          </button>
          <button onClick={resetAll}>
            <Rotate size={17} />
            Reset
          </button>
        </div>

        <div className="sec">
          <h3>Outgoings</h3>
          <div className="seg sm">
            <button data-on={mode === 'order'} onClick={() => setMode('order')}>
              Order
            </button>
            <button data-on={mode === 'due'} onClick={() => setMode('due')}>
              Due date
            </button>
          </div>
        </div>

        {month.items.length > 6 && (
          <input
            className="in search"
            value={q}
            placeholder="Search outgoings"
            autoComplete="off"
            aria-label="Search outgoings"
            onChange={(e) => setQ(e.target.value)}
          />
        )}

        {month.items.length === 0 ? (
          <div className="blank">
            <h4>Nothing going out</h4>
            <p>Add your first bill, loan or subscription and it&apos;ll show up here.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="blank">
            <h4>No matches</h4>
            <p>Nothing here matches &ldquo;{q.trim()}&rdquo;.</p>
          </div>
        ) : (
          <Ledger
            items={filtered}
            mode={mode}
            monthKey={monthKey}
            scrollerRef={scrollerRef}
            disableDrag={query.length > 0}
            onToggle={handleToggle}
            onEdit={onEdit}
            onDelete={handleDelete}
            onReorder={reorder}
          />
        )}

        <div className="sec">
          <h3>Trend</h3>
        </div>
        <Sparkline points={history(store, monthKey)} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------ */

function SafeCard({ safe }: { safe: NonNullable<ReturnType<typeof safeToSpend>> }) {
  // Stacked bar: how much of the salary is already committed (bills) or spent.
  const base = Math.max(safe.salary, safe.bills + safe.spent, 1);
  const billsPct = Math.min(100, (safe.bills / base) * 100);
  const spentPct = Math.min(100 - billsPct, (safe.spent / base) * 100);
  const over = safe.safe < 0;
  return (
    <div className="safe" data-over={over}>
      <div className="safe-top">
        <span className="safe-lab">Safe to spend</span>
        {safe.perDay != null && (
          <span className="safe-per n">{money(safe.perDay)}/day</span>
        )}
      </div>
      <div className={`safe-fig n ${over ? 'down' : 'up'}`}>{money(safe.safe)}</div>
      <div className="safe-bar" aria-hidden="true">
        <i className="seg-bills" style={{ width: `${billsPct}%` }} />
        <i className="seg-spent" style={{ width: `${spentPct}%` }} />
      </div>
      <div className="safe-legend n">
        <span>
          <b>{moneyCompact(safe.bills)}</b> bills
        </span>
        <span>
          <b>{moneyCompact(safe.spent)}</b> spent
        </span>
        <span>
          {over ? 'over by ' : ''}
          <b>{moneyCompact(Math.abs(safe.safe))}</b> {over ? '' : 'left'}
        </span>
      </div>
    </div>
  );
}

function SalaryDuo({ leftOver }: { leftOver: number }) {
  const { month, setSalary } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  const start = () => {
    setDraft(month.salary ? String(month.salary) : '');
    setEditing(true);
    requestAnimationFrame(() => ref.current?.select());
  };

  const commit = () => {
    const v = parseFloat(draft.replace(/[^0-9.]/g, ''));
    setSalary(Number.isFinite(v) ? v : 0);
    setEditing(false);
  };

  return (
    <div className="duo">
      <button onClick={start} style={{ textAlign: 'left' }}>
        <div className="duo-k">Salary in</div>
        {editing ? (
          <input
            ref={ref}
            className="duo-v n"
            style={{ width: '100%' }}
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setEditing(false);
            }}
            aria-label="Monthly salary"
          />
        ) : (
          <div className="duo-v n">{moneyCompact(month.salary)}</div>
        )}
      </button>

      <div className="rule" />

      <div>
        <div className="duo-k">Left over</div>
        <div className={`duo-v n ${leftOver >= 0 ? 'up' : 'down'}`}>{moneyCompact(leftOver)}</div>
      </div>
    </div>
  );
}

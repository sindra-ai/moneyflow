'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { computeTotals, useStore } from '@/lib/store';
import { money, moneyCompact, moneyParts } from '@/lib/format';
import { history, pacing } from '@/lib/derive';
import { useCountUp } from '@/lib/useCountUp';
import { HAPTIC } from '@/lib/haptics';
import type { Outgoing } from '@/lib/types';
import { MonthSwitcher } from './MonthSwitcher';
import { Gauge } from './Gauge';
import { Sparkline } from './Sparkline';
import { Ledger } from './Ledger';
import { Celebration } from './Celebration';
import { useToast } from './Toast';
import { CheckAll, Plus, Rotate } from './icons';

interface Props {
  scrollerRef: RefObject<HTMLDivElement>;
  onAdd: () => void;
  onEdit: (item: Outgoing) => void;
}

export function HomeView({ scrollerRef, onAdd, onEdit }: Props) {
  const { store, month, monthKey, togglePaid, setAllPaid, reorder, deleteItem, undo } = useStore();
  const totals = computeTotals(month, store.settings.usdToGbp);
  const toast = useToast();

  const [min, setMin] = useState(false);
  const [mode, setMode] = useState<'order' | 'due'>('order');
  const [party, setParty] = useState(false);
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

        <div className="quick">
          <button className="key" onClick={onAdd}>
            <Plus size={17} />
            Add
          </button>
          <button onClick={payAll}>
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

        {month.items.length === 0 ? (
          <div className="blank">
            <h4>Nothing going out</h4>
            <p>Add your first bill, loan or subscription and it&apos;ll show up here.</p>
          </div>
        ) : (
          <Ledger
            items={month.items}
            mode={mode}
            monthKey={monthKey}
            scrollerRef={scrollerRef}
            usdToGbp={store.settings.usdToGbp}
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

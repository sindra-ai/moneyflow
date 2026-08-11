'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { daysInMonth, firstWeekdayOf, monthKeyOf, useStore } from '@/lib/store';
import { initial, money, ordinal } from '@/lib/format';
import { HAPTIC } from '@/lib/haptics';
import type { Outgoing } from '@/lib/types';
import { MonthSwitcher } from './MonthSwitcher';
import { Check, ChevronUp } from './icons';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const GAP = 3;

interface Props {
  scrollerRef: RefObject<HTMLDivElement>;
  onEdit: (item: Outgoing) => void;
}

export function CalendarView({ scrollerRef, onEdit }: Props) {
  const { month, monthKey, togglePaid, store } = useStore();

  const total = daysInMonth(monthKey);
  const lead = firstWeekdayOf(monthKey);
  const todayDay = monthKey === monthKeyOf() ? new Date().getDate() : null;

  const [picked, setPicked] = useState<number>(todayDay ?? 1);
  const [folded, setFolded] = useState(false);

  useEffect(() => {
    setPicked(monthKey === monthKeyOf() ? new Date().getDate() : 1);
  }, [monthKey]);

  /* --------------------------------------------------------- week model */

  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const pickedWeek = Math.max(0, Math.floor((lead + picked - 1) / 7));

  const innerRef = useRef<HTMLDivElement>(null);
  const [rowH, setRowH] = useState(0);

  useLayoutEffect(() => {
    const first = innerRef.current?.firstElementChild as HTMLElement | null;
    if (first) setRowH(first.getBoundingClientRect().height);
  }, [weeks.length, monthKey]);

  const fullH = rowH ? weeks.length * rowH + (weeks.length - 1) * GAP : undefined;
  const freed = fullH && rowH ? fullH - rowH : 0;
  const lock = useRef(0);

  /**
   * Folds to the selected week as you scroll into the list.
   *
   * Folding grows the scroll viewport by `freed`, which can clamp scrollTop
   * back to the top and bounce the state. Requiring more overflow than the
   * fold releases guarantees there's still something to scroll afterwards, so
   * it settles instead of oscillating.
   */
  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || !freed) return;
    const y = el.scrollTop;
    const overflow = el.scrollHeight - el.clientHeight;

    if (!folded && y > 24 && overflow > freed + 60) {
      setFolded(true);
      lock.current = performance.now() + 320;
    } else if (folded && y < 4 && performance.now() > lock.current) {
      setFolded(false);
    }
  }, [folded, freed, scrollerRef]);

  /* -------------------------------------------------------------- lists */

  const byDay = new Map<number, Outgoing[]>();
  const undated: Outgoing[] = [];
  for (const it of month.items) {
    if (it.dueDay == null) undated.push(it);
    else {
      // A 31st bill in a 30-day month still needs somewhere to live.
      const day = Math.min(it.dueDay, total);
      const list = byDay.get(day);
      if (list) list.push(it);
      else byDay.set(day, [it]);
    }
  }

  const due = byDay.get(picked) ?? [];
  const dueTotal = due.reduce(
    (s, i) => s + (i.currency === 'USD' ? i.amount * store.settings.usdToGbp : i.amount),
    0,
  );

  return (
    <>
      <div className="sub">
        <MonthSwitcher />

        <div className="cal" data-folded={folded}>
          <div className="cal-top">
            <h3>Payment calendar</h3>
            <button
              className="cal-fold"
              data-folded={folded}
              onClick={() => {
                HAPTIC.light();
                setFolded((f) => !f);
              }}
            >
              {folded ? 'Month' : 'Week'}
              <ChevronUp size={13} />
            </button>
          </div>

          <div className="cal-grid" aria-hidden="true">
            {DOW.map((d, i) => (
              <div className="dow" key={i}>
                {d}
              </div>
            ))}
          </div>

          <div className="weeks" style={{ maxHeight: folded ? rowH || undefined : fullH }}>
            <div
              className="weeks-in"
              ref={innerRef}
              style={{
                transform: folded ? `translateY(${-pickedWeek * (rowH + GAP)}px)` : undefined,
              }}
            >
              {weeks.map((week, w) => (
                <div className="cal-grid" key={w}>
                  {week.map((day, i) => {
                    if (day == null) return <div className="day void" key={i} />;
                    const list = byDay.get(day) ?? [];
                    return (
                      <button
                        key={i}
                        className={`day${day === todayDay ? ' today' : ''}`}
                        data-on={day === picked}
                        onClick={() => {
                          HAPTIC.light();
                          setPicked(day);
                        }}
                      >
                        <span>{day}</span>
                        <span className="pips">
                          {list.slice(0, 3).map((it) => (
                            <span
                              key={it.id}
                              className="pip"
                              style={{ background: it.accent, opacity: it.paid ? 0.3 : 1 }}
                            />
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="scroll" ref={scrollerRef} onScroll={onScroll}>
        <div className="sec">
          <h3>Due {ordinal(picked)}</h3>
          {due.length > 0 && <span className="n">{money(dueTotal)}</span>}
        </div>

        {due.length === 0 ? (
          <div className="blank">
            <h4>Nothing due</h4>
            <p>No outgoings are set for the {ordinal(picked)}.</p>
          </div>
        ) : (
          <div className="group">
            {due.map((it) => (
              <Line
                key={it.id}
                item={it}
                usdToGbp={store.settings.usdToGbp}
                onToggle={togglePaid}
                onEdit={onEdit}
              />
            ))}
          </div>
        )}

        {undated.length > 0 && (
          <>
            <div className="sec">
              <h3>No date set</h3>
              <span className="n">{undated.length}</span>
            </div>
            <div className="group">
              {undated.map((it) => (
                <Line
                  key={it.id}
                  item={it}
                  usdToGbp={store.settings.usdToGbp}
                  onToggle={togglePaid}
                  onEdit={onEdit}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------ */

function Line({
  item,
  usdToGbp,
  onToggle,
  onEdit,
}: {
  item: Outgoing;
  usdToGbp: number;
  onToggle: (id: string) => void;
  onEdit: (item: Outgoing) => void;
}) {
  return (
    <div className="swipe">
      <div className={`row enter${item.paid ? ' done' : ''}`} onClick={() => onEdit(item)}>
        <div
          className="glyph"
          style={{
            background: `color-mix(in srgb, ${item.accent} 16%, transparent)`,
            color: item.accent,
          }}
          aria-hidden="true"
        >
          {initial(item.name)}
        </div>
        <div className="rbody">
          <div className="rname">{item.name}</div>
          {item.note && <div className="rmeta">{item.note}</div>}
        </div>
        <div className="ramt n">
          {money(item.amount, item.currency)}
          {item.currency === 'USD' && <small>≈ {money(item.amount * usdToGbp, 'GBP')}</small>}
        </div>
        <button
          className="tick"
          aria-label={item.paid ? `Mark ${item.name} unpaid` : `Mark ${item.name} paid`}
          aria-pressed={item.paid}
          onClick={(e) => {
            e.stopPropagation();
            HAPTIC.select();
            onToggle(item.id);
          }}
        >
          <Check size={14} />
        </button>
      </div>
    </div>
  );
}

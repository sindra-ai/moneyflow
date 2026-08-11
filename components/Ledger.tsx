'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Outgoing } from '@/lib/types';
import { initial, money, ordinal } from '@/lib/format';
import { HAPTIC } from '@/lib/haptics';
import { groupByDue } from '@/lib/derive';
import { Check } from './icons';

const HOLD_TOUCH = 240;
const HOLD_MOUSE = 160;
const AXIS_LOCK = 9;
const SWIPE_TRIGGER = 92;
const RUBBER_FROM = 88;
const RUBBER = 0.34;
const EDGE = 74;
const EDGE_SPEED = 9;

interface Drag {
  from: number;
  to: number;
  dy: number;
  height: number;
}

interface Props {
  items: Outgoing[];
  /** 'order' keeps the user's manual sequence and allows drag; 'due' groups. */
  mode: 'order' | 'due';
  monthKey: string;
  scrollerRef: RefObject<HTMLElement>;
  /** turn off press-and-hold reorder (e.g. while a search filter is active) */
  disableDrag?: boolean;
  onToggle: (item: Outgoing) => void;
  onEdit: (item: Outgoing) => void;
  onDelete: (item: Outgoing) => void;
  onReorder: (from: number, to: number) => void;
}

export function Ledger({
  items,
  mode,
  monthKey,
  scrollerRef,
  disableDrag = false,
  onToggle,
  onEdit,
  onDelete,
  onReorder,
}: Props) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [swipe, setSwipe] = useState<{ id: string; dx: number } | null>(null);

  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const hold = useRef<number | null>(null);
  const axis = useRef<'x' | 'y' | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const startScroll = useRef(0);
  const centers = useRef<number[]>([]);
  const lastY = useRef(0);
  const raf = useRef(0);
  const dragRef = useRef<Drag | null>(null);
  const swipeRef = useRef<{ id: string; dx: number } | null>(null);
  const blockClick = useRef(false);

  dragRef.current = drag;
  swipeRef.current = swipe;

  const canDrag = mode === 'order' && !disableDrag;

  const clearHold = useCallback(() => {
    if (hold.current) {
      window.clearTimeout(hold.current);
      hold.current = null;
    }
  }, []);

  /* ------------------------------------------------------------ reorder */

  const beginDrag = useCallback((index: number) => {
    const el = rows.current[index];
    const scroller = scrollerRef.current;
    if (!el || !scroller) return;

    centers.current = rows.current.map((r) => {
      if (!r) return 0;
      const box = r.getBoundingClientRect();
      return box.top + box.height / 2;
    });
    startScroll.current = scroller.scrollTop;

    HAPTIC.select();
    setDrag({ from: index, to: index, dy: 0, height: el.getBoundingClientRect().height });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A single rAF loop owns follow-the-finger and edge auto-scroll, so holding
  // still near an edge keeps scrolling.
  useEffect(() => {
    if (!drag) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const step = () => {
      const box = scroller.getBoundingClientRect();
      const y = lastY.current;

      if (y < box.top + EDGE) scroller.scrollTop -= EDGE_SPEED;
      else if (y > box.bottom - EDGE) scroller.scrollTop += EDGE_SPEED;

      const cur = dragRef.current;
      if (cur) {
        const dy = y - start.current.y + (scroller.scrollTop - startScroll.current);
        const mid = centers.current[cur.from] + dy;
        let to = cur.from;
        while (to > 0 && mid < centers.current[to - 1]) to -= 1;
        while (to < centers.current.length - 1 && mid > centers.current[to + 1]) to += 1;

        if (to !== cur.to) HAPTIC.light();
        if (dy !== cur.dy || to !== cur.to) setDrag({ ...cur, dy, to });
      }
      raf.current = requestAnimationFrame(step);
    };

    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [drag !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const endDrag = useCallback(() => {
    const cur = dragRef.current;
    if (!cur) return;
    if (cur.to !== cur.from) {
      HAPTIC.success();
      onReorder(cur.from, cur.to);
    }
    blockClick.current = true;
    window.setTimeout(() => {
      blockClick.current = false;
    }, 320);
    setDrag(null);
  }, [onReorder]);

  // Blocking native scroll during a drag needs a non-passive listener.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      lastY.current = e.touches[0].clientY;
    };
    const onMouse = (e: MouseEvent) => {
      lastY.current = e.clientY;
    };
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', endDrag);
    document.addEventListener('touchcancel', endDrag);
    document.addEventListener('mousemove', onMouse);
    document.addEventListener('mouseup', endDrag);
    return () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', endDrag);
      document.removeEventListener('touchcancel', endDrag);
      document.removeEventListener('mousemove', onMouse);
      document.removeEventListener('mouseup', endDrag);
    };
  }, [drag !== null, endDrag]); // eslint-disable-line react-hooks/exhaustive-deps

  // Any scroll before the hold completes means the user meant to scroll.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const cancel = () => {
      if (!dragRef.current) clearHold();
    };
    scroller.addEventListener('scroll', cancel, { passive: true });
    return () => scroller.removeEventListener('scroll', cancel);
  }, [scrollerRef, clearHold]);

  useEffect(() => () => clearHold(), [clearHold]);

  /* -------------------------------------------------------------- swipe */

  const onTouchStart = (e: React.TouchEvent, index: number) => {
    if ((e.target as HTMLElement).closest('.tick')) return;
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
    lastY.current = t.clientY;
    axis.current = null;
    clearHold();
    if (canDrag) hold.current = window.setTimeout(() => beginDrag(index), HOLD_TOUCH);
  };

  const onTouchMove = (e: React.TouchEvent, item: Outgoing) => {
    if (dragRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;

    if (!axis.current) {
      if (Math.abs(dx) > AXIS_LOCK && Math.abs(dx) > Math.abs(dy)) {
        axis.current = 'x';
        clearHold();
      } else if (Math.abs(dy) > AXIS_LOCK) {
        axis.current = 'y';
        clearHold();
        return;
      } else {
        return;
      }
    }
    if (axis.current !== 'x') return;

    // touch-action:pan-y already denies the browser this gesture, so the row
    // can follow the finger without preventDefault on a passive listener.
    const mag = Math.abs(dx);
    const eased =
      mag <= RUBBER_FROM ? mag : RUBBER_FROM + (mag - RUBBER_FROM) * RUBBER;
    setSwipe({ id: item.id, dx: Math.sign(dx) * eased });
  };

  const onTouchEnd = (item: Outgoing) => {
    clearHold();
    const cur = swipeRef.current;
    axis.current = null;
    if (!cur || cur.id !== item.id) return;

    if (cur.dx > SWIPE_TRIGGER) {
      HAPTIC.success();
      onToggle(item);
    } else if (cur.dx < -SWIPE_TRIGGER) {
      HAPTIC.success();
      onDelete(item);
    }
    setSwipe(null);
  };

  const onMouseDown = (e: React.MouseEvent, index: number) => {
    if (!canDrag || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.tick')) return;
    start.current = { x: e.clientX, y: e.clientY };
    lastY.current = e.clientY;
    clearHold();
    hold.current = window.setTimeout(() => beginDrag(index), HOLD_MOUSE);
  };

  /* ------------------------------------------------------------- render */

  const shiftFor = (i: number) => {
    if (!drag || i === drag.from) return 0;
    const d = drag.height;
    if (drag.to > drag.from && i > drag.from && i <= drag.to) return -d;
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return d;
    return 0;
  };

  const renderRow = (item: Outgoing, index: number, stagger: number) => {
    const dragging = drag?.from === index;
    const shift = shiftFor(index);
    const dx = swipe?.id === item.id ? swipe.dx : 0;

    const meta: string[] = [];
    if (item.dueDay) meta.push(`Due ${ordinal(item.dueDay)}`);
    if (item.note) meta.push(item.note);

    return (
      <div
        className="swipe"
        key={item.id}
        data-swiping={dx !== 0}
        data-dragging={dragging}
      >
        {/* Only mounted mid-swipe — otherwise they'd show through the row. */}
        {dx > 0 && <div className="swipe-act pay">{item.paid ? 'Unpay' : 'Paid'}</div>}
        {dx < 0 && <div className="swipe-act del">Delete</div>}

        <div
          ref={(el) => {
            rows.current[index] = el;
          }}
          className={[
            'row',
            'enter',
            item.paid ? 'done' : '',
            dragging ? 'drag-lift' : '',
            !dragging && (drag || !dx) ? 'slide' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            animationDelay: `${Math.min(stagger, 10) * 30}ms`,
            transform: dragging
              ? `translateY(${drag!.dy}px) scale(1.055)`
              : dx
                ? `translateX(${dx}px)`
                : shift
                  ? `translateY(${shift}px)`
                  : undefined,
          }}
          onTouchStart={(e) => onTouchStart(e, index)}
          onTouchMove={(e) => onTouchMove(e, item)}
          onTouchEnd={() => onTouchEnd(item)}
          onTouchCancel={() => onTouchEnd(item)}
          onMouseDown={(e) => onMouseDown(e, index)}
          onMouseUp={clearHold}
          onMouseLeave={clearHold}
          onClick={() => {
            if (blockClick.current || drag || swipe) return;
            onEdit(item);
          }}
        >
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
            {meta.length > 0 && <div className="rmeta">{meta.join(' · ')}</div>}
          </div>

          <div className="ramt n">{money(item.amount)}</div>

          <button
            className="tick"
            aria-label={item.paid ? `Mark ${item.name} unpaid` : `Mark ${item.name} paid`}
            aria-pressed={item.paid}
            onClick={(e) => {
              e.stopPropagation();
              HAPTIC.select();
              onToggle(item);
            }}
          >
            <Check size={14} />
          </button>
        </div>
      </div>
    );
  };

  if (mode === 'order') {
    return <div className="group">{items.map((it, i) => renderRow(it, i, i))}</div>;
  }

  // Grouped view indexes into the flat array so callbacks stay consistent.
  const indexOf = new Map(items.map((it, i) => [it.id, i]));
  let seen = 0;

  return (
    <>
      {groupByDue(items, monthKey).map((g) => (
        <div key={g.key}>
          <div className="sec">
            <h3>{g.title}</h3>
            <span className="n">{g.items.length}</span>
          </div>
          <div className="group">
            {g.items.map((it) => renderRow(it, indexOf.get(it.id)!, seen++))}
          </div>
        </div>
      ))}
    </>
  );
}

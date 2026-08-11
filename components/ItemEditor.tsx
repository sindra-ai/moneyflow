'use client';

import { useEffect, useRef, useState } from 'react';
import type { Category, Outgoing } from '@/lib/types';
import { ACCENTS, CATEGORIES } from '@/lib/types';
import { HAPTIC } from '@/lib/haptics';
import { Close, Trash } from './icons';

const CLOSE_MS = 520;
const DISMISS_PX = 110;

export interface EditorTarget {
  /** null = adding a new outgoing */
  item: Outgoing | null;
}

interface Props {
  target: EditorTarget;
  onClose: () => void;
  onSave: (data: Omit<Outgoing, 'id'>, id: string | null) => void;
  onDelete: (id: string) => void;
}

export function ItemEditor({ target, onClose, onSave, onDelete }: Props) {
  const existing = target.item;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [dueDay, setDueDay] = useState<number | null>(existing?.dueDay ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [accent, setAccent] = useState(existing?.accent ?? ACCENTS[0]);
  const [category, setCategory] = useState<Category>(existing?.category ?? 'Bills');
  const [recurring, setRecurring] = useState(existing?.recurring ?? true);
  const [confirm, setConfirm] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);
  const daysRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const timer = useRef<number | null>(null);

  const dragFrom = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  // Slide in after mount so the transition has a start value to move from.
  // rAF alone stalls in a background tab, so a timer backs it up.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    const t = window.setTimeout(() => setOpen(true), 32);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, []);

  // Centre the selected day chip without scrolling any ancestor.
  useEffect(() => {
    const wrap = daysRef.current;
    if (!wrap || dueDay == null) return;
    const chip = wrap.querySelector<HTMLElement>(`[data-day="${dueDay}"]`);
    if (chip) wrap.scrollLeft = chip.offsetLeft - wrap.clientWidth / 2 + chip.clientWidth / 2;
  }, [dueDay]);

  /**
   * Close is driven by our own state rather than a library's exit animation,
   * with a timeout fallback so a missed transitionend can never strand the
   * sheet on screen.
   */
  const requestClose = () => {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    timer.current = window.setTimeout(onClose, CLOSE_MS);
  };

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const onTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== sheetRef.current || e.propertyName !== 'transform') return;
    if (closing.current) {
      if (timer.current) window.clearTimeout(timer.current);
      onClose();
    }
  };

  const save = () => {
    const parsed = parseFloat(amount.replace(/[^0-9.]/g, ''));
    onSave(
      {
        name: name.trim() || 'Untitled',
        amount: Number.isFinite(parsed) ? parsed : 0,
        dueDay,
        note: note.trim(),
        paid: existing?.paid ?? false,
        accent,
        category,
        recurring,
      },
      existing?.id ?? null,
    );
    HAPTIC.success();
    requestClose();
  };

  /* ------------------------------------------------------- drag to close */

  const gripStart = (e: React.TouchEvent) => {
    dragFrom.current = e.touches[0].clientY;
  };

  const gripMove = (e: React.TouchEvent) => {
    if (dragFrom.current == null) return;
    setDragY(Math.max(0, e.touches[0].clientY - dragFrom.current));
  };

  const gripEnd = () => {
    if (dragFrom.current == null) return;
    dragFrom.current = null;
    const should = dragY > DISMISS_PX;
    setDragY(0);
    if (should) requestClose();
  };

  const dragging = dragFrom.current != null;

  return (
    <>
      <div className="veil" data-on={open} onClick={requestClose} aria-hidden="true" />

      <div
        ref={sheetRef}
        className="sheet"
        data-on={open}
        role="dialog"
        aria-modal="true"
        aria-label={existing ? 'Edit outgoing' : 'Add outgoing'}
        onTransitionEnd={onTransitionEnd}
        style={
          dragY
            ? {
                transform: `translate(-50%, ${dragY}px)`,
                transition: dragging ? 'none' : undefined,
              }
            : undefined
        }
      >
        <div
          className="grip"
          onTouchStart={gripStart}
          onTouchMove={gripMove}
          onTouchEnd={gripEnd}
          onTouchCancel={gripEnd}
        >
          <span />
        </div>

        <div
          className="sheet-top"
          onTouchStart={gripStart}
          onTouchMove={gripMove}
          onTouchEnd={gripEnd}
          onTouchCancel={gripEnd}
        >
          <h2>{existing ? 'Edit outgoing' : 'New outgoing'}</h2>
          <button className="ghost-btn" onClick={requestClose} aria-label="Close">
            <Close size={17} />
          </button>
        </div>

        <div className="sheet-body">
          <div className="f">
            <label className="f-k" htmlFor="f-name">
              Name
            </label>
            <input
              id="f-name"
              className="in"
              value={name}
              placeholder="e.g. Everyday Loans"
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="f">
            <label className="f-k" htmlFor="f-amount">
              Amount
            </label>
            <div className="amt-wrap">
              <span className="amt-sym" aria-hidden="true">
                £
              </span>
              <input
                id="f-amount"
                className="in n amt-in"
                value={amount}
                placeholder="0.00"
                inputMode="decimal"
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="f">
            <span className="f-k">Due day</span>
            <div className="days" ref={daysRef}>
              <button
                className="chip"
                data-on={dueDay === null}
                onClick={() => {
                  HAPTIC.light();
                  setDueDay(null);
                }}
              >
                None
              </button>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <button
                  key={d}
                  className="chip n"
                  data-day={d}
                  data-on={dueDay === d}
                  onClick={() => {
                    HAPTIC.light();
                    setDueDay(d);
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="f">
            <label className="f-k" htmlFor="f-note">
              Note
            </label>
            <input
              id="f-note"
              className="in"
              value={note}
              placeholder="Optional"
              autoComplete="off"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="f">
            <span className="f-k">Category</span>
            <div className="days">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  className="chip"
                  data-on={category === c}
                  onClick={() => {
                    HAPTIC.light();
                    setCategory(c);
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="f">
            <button
              type="button"
              className="toggle-row"
              onClick={() => {
                HAPTIC.light();
                setRecurring((r) => !r);
              }}
            >
              <div>
                <div className="f-k" style={{ marginBottom: 2 }}>
                  Repeats monthly
                </div>
                <div className="toggle-sub">
                  {recurring ? 'Carries into every month' : 'One-off — this month only'}
                </div>
              </div>
              <span className="switch" data-on={recurring} aria-hidden="true">
                <i />
              </span>
            </button>
          </div>

          <div className="f">
            <span className="f-k">Colour</span>
            <div className="dots">
              {ACCENTS.map((a) => (
                <button
                  key={a}
                  className="dot-pick"
                  data-on={accent === a}
                  style={{ background: a }}
                  aria-label={`Accent ${a}`}
                  onClick={() => {
                    HAPTIC.light();
                    setAccent(a);
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="sheet-foot">
          {existing && (
            <button
              className="btn btn-sub"
              data-confirm={confirm}
              onClick={() => {
                if (!confirm) {
                  setConfirm(true);
                  HAPTIC.light();
                  return;
                }
                HAPTIC.success();
                onDelete(existing.id);
                requestClose();
              }}
            >
              {confirm ? 'Delete' : <Trash size={18} />}
            </button>
          )}
          <button className="btn btn-key" onClick={save}>
            {existing ? 'Save' : 'Add outgoing'}
          </button>
        </div>
      </div>
    </>
  );
}

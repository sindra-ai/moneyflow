"use client";

import React, { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Currency, Outgoing } from "@/lib/types";
import { ACCENTS } from "@/lib/seed";
import type { EditorTarget } from "./AppShell";
import { Trash } from "./icons";

export default function ItemEditor({
  target,
  onClose,
}: {
  target: EditorTarget;
  onClose: () => void;
}) {
  const { addItem, updateItem, deleteItem } = useStore();
  const isEdit = target.mode === "edit";
  const existing = isEdit ? target.item : null;

  const [closing, setClosing] = useState(false);

  // Drag-to-dismiss state
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ y: number; active: boolean }>({ y: 0, active: false });
  const [dragY, setDragY] = useState(0);
  const [released, setReleased] = useState(false);

  const [name, setName] = useState(existing?.name ?? "");
  const [amount, setAmount] = useState(
    existing ? String(existing.amount) : ""
  );
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? "GBP");
  const [dueDay, setDueDay] = useState<string>(
    existing?.dueDay
      ? String(existing.dueDay)
      : target.mode === "add" && target.presetDay
      ? String(target.presetDay)
      : ""
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const [accent, setAccent] = useState(
    existing?.accent ?? ACCENTS[Math.floor(Math.random() * ACCENTS.length) % ACCENTS.length]
  );

  // Lock body scroll while sheet is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Slide the sheet down and off, then unmount. Used by the close button,
  // the scrim tap, and a completed drag-dismiss.
  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    setReleased(true);
    setDragY((sheetRef.current?.offsetHeight ?? 600) + 60);
    window.setTimeout(onClose, 340); // fallback if transitionend doesn't fire
  };

  // --- Drag-to-dismiss (touch) on the sheet handle ---
  const onDragStart = (e: React.TouchEvent) => {
    if (closing) return;
    dragStart.current = { y: e.touches[0].clientY, active: true };
    setReleased(false);
  };
  const onDragMove = (e: React.TouchEvent) => {
    if (!dragStart.current.active) return;
    const dy = e.touches[0].clientY - dragStart.current.y;
    setDragY(Math.max(0, dy));
  };
  const onDragEnd = () => {
    if (!dragStart.current.active) return;
    dragStart.current.active = false;
    setReleased(true);
    if (dragY > 110) requestClose();
    else setDragY(0); // snap back
  };

  const nameValid = name.trim().length > 0;
  const amountNum = parseFloat(amount.replace(/[^0-9.]/g, ""));
  const amountValid = Number.isFinite(amountNum) && amountNum >= 0;
  const canSave = nameValid && amountValid;

  const save = () => {
    if (!canSave) return;
    let day: number | null = null;
    const d = parseInt(dueDay, 10);
    if (Number.isFinite(d)) day = Math.min(31, Math.max(1, d));

    const payload: Omit<Outgoing, "id"> = {
      name: name.trim(),
      amount: Math.round(amountNum * 100) / 100,
      currency,
      dueDay: day,
      note: note.trim(),
      paid: existing?.paid ?? false,
      accent,
    };

    if (isEdit && existing) updateItem(existing.id, payload);
    else addItem(payload);
    requestClose();
  };

  const remove = () => {
    if (existing) deleteItem(existing.id);
    requestClose();
  };

  return (
    <div
      className={"scrim" + (closing ? " closing" : "")}
      onClick={requestClose}
    >
      <div
        ref={sheetRef}
        className="sheet"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: released ? "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
        }}
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={() => {
          if (closing) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit outgoing" : "Add outgoing"}
      >
        <div
          className="sheet-handle"
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
        >
          <div className="grabber" />
          <h3>{isEdit ? "Edit outgoing" : "New outgoing"}</h3>
        </div>

        <div className="field">
          <label htmlFor="f-name">Name</label>
          <input
            id="f-name"
            className="input"
            value={name}
            placeholder="e.g. Rent"
            autoFocus={!isEdit}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="row-2">
          <div className="field">
            <label htmlFor="f-amount">Amount</label>
            <input
              id="f-amount"
              className="input tnum"
              inputMode="decimal"
              value={amount}
              placeholder="0.00"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Currency</label>
            <div className="seg">
              {(["GBP", "USD"] as Currency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={currency === c ? "on" : ""}
                  onClick={() => setCurrency(c)}
                >
                  {c === "GBP" ? "£ GBP" : "$ USD"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="row-2">
          <div className="field">
            <label htmlFor="f-day">Due day of month</label>
            <input
              id="f-day"
              className="input tnum"
              inputMode="numeric"
              value={dueDay}
              placeholder="e.g. 1"
              onChange={(e) => setDueDay(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
            />
          </div>
          <div className="field">
            <label htmlFor="f-note">Note</label>
            <input
              id="f-note"
              className="input"
              value={note}
              placeholder="optional"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label>Colour</label>
          <div className="swatches">
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`accent ${c}`}
                className={"swatch" + (accent === c ? " on" : "")}
                style={{ background: c }}
                onClick={() => setAccent(c)}
              />
            ))}
          </div>
        </div>

        <button className="btn-primary" disabled={!canSave} onClick={save} style={{ opacity: canSave ? 1 : 0.5 }}>
          {isEdit ? "Save changes" : "Add outgoing"}
        </button>
        {isEdit && (
          <button className="btn-ghost" onClick={remove}>
            <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              <Trash size={18} /> Delete
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

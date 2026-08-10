"use client";

import React, { useEffect, useState } from "react";
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

  // Slide the sheet out, then unmount when the animation ends. A timeout
  // fallback guarantees the sheet still closes if animationend never fires
  // (e.g. reduced-motion or a backgrounded tab).
  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, 380);
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
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={(e) => {
          // Unmount only after the slide-OUT animation finishes.
          if (closing && e.animationName.startsWith("sheetOut")) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit outgoing" : "Add outgoing"}
      >
        <div className="grabber" />
        <h3>{isEdit ? "Edit outgoing" : "New outgoing"}</h3>

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

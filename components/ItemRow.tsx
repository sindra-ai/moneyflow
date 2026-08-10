"use client";

import React from "react";
import { motion } from "framer-motion";
import type { Outgoing } from "@/lib/types";
import { money, ordinal } from "@/lib/format";
import { Check } from "./icons";

export default function ItemRow({
  item,
  onToggle,
  onEdit,
}: {
  item: Outgoing;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const initial = (item.name.trim()[0] ?? "?").toUpperCase();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: -10, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className={"row" + (item.paid ? " paid" : "")}
    >
      <button className="row-tap" onClick={onEdit} aria-label={`Edit ${item.name}`}>
        <span
          className="row-tile"
          style={{
            background: item.accent + "24",
            color: item.accent,
            borderColor: item.accent + "33",
          }}
        >
          {initial}
        </span>
        <span className="body">
          <span className="name">
            <span className="txt">{item.name}</span>
            <span className="strike" aria-hidden />
          </span>
          <span className="meta">
            {item.dueDay ? <span className="pill">Due {ordinal(item.dueDay)}</span> : null}
            {item.currency === "USD" ? <span className="pill">USD</span> : null}
            {item.note ? <span className="note-txt">{item.note}</span> : null}
          </span>
        </span>
        <span className="amt tnum">{money(item.amount, item.currency)}</span>
      </button>

      <button
        className={"check" + (item.paid ? " on" : "")}
        onClick={onToggle}
        role="checkbox"
        aria-checked={item.paid}
        aria-label={item.paid ? `Mark ${item.name} unpaid` : `Mark ${item.name} paid`}
      >
        <Check size={16} />
      </button>
    </motion.div>
  );
}

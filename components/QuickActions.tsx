"use client";

import React from "react";
import { Calendar, Check, Plus, Refresh } from "./icons";

export default function QuickActions({
  onAdd,
  onPayAll,
  onReset,
  onCalendar,
}: {
  onAdd: () => void;
  onPayAll: () => void;
  onReset: () => void;
  onCalendar: () => void;
}) {
  const actions: { key: string; label: string; icon: React.ReactNode; onClick: () => void; primary?: boolean }[] = [
    { key: "add", label: "Add", icon: <Plus size={22} strokeWidth={2.6} />, onClick: onAdd, primary: true },
    { key: "pay", label: "Pay all", icon: <Check size={22} strokeWidth={2.6} />, onClick: onPayAll },
    { key: "cal", label: "Calendar", icon: <Calendar size={21} />, onClick: onCalendar },
    { key: "reset", label: "Reset", icon: <Refresh size={21} />, onClick: onReset },
  ];
  return (
    <div className="quick-actions">
      {actions.map((a) => (
        <button key={a.key} className="qa" onClick={a.onClick}>
          <span className={"qa-ic" + (a.primary ? " primary" : "")}>{a.icon}</span>
          <span className="qa-label">{a.label}</span>
        </button>
      ))}
    </div>
  );
}

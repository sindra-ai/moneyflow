"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/store";
import type { Outgoing } from "@/lib/types";
import {
  daysInMonth,
  firstWeekdayMondayBased,
  money,
  monthKey,
  ordinal,
  toGbp,
} from "@/lib/format";
import MonthSwitcher from "./MonthSwitcher";
import ItemRow from "./ItemRow";
import { Plus } from "./icons";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

export default function CalendarView({
  openAdd,
  openEdit,
}: {
  openAdd: (day?: number | null) => void;
  openEdit: (item: Outgoing) => void;
}) {
  const { items, currentKey, togglePaid, store } = useStore();
  const settings = store.settings;

  const total = daysInMonth(currentKey);
  const lead = firstWeekdayMondayBased(currentKey);
  const todayKey = monthKey(new Date());
  const todayDay = new Date().getDate();

  const byDay = useMemo(() => {
    const map = new Map<number, Outgoing[]>();
    for (const it of items) {
      if (it.dueDay && it.dueDay >= 1 && it.dueDay <= total) {
        const arr = map.get(it.dueDay) ?? [];
        arr.push(it);
        map.set(it.dueDay, arr);
      }
    }
    return map;
  }, [items, total]);

  const undated = useMemo(() => items.filter((it) => !it.dueDay), [items]);

  const [selected, setSelected] = useState<number>(
    currentKey === todayKey ? todayDay : 1
  );

  const selectedItems = byDay.get(selected) ?? [];
  const cells: (number | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  return (
    <div className="view-scroll">
      <header className="topbar">
        <h1>Payment Calendar</h1>
      </header>

      <MonthSwitcher />

      <section className="hero glass" style={{ paddingBottom: 18 }}>
        <div className="cal-grid" style={{ marginTop: 0 }}>
          {DOW.map((d, i) => (
            <div className="cal-dow" key={i}>
              {d}
            </div>
          ))}
        </div>
        <div className="cal-grid">
          {cells.map((day, i) => {
            if (day === null) return <div key={`e${i}`} className="cal-cell empty" />;
            const dayItems = byDay.get(day) ?? [];
            const isToday = currentKey === todayKey && day === todayDay;
            const cls =
              "cal-cell" +
              (dayItems.length ? " has" : "") +
              (selected === day ? " sel" : "") +
              (isToday ? " today" : "");
            return (
              <button key={day} className={cls} onClick={() => setSelected(day)}>
                <span className="d tnum">{day}</span>
                <span className="cal-dots">
                  {dayItems.slice(0, 3).map((it) => (
                    <i
                      key={it.id}
                      style={{ background: it.paid ? "var(--text-faint)" : it.accent }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="section-head">
        <h2 className="tnum">{ordinal(selected)}</h2>
        <span className="count">
          {selectedItems.length
            ? money(selectedItems.reduce((s, it) => s + toGbp(it, settings), 0)) + " due"
            : "Nothing due"}
        </span>
      </div>

      {selectedItems.length === 0 ? (
        <div className="glass-soft empty">
          <div className="emoji">🗓️</div>
          <p>No payments due on the {ordinal(selected)}.</p>
        </div>
      ) : (
        <div className="list">
          <AnimatePresence initial={false}>
            {selectedItems.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                onToggle={() => togglePaid(it.id)}
                onEdit={() => openEdit(it)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <button className="add-btn" onClick={() => openAdd(selected)}>
        <Plus size={20} /> Add on the {ordinal(selected)}
      </button>

      {undated.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 22 }}>
            <h2>No date set</h2>
            <span className="count">{undated.length}</span>
          </div>
          <div className="list">
            <AnimatePresence initial={false}>
              {undated.map((it) => (
                <ItemRow
                  key={it.id}
                  item={it}
                  onToggle={() => togglePaid(it.id)}
                  onEdit={() => openEdit(it)}
                />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}

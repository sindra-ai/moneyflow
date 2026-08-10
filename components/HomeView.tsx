"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/store";
import { money, toGbp } from "@/lib/format";
import type { Outgoing } from "@/lib/types";
import MonthSwitcher from "./MonthSwitcher";
import ItemRow from "./ItemRow";
import { Moon, Plus, Sun, Wallet } from "./icons";

export default function HomeView({
  openAdd,
  openEdit,
}: {
  openAdd: (day?: number | null) => void;
  openEdit: (item: Outgoing) => void;
}) {
  const { items, salary, setSalary, togglePaid, store, resolvedTheme, setTheme } =
    useStore();
  const settings = store.settings;

  const [salaryText, setSalaryText] = useState(String(salary || ""));
  useEffect(() => {
    setSalaryText(salary ? String(salary) : "");
  }, [salary]);

  const totals = useMemo(() => {
    const total = items.reduce((s, it) => s + toGbp(it, settings), 0);
    const left = items
      .filter((it) => !it.paid)
      .reduce((s, it) => s + toGbp(it, settings), 0);
    const paidCount = items.filter((it) => it.paid).length;
    return {
      total,
      left,
      paid: total - left,
      surplus: salary - total,
      paidCount,
      count: items.length,
    };
  }, [items, salary, settings]);

  const pct = totals.count ? Math.round((totals.paidCount / totals.count) * 100) : 0;
  const allClear = totals.count > 0 && totals.left <= 0.001;

  const commitSalary = () => {
    const n = parseFloat(salaryText.replace(/[^0-9.]/g, ""));
    setSalary(Number.isFinite(n) ? n : 0);
  };

  return (
    <>
      <div className="view-fixed">
        <header className="topbar">
          <h1>Monthly Outgoings</h1>
          <button
            className="icon-btn"
            aria-label="Toggle theme"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {resolvedTheme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        <MonthSwitcher />

        <section className="hero glass">
          <div className="cap">{allClear ? "All paid — nice" : "Left to pay"}</div>
          <div className={"big tnum" + (allClear ? " zero" : "")}>
            {money(allClear ? (totals.surplus > 0 ? totals.surplus : 0) : totals.left)}
          </div>

          <div className="hero-row">
            <div className="stat">
              <div className="k">Salary in</div>
              <div className="v tnum">{money(salary)}</div>
            </div>
            <div className="stat">
              <div className="k">Left over after all bills</div>
              <div className={"v tnum " + (totals.surplus >= 0 ? "pos" : "neg")}>
                {money(totals.surplus)}
              </div>
            </div>
          </div>

          <div className="progress-wrap">
            <div className="progress-top">
              <span>
                {totals.paidCount} of {totals.count} paid
              </span>
              <span>{pct}%</span>
            </div>
            <div className="track">
              <div className="fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </section>
      </div>

      <div className="view-scroll">
      <div className="salary-card glass-soft">
        <div className="left">
          <div className="badge">
            <Wallet size={22} />
          </div>
          <div>
            <div className="k">Salary in</div>
            <div className="muted">Tap to edit</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 22, fontWeight: 800, opacity: 0.6 }}>£</span>
          <input
            className="salary-input tnum"
            inputMode="decimal"
            value={salaryText}
            placeholder="0"
            onChange={(e) => setSalaryText(e.target.value)}
            onBlur={commitSalary}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            aria-label="Monthly salary"
          />
        </div>
      </div>

      <div className="section-head">
        <h2>Outgoings</h2>
        <span className="count">{money(totals.total)} total</span>
      </div>

      {totals.count === 0 ? (
        <div className="glass-soft empty">
          <div className="emoji">🫧</div>
          <p>No outgoings yet. Add your first bill below.</p>
        </div>
      ) : (
        <div className="list">
          <AnimatePresence initial={false}>
            {items.map((it) => (
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

      <button className="add-btn" onClick={() => openAdd()}>
        <Plus size={20} /> Add outgoing
      </button>
      </div>
    </>
  );
}

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Reorder } from "framer-motion";
import { useStore } from "@/lib/store";
import { money, toGbp } from "@/lib/format";
import { useCountUp } from "@/lib/useCountUp";
import type { Outgoing } from "@/lib/types";
import type { Tab } from "./BottomNav";
import MonthSwitcher from "./MonthSwitcher";
import ReorderRow from "./ReorderRow";
import Logo from "./Logo";
import QuickActions from "./QuickActions";
import ProgressRing from "./ProgressRing";
import { Check, Moon, Sun, Wallet } from "./icons";

export default function HomeView({
  openAdd,
  openEdit,
  onTab,
}: {
  openAdd: (day?: number | null) => void;
  openEdit: (item: Outgoing) => void;
  onTab: (tab: Tab) => void;
}) {
  const { items, salary, setSalary, togglePaid, markAll, reorderItems, store, resolvedTheme, setTheme } =
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
  const heroValue = allClear ? (totals.surplus > 0 ? totals.surplus : 0) : totals.left;
  const displayValue = useCountUp(heroValue);

  // Collapse the balance card as the bills list is scrolled (with hysteresis
  // so it doesn't flicker at the threshold).
  const scrollRef = useRef<HTMLDivElement>(null);
  const collapsedRef = useRef(false);
  const [collapsed, setCollapsed] = useState(false);
  const onListScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const y = el.scrollTop;
    let next = collapsedRef.current;
    if (!next && y > 44) next = true;
    else if (next && y < 12) next = false;
    if (next !== collapsedRef.current) {
      collapsedRef.current = next;
      setCollapsed(next);
    }
  };

  const commitSalary = () => {
    const n = parseFloat(salaryText.replace(/[^0-9.]/g, ""));
    setSalary(Number.isFinite(n) ? n : 0);
  };

  return (
    <>
      <div className="view-fixed">
        <header className="topbar">
          <div className="brand">
            <Logo size={44} />
          </div>
          <button
            className="icon-btn"
            aria-label="Toggle theme"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {resolvedTheme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        <MonthSwitcher />

        <section className={"hero" + (collapsed ? " collapsed" : "")}>
          <div className="cap">
            {allClear ? (
              <span className="cap-done">
                <Check size={12} strokeWidth={3.4} /> All paid
              </span>
            ) : (
              "Left to pay"
            )}
          </div>
          <div className={"big tnum" + (allClear ? " zero" : "")}>
            {money(displayValue)}
          </div>

          <div className="hero-extra">
            <div className="hero-row">
              <div className="stat">
                <div className="k">Salary in</div>
                <div className="v tnum">{money(salary)}</div>
              </div>
              <div className="stat">
                <div className="k">Left over</div>
                <div className={"v tnum " + (totals.surplus >= 0 ? "pos" : "neg")}>
                  {money(totals.surplus)}
                </div>
              </div>
            </div>

            <div className="hero-progress">
              <ProgressRing pct={pct} />
              <div className="hp-text">
                <div className="hp-num tnum">
                  {totals.paidCount} of {totals.count} paid
                </div>
                <div className="hp-sub tnum">
                  {allClear ? "You're all clear" : money(totals.left) + " still to go"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className={"quick-wrap" + (collapsed ? " collapsed" : "")}>
          <QuickActions
            onAdd={() => openAdd()}
            onPayAll={() => markAll(true)}
            onReset={() => markAll(false)}
            onCalendar={() => onTab("calendar")}
          />
        </div>
      </div>

      <div className="view-scroll" ref={scrollRef} onScroll={onListScroll}>
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
        <Reorder.Group
          as="div"
          axis="y"
          className="list"
          values={items}
          onReorder={reorderItems}
        >
          {items.map((it) => (
            <ReorderRow
              key={it.id}
              item={it}
              onToggle={() => togglePaid(it.id)}
              onEdit={() => openEdit(it)}
            />
          ))}
        </Reorder.Group>
      )}

      </div>
    </>
  );
}

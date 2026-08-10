"use client";

import React from "react";
import { useStore } from "@/lib/store";
import { monthLabel, shiftMonth } from "@/lib/format";
import { ChevronLeft, ChevronRight } from "./icons";

export default function MonthSwitcher() {
  const { currentKey, setCurrentKey } = useStore();
  return (
    <div className="month-switch">
      <button
        className="arrow"
        aria-label="Previous month"
        onClick={() => setCurrentKey(shiftMonth(currentKey, -1))}
      >
        <ChevronLeft size={20} />
      </button>
      <div className="label tnum">{monthLabel(currentKey)}</div>
      <button
        className="arrow"
        aria-label="Next month"
        onClick={() => setCurrentKey(shiftMonth(currentKey, 1))}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

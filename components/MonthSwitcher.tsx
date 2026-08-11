'use client';

import { monthLabel } from '@/lib/format';
import { monthKeyOf, useStore } from '@/lib/store';
import { HAPTIC } from '@/lib/haptics';
import { ChevronLeft, ChevronRight } from './icons';

export function MonthSwitcher() {
  const { monthKey, stepMonth } = useStore();
  const { label } = monthLabel(monthKey);
  const isNow = monthKey === monthKeyOf();

  const go = (d: number) => {
    HAPTIC.light();
    stepMonth(d);
  };

  return (
    <div className="month">
      <button onClick={() => go(-1)} aria-label="Previous month">
        <ChevronLeft size={18} />
      </button>
      <div className={`month-name${isNow ? '' : ' past'}`}>{isNow ? 'This month' : label}</div>
      <button onClick={() => go(1)} aria-label="Next month">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

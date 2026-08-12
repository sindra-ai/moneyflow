'use client';

import { HAPTIC } from '@/lib/haptics';
import { Calendar, Home, User, Wallet } from './icons';

export type Tab = 'home' | 'calendar' | 'spending' | 'profile';

const TABS: { key: Tab; label: string; Icon: typeof Home }[] = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'calendar', label: 'Calendar', Icon: Calendar },
  { key: 'spending', label: 'Spending', Icon: Wallet },
  { key: 'profile', label: 'Profile', Icon: User },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const index = TABS.findIndex((t) => t.key === tab);

  return (
    <nav className="nav" aria-label="Sections">
      <div className="nav-pill" style={{ transform: `translateX(${index * 100}%)` }} />
      {TABS.map(({ key, label, Icon }) => (
        <button
          key={key}
          data-on={tab === key}
          aria-current={tab === key ? 'page' : undefined}
          onClick={() => {
            if (key !== tab) HAPTIC.light();
            onChange(key);
          }}
        >
          <Icon size={19} />
          {label}
        </button>
      ))}
    </nav>
  );
}

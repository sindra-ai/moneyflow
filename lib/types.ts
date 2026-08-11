export type ThemeMode = 'dark' | 'light' | 'system';

/** Spending buckets for the breakdown view. */
export const CATEGORIES = ['Bills', 'Loans', 'Subscriptions', 'Family', 'Other'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Outgoing {
  id: string;
  name: string;
  /** always GBP */
  amount: number;
  /** day of month, 1–31, or null when no date is set */
  dueDay: number | null;
  note: string;
  paid: boolean;
  accent: string;
  category: Category;
  /** true = carries into future months; false = one-off, this month only */
  recurring: boolean;
}

export interface MonthData {
  salary: number;
  items: Outgoing[];
}

export interface Profile {
  name: string;
  /** data URL of the cropped avatar */
  avatar: string | null;
}

export interface Settings {
  theme: ThemeMode;
  /** day of the month the salary lands, for the payday countdown */
  payday: number;
  /** starting savings balance the monthly left-over accrues on top of */
  savingsStart: number;
  /** opt-in to due-date reminders */
  reminders: boolean;
}

export interface Store {
  version: number;
  /** keyed 'YYYY-MM' */
  months: Record<string, MonthData>;
  profile: Profile;
  settings: Settings;
}

export const ACCENTS = [
  '#7c9cff',
  '#b98bff',
  '#4be3a8',
  '#ffd166',
  '#ff6b8b',
  '#5ad2f4',
  '#ff9f6b',
  '#a0e86f',
  '#f78bd0',
  '#c0c6e0',
] as const;

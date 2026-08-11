export type Currency = 'GBP' | 'USD';
export type ThemeMode = 'dark' | 'light' | 'system';

export interface Outgoing {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  /** day of month, 1–31, or null when no date is set */
  dueDay: number | null;
  note: string;
  paid: boolean;
  accent: string;
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
  usdToGbp: number;
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

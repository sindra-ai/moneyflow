export type Currency = "GBP" | "USD";

export type ThemeMode = "dark" | "light" | "system";

export interface Outgoing {
  id: string;
  name: string;
  amount: number; // amount in its own currency
  currency: Currency;
  dueDay: number | null; // 1-31, day of the month it's due
  note: string;
  paid: boolean;
  accent: string; // hex accent used for the row dot / calendar marker
}

export interface MonthData {
  salary: number;
  items: Outgoing[];
}

export interface Profile {
  name: string;
  avatar: string | null; // data URL
}

export interface Settings {
  theme: ThemeMode;
  usdToGbp: number; // conversion rate used only for the running totals
}

export interface Store {
  version: number;
  months: Record<string, MonthData>; // key format: "YYYY-MM"
  profile: Profile;
  settings: Settings;
}

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
  /** id of the bank transaction that auto-marked this paid (reconciliation).
   *  Once set it is not re-matched, so a manual un-tick sticks. */
  paidTxnId?: string;
  /** ISO date the matched payment actually left the account. */
  paidOn?: string;
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
  /** monthly spend caps per spending category (bank data), keyed by SpendCat */
  budgets?: Record<string, number>;
  /** opt-in to auto-ticking bills when the matching payment leaves the bank */
  autoReconcile?: boolean;
}

/** A pension/investment pot tracked by anchoring a real value and moving it
 *  with a market index (since there's no PensionBee API). */
export interface Pension {
  /** the last real value the user entered (from their pension app) */
  value: number;
  /** ISO date (YYYY-MM-DD) that value was set */
  date: string;
  /** market proxy ticker used to move the estimate (Yahoo, e.g. 'URTH') */
  symbol: string;
  /** index price captured when the value was anchored */
  baseLevel?: number | null;
}

/** A named pension/investment pot. Same anchor+proxy tracking as Pension, but
 *  the user can have several (each with its own name, value and proxy). */
export interface Pot {
  id: string;
  name: string;
  value: number;
  date: string;
  symbol: string;
  baseLevel?: number | null;
}

/** One work-week of contract/extra income (paid in arrears). */
export interface IncomeWeek {
  /** Monday of the work week, 'YYYY-MM-DD' */
  key: string;
  hours: number;
  /** true once the payout has actually landed */
  received?: boolean;
}

/** A temporary extra-income stream (e.g. a contract), tracked as a forecast
 *  separate from the fixed monthly salary. */
export interface ExtraIncome {
  name: string;
  /** pay per hour, in `currency` */
  rate: number;
  currency: 'USD' | 'GBP';
  /** weekly hour cap */
  capHours: number;
  weeks: IncomeWeek[];
}

/** A savings goal the user is putting money aside for. */
export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  accent: string;
  createdAt: number;
}

/* ------------------------------------------------- bank (Open Banking) -- */

export interface BankTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
export interface BankAccount {
  id: string;
  name: string;
  type?: string;
  currency?: string;
  provider?: string;
  providerLogo?: string;
  sortLast4?: string;
}
export interface BankTxn {
  id: string;
  date: string;
  amount: number;
  currency: string;
  merchant: string;
  category?: string;
  accountId: string;
}
export interface BankConn {
  tokens: BankTokens;
  accounts: BankAccount[];
  selected: string[];
  connectedAt: number;
}

export interface Store {
  version: number;
  /** keyed 'YYYY-MM' */
  months: Record<string, MonthData>;
  profile: Profile;
  settings: Settings;
  /** linked bank connection — synced so you connect once across devices */
  bank?: BankConn | null;
  /** savings goals (synced) */
  goals?: Goal[];
  /** legacy single pension (migrated to `pots`) */
  pension?: Pension | null;
  /** named pension/investment pots tracked by anchor + market proxy (synced) */
  pots?: Pot[];
  /** temporary extra-income (contract) tracker (synced) */
  extraIncome?: ExtraIncome | null;
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

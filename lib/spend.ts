/** Lightweight merchant categoriser for bank transactions (no secrets). */

export type SpendCat =
  | 'Groceries'
  | 'Eating out'
  | 'Transport'
  | 'Shopping'
  | 'Bills'
  | 'Entertainment'
  | 'Health'
  | 'Cash'
  | 'Income'
  | 'Transfer'
  | 'Other';

export const SPEND_CATS: SpendCat[] = [
  'Groceries',
  'Eating out',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Cash',
  'Income',
  'Transfer',
  'Other',
];

const RULES: [RegExp, SpendCat][] = [
  [/tesco|sainsbury|asda|aldi|lidl|morrison|waitrose|co-?op|iceland|ocado|marks.*spencer|m&s food/i, 'Groceries'],
  [/nando|mcdonald|kfc|burger|greggs|pret|starbucks|costa|cafe|coffee|deliveroo|uber\s?eats|just\s?eat|domino|pizza|restaurant|takeaway|wagamama|five guys/i, 'Eating out'],
  [/uber|bolt|trainline|tfl|transport|rail|railway|petrol|shell|bp\b|esso|texaco|parking|ringo|ncp|dvla|trainl/i, 'Transport'],
  [/amazon|argos|ebay|asos|next\b|primark|zara|h&m|apple\.com|currys|john lewis|ikea|shein|nike|adidas/i, 'Shopping'],
  [/netflix|spotify|disney|now tv|prime video|cinema|odeon|vue|playstation|xbox|steam|youtube|audible/i, 'Entertainment'],
  [/pharmacy|boots|superdrug|nhs|dental|dentist|doctor|clinic|gym|puregym|the gym|david lloyd/i, 'Health'],
  [/vodafone|three|ee\b|o2\b|giffgaff|sky\b|bt\b|virgin media|british gas|octopus energy|edf|eon|thames water|council tax|insurance|direct debit/i, 'Bills'],
  [/cash|atm|withdrawal|link atm/i, 'Cash'],
  [/transfer|xfer|to savings|from savings|standing order|faster payment|bank giro/i, 'Transfer'],
];

export function categorise(merchant: string, amount: number): SpendCat {
  if (amount > 0) return 'Income';
  const s = (merchant || '').toLowerCase();
  for (const [re, cat] of RULES) if (re.test(s)) return cat;
  return 'Other';
}

export const CAT_ACCENT: Record<SpendCat, string> = {
  Groceries: '#4be3a8',
  'Eating out': '#ff9f6b',
  Transport: '#5ad2f4',
  Shopping: '#b98bff',
  Bills: '#7c9cff',
  Entertainment: '#f78bd0',
  Health: '#a0e86f',
  Cash: '#ffd166',
  Income: '#4be3a8',
  Transfer: '#c0c6e0',
  Other: '#c0c6e0',
};

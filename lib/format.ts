const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return gbp.format(n);
}

/** Drops the ".00" tail — used for the big hero figure. */
export function moneyCompact(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const whole = Math.abs(n % 1) < 0.005;
  const s = gbp.format(n);
  return whole ? s.replace(/\.00$/, '') : s;
}

/**
 * Splits into major and minor units so the hero can set the pence smaller —
 * keeps a long balance inside the gauge instead of overrunning it.
 */
export function moneyParts(amount: number): { major: string; minor: string } {
  const s = money(amount);
  const i = s.lastIndexOf('.');
  return i < 0 ? { major: s, minor: '' } : { major: s.slice(0, i), minor: s.slice(i + 1) };
}

export function ordinal(day: number): string {
  const rem100 = day % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** 'YYYY-MM' -> { label: 'August 2026', short: 'Aug 2026' } */
export function monthLabel(key: string): { label: string; short: string } {
  const [y, m] = key.split('-');
  const name = MONTH_NAMES[Number(m) - 1] ?? '';
  return { label: `${name} ${y}`, short: `${name.slice(0, 3)} ${y}` };
}

export function initial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : '·';
}

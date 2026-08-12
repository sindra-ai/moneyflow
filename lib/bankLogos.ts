/**
 * Bundled logos for common UK banks, shown when TrueLayer's account feed
 * doesn't include a provider logo. data: URIs keep them offline + self-hosted.
 * Simple brand-coloured marks — enough to recognise the bank at a glance.
 */

const svg = (body: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${body}</svg>`);

// Halifax's four-chevron "X" mark, in Halifax blue on white.
const HALIFAX = svg(
  `<rect width="40" height="40" fill="#fff"/><g fill="#005EB8"><path d="M6 7h10l7 11H13z"/><path d="M34 7H24l-7 11h10z"/><path d="M6 33h10l7-11H13z"/><path d="M34 33H24l-7-11h10z"/></g>`,
);
const LLOYDS = svg(
  `<rect width="40" height="40" rx="9" fill="#0F7A3D"/><path d="M13 12v16h14" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
);
const BARCLAYS = svg(
  `<rect width="40" height="40" rx="9" fill="#00AEEF"/><path d="M20 10c5 4 5 16 0 20-5-4-5-16 0-20Z" fill="#fff"/>`,
);
const NATWEST = svg(
  `<rect width="40" height="40" rx="9" fill="#5A287D"/><circle cx="20" cy="20" r="9" fill="none" stroke="#fff" stroke-width="3.5"/><path d="M20 11v18M11 20h18" stroke="#fff" stroke-width="3.5"/>`,
);
const HSBC = svg(
  `<rect width="40" height="40" rx="9" fill="#fff"/><path d="M20 6 34 20 20 34 6 20Z" fill="#fff" stroke="#DB0011" stroke-width="2"/><path d="M20 6 20 34M6 20 34 20" stroke="#DB0011" stroke-width="6"/>`,
);
const SANTANDER = svg(
  `<rect width="40" height="40" rx="9" fill="#EC0000"/><path d="M20 9c4 6 4 16 0 22-4-6-4-16 0-22Z" fill="#fff"/>`,
);
const MONZO = svg(
  `<rect width="40" height="40" rx="9" fill="#14233C"/><path d="M12 26V16l8-5 8 5v10" fill="none" stroke="#FF3464" stroke-width="3.5" stroke-linejoin="round"/>`,
);
const NATIONWIDE = svg(
  `<rect width="40" height="40" rx="9" fill="#00284B"/><path d="M11 27V13l9 8 9-8v14" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/>`,
);
const STARLING = svg(
  `<rect width="40" height="40" rx="9" fill="#6A4BF6"/><circle cx="20" cy="20" r="8.5" fill="none" stroke="#fff" stroke-width="3.5"/>`,
);
const REVOLUT = svg(
  `<rect width="40" height="40" rx="9" fill="#0A1F44"/><path d="M14 28V12h7a5 5 0 0 1 0 10h-4l6 6" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`,
);

const MAP: [RegExp, string][] = [
  [/halifax/i, HALIFAX],
  [/lloyds/i, LLOYDS],
  [/barclays/i, BARCLAYS],
  [/nat\s?west/i, NATWEST],
  [/hsbc/i, HSBC],
  [/santander/i, SANTANDER],
  [/monzo/i, MONZO],
  [/nationwide/i, NATIONWIDE],
  [/starling/i, STARLING],
  [/revolut/i, REVOLUT],
];

/** Best logo for an account: a known bundled bank, then the provider feed. */
export function bankLogo(provider?: string, feedLogo?: string): string | null {
  const p = provider || '';
  for (const [re, logo] of MAP) if (re.test(p)) return logo;
  return feedLogo || null;
}

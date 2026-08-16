/**
 * The account that owns this deployment. It is the Supabase *app login*, which
 * is deliberately not the address on the git commits and Vercel deploys.
 *
 * Inlined at build time so the client can hide owner-only UI, and re-checked on
 * the server for anything that actually matters.
 */
export const OWNER_EMAIL = (
  process.env.NEXT_PUBLIC_OWNER_EMAIL || 'r_kalyana@outlook.com'
).toLowerCase();

export function isOwner(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === OWNER_EMAIL;
}

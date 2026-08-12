import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The current deployment's id. The client compares this to the build id baked
// into its bundle (NEXT_PUBLIC_BUILD_ID); a mismatch means a newer version is
// live, so the app refreshes itself.
export function GET() {
  return NextResponse.json(
    { id: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' },
    { headers: { 'cache-control': 'no-store' } },
  );
}

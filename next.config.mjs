/** @type {import('next').NextConfig} */
const nextConfig = {
  // Framer Motion's mount/exit springs get restarted by StrictMode's dev-only
  // double-mount, which visibly breaks the bottom-sheet open/close animation.
  // Production never double-mounts; disabling keeps dev behaviour identical.
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  // Baked into the client bundle so the app can tell when a newer version has
  // been deployed (compared against /api/version) and refresh itself.
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
  },
  // "/" is the marketing site; the app itself lives at /app. beforeFiles so the
  // rewrite wins regardless of route resolution order.
  async rewrites() {
    return {
      beforeFiles: [{ source: '/', destination: '/landing.html' }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;

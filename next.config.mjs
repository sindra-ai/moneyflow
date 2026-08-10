/** @type {import('next').NextConfig} */
const nextConfig = {
  // Framer Motion's mount/exit springs get restarted by StrictMode's dev-only
  // double-mount, which visibly breaks the bottom-sheet open/close animation.
  // Production never double-mounts; disabling keeps dev behaviour identical.
  reactStrictMode: false,
};

export default nextConfig;

import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MoneyFlow',
  description: 'Track what goes out each month, against what comes in.',
  applicationName: 'MoneyFlow',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'MoneyFlow',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    // Freshly-named files (v3) rather than a ?v= query — Safari caches
    // favicons by path and ignores query strings, so a new path is the only
    // reliable way to force it to refetch the restored dark icon.
    icon: '/icons/app-icon-v3-192.png',
    apple: '/icons/touch-icon-v3-180.png',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#06070d',
  interactiveWidget: 'resizes-content',
};

/**
 * Resolves the stored theme before first paint so there's no light/dark flash.
 * Mirrors the resolution logic in lib/store.tsx.
 */
const THEME_BOOT = `(function(){try{
var raw=localStorage.getItem('moneyflow:v1');
var mode=raw?(JSON.parse(raw).settings||{}).theme:'system';
if(mode!=='dark'&&mode!=='light'){
  mode=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
}
document.documentElement.dataset.theme=mode;
var m=document.querySelector('meta[name="theme-color"]');
if(m)m.setAttribute('content',mode==='dark'?'#06070d':'#f3f5fc');
}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

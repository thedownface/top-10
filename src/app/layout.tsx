import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });

export const metadata: Metadata = {
  title: 'Top 10',
  description: 'Ten athletes build discipline in public. Every task needs proof. Every evening, one learning for everyone watching.',
  applicationName: 'Top 10',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Top 10', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#E8D5B2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>
        {children}
        <Script id="sw" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator && location.hostname !== 'localhost') navigator.serviceWorker.register('/sw.js').catch(function () {});`}
        </Script>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Latu', description: 'Treeningplaan, päevik ja analüüs', icons: { icon: '/icon.svg' } };
export const viewport: Viewport = { themeColor: '#0f1a24', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="et">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@600;700&family=Figtree:wght@400;500;600&display=swap" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

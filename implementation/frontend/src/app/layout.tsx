import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'KOSMOS - AI-Native Enterprise Platform',
  description: 'Unified agentic workspace for enterprise operations. Zero context switching, intent-aware interface.',
  keywords: ['AI', 'Enterprise', 'Workspace', 'Productivity', 'Agents'],
  authors: [{ name: 'Nuvanta Holding' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0f',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="font-sans antialiased overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';

import { AccentProvider } from '@/shared/providers/accent-provider';
import { AuthBoot } from '@/shared/providers/auth-boot';
import { QueryProvider } from '@/shared/providers/query-provider';
import { ThemeProvider } from '@/shared/providers/theme-provider';

import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Eco-Balance Platformasi',
    template: '%s · Eco-Balance',
  },
  description: 'Ekologik monitoring va uzluksiz ta\'lim platformasi',
  applicationName: 'Eco-Balance',
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
    ],
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#16A34A' },
    { media: '(prefers-color-scheme: dark)', color: '#0F172A' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const messages = await getMessages();
  return (
    <html lang="uz" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen font-sans">
        <NextIntlClientProvider messages={messages} locale="uz" timeZone="Asia/Tashkent">
          <ThemeProvider>
            <QueryProvider>
              <AuthBoot>
                <AccentProvider>{children}</AccentProvider>
              </AuthBoot>
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

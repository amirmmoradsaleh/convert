import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { defaultMetadata, createWebsiteSchema } from '@/lib/seo';
import JsonLd from '@/components/seo/JsonLd';
import { getPublicSiteSettings } from '@/lib/admin/services/settings.service';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = defaultMetadata;

export const viewport: Viewport = {
  themeColor: '#7C3AED',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const websiteSchema = createWebsiteSchema();
  const settings = await getPublicSiteSettings().catch(() => undefined);

  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full flex flex-col bg-[#FCFBFF] text-[#0F112E] antialiased`}>
        <JsonLd data={websiteSchema} />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#7C3AED] focus:text-white focus:rounded-xl focus:shadow-md"
        >
          Skip to main content
        </a>
        <Header initialSettings={settings} />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer initialSettings={settings} />
      </body>
    </html>
  );
}

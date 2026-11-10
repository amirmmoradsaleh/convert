import React from 'react';
import type { Metadata } from 'next';
import { ShieldCheck, Zap, Heart, Lock } from 'lucide-react';
import { getPublishedPage, buildCmsMetadata } from '@/lib/cms/page-resolver';
import CmsPageClient from '@/components/cms/CmsPageClient';

const DEFAULT_METADATA: Metadata = {
  title: 'About Us – Free Online File Utilities',
  description:
    'Learn about Convert24, our mission to deliver fast, private, and 100% free image and PDF conversion utilities entirely within your browser.',
};

export async function generateMetadata(): Promise<Metadata> {
  const cmsPage = await getPublishedPage('about');
  return buildCmsMetadata(cmsPage, DEFAULT_METADATA);
}

export default async function AboutPage() {
  const cmsPage = await getPublishedPage('about');

  const fallbackRender = (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#0F112E] tracking-tight">
          About Convert24
        </h1>
        <p className="text-lg text-[#5E6488] leading-relaxed">
          Fast, privacy-first image and PDF utilities designed to run directly on your own device.
        </p>
      </header>

      <section className="space-y-4 text-base text-[#0F112E] leading-relaxed">
        <p>
          Convert24 was founded with a straightforward conviction: basic file conversion and document management should be accessible to everyone without friction, paywalls, or privacy compromises.
        </p>
        <p>
          Most online file tools require users to upload confidential files to unfamiliar cloud servers, exposing personal receipts, tax filings, legal agreements, and cherished memories to potential data harvesting and security incidents.
        </p>
        <p>
          We leverage modern browser capabilities, including HTML5 Canvas and client-side processing, to run file conversions directly on your local hardware. Your files never leave your computer or phone.
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4">
        <div className="p-5 bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] space-y-2 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center">
            <Lock className="w-5 h-5" aria-hidden="true" />
          </div>
          <h3 className="font-bold text-base text-[#0F112E]">Zero Server Uploads</h3>
          <p className="text-sm text-[#5E6488]">
            Complete privacy by default. We do not store, view, or retain your files.
          </p>
        </div>

        <div className="p-5 bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] space-y-2 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center">
            <Heart className="w-5 h-5" aria-hidden="true" />
          </div>
          <h3 className="font-bold text-base text-[#0F112E]">100% Free Service</h3>
          <p className="text-sm text-[#5E6488]">
            No subscriptions, account signups, credit cards, or hidden fees.
          </p>
        </div>

        <div className="p-5 bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] space-y-2 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center">
            <Zap className="w-5 h-5" aria-hidden="true" />
          </div>
          <h3 className="font-bold text-base text-[#0F112E]">Instant Processing</h3>
          <p className="text-sm text-[#5E6488]">
            Fast client execution eliminates network upload and download bottlenecks.
          </p>
        </div>

        <div className="p-5 bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] space-y-2 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <h3 className="font-bold text-base text-[#0F112E]">Clean Design</h3>
          <p className="text-sm text-[#5E6488]">
            No intrusive popups or deceptive dark patterns. Pure utility.
          </p>
        </div>
      </section>
    </div>
  );

  return (
    <CmsPageClient
      slug="about"
      initialCmsPage={cmsPage}
      fallbackTitle="About Us"
      fallbackRender={fallbackRender}
    />
  );
}

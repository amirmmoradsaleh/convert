import React from 'react';
import type { Metadata } from 'next';
import { getPublishedPage, buildCmsMetadata } from '@/lib/cms/page-resolver';
import CmsPageClient from '@/components/cms/CmsPageClient';

const DEFAULT_METADATA: Metadata = {
  title: 'Terms of Service – Convert24',
  description:
    'Terms of service governing the usage of Convert24 free online image and PDF utility tools.',
};

export async function generateMetadata(): Promise<Metadata> {
  const cmsPage = await getPublishedPage('terms');
  return buildCmsMetadata(cmsPage, DEFAULT_METADATA);
}

export default async function TermsPage() {
  const cmsPage = await getPublishedPage('terms');

  const fallbackRender = (
    <div className="space-y-6 text-[#17202A] leading-relaxed">
      <header className="space-y-2 mb-8">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#17202A] tracking-tight">
          Terms of Service
        </h1>
        <p className="text-sm text-[#667085]">Last updated: March 2026</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#17202A]">1. Agreement to Terms</h2>
        <p className="text-[#667085]">
          By accessing and using Convert24, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree with any portion of these terms, you must refrain from using the service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#17202A]">2. Permitted Use</h2>
        <p className="text-[#667085]">
          Convert24 provides free online file conversion and optimization utilities for both personal and commercial projects. You may use our service without charge, provided that your use complies with all applicable local, national, and international laws and regulations.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#17202A]">3. Ownership of Content</h2>
        <p className="text-[#667085]">
          You retain full ownership, copyright, and all associated intellectual property rights to any files you process using Convert24. Because processing is executed client-side, we never claim any rights, license, or possession over your submitted or converted files.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#17202A]">4. Disclaimer of Warranties</h2>
        <p className="text-[#667085]">
          Convert24 is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without warranties of any kind, either express or implied. While we strive to ensure optimal output fidelity, we do not warrant that file conversion will be completely error-free or uninterrupted. Always retain copies of your original files.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#17202A]">5. Limitation of Liability</h2>
        <p className="text-[#667085]">
          In no event shall Convert24 or its operators be liable for any direct, indirect, incidental, or consequential damages resulting from the use or inability to use this service, or loss of file data.
        </p>
      </section>
    </div>
  );

  return (
    <CmsPageClient
      slug="terms"
      initialCmsPage={cmsPage}
      fallbackTitle="Terms of Service"
      fallbackRender={fallbackRender}
    />
  );
}

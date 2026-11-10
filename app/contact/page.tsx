import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MessageSquare } from 'lucide-react';
import { getPublishedPage, buildCmsMetadata } from '@/lib/cms/page-resolver';
import CmsPageClient from '@/components/cms/CmsPageClient';

const DEFAULT_METADATA: Metadata = {
  title: 'Contact Us – Convert24',
  description:
    'Get in touch with the Convert24 team for feedback, bug reports, and general inquiries.',
};

export async function generateMetadata(): Promise<Metadata> {
  const cmsPage = await getPublishedPage('contact');
  return buildCmsMetadata(cmsPage, DEFAULT_METADATA);
}

export default async function ContactPage() {
  const cmsPage = await getPublishedPage('contact');

  const fallbackRender = (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#0F112E] tracking-tight">
          Contact Us
        </h1>
        <p className="text-base md:text-lg text-[#5E6488] leading-relaxed">
          Have questions, feedback, or need to report a problem with a tool? We appreciate hearing from our users.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="p-6 bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] space-y-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center">
            <Mail className="w-5 h-5" aria-hidden="true" />
          </div>
          <h2 className="font-bold text-lg text-[#0F112E]">General Inquiries</h2>
          <p className="text-sm text-[#5E6488]">
            For questions about our platform, partnerships, or features:
          </p>
          <p className="text-sm font-semibold text-[#7C3AED]">
            support@convert24.local
          </p>
        </div>

        <div className="p-6 bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] space-y-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center">
            <MessageSquare className="w-5 h-5" aria-hidden="true" />
          </div>
          <h2 className="font-bold text-lg text-[#0F112E]">Bug Reports</h2>
          <p className="text-sm text-[#5E6488]">
            Encountered an issue with a particular file format or browser?
          </p>
          <p className="text-sm font-semibold text-[#7C3AED]">
            bugs@convert24.local
          </p>
        </div>
      </div>

      <div className="p-6 bg-[#F4F3FA] border border-[#E4E2F0] rounded-[20px] space-y-2 text-sm text-[#5E6488]">
        <h3 className="font-bold text-[#0F112E]">Frequently Asked Inquiries</h3>
        <p>
          Before sending a message, please check our{' '}
          <Link href="/#faq" className="text-[#7C3AED] font-semibold underline">
            FAQ section
          </Link>
          . Common questions regarding file limits, security, and supported formats are answered there.
        </p>
      </div>
    </div>
  );

  return (
    <CmsPageClient
      slug="contact"
      initialCmsPage={cmsPage}
      fallbackTitle="Contact Us"
      fallbackRender={fallbackRender}
    />
  );
}

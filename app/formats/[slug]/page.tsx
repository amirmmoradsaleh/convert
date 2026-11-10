import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Container from '@/components/layout/Container';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import RelatedTools from '@/components/seo/RelatedTools';
import AdSlot from '@/components/ads/AdSlot';
import { getAllFormats, getFormatBySlug } from '@/lib/formats';
import { Check, X, Info } from 'lucide-react';
import JsonLd from '@/components/seo/JsonLd';
import { createBreadcrumbSchema, siteConfig } from '@/lib/seo';

interface FormatRouteProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const formats = getAllFormats();
  return formats.map((fmt) => ({
    slug: fmt.slug,
  }));
}

export async function generateMetadata({ params }: FormatRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const format = getFormatBySlug(slug);

  if (!format) {
    return {
      title: 'Format Not Found',
      description: 'The requested file format guide could not be found.',
    };
  }

  return {
    title: format.title,
    description: format.description,
  };
}

export default async function FormatDetailPage({ params }: FormatRouteProps) {
  const { slug } = await params;
  const format = getFormatBySlug(slug);

  if (!format) {
    notFound();
  }

  const breadcrumbs = [
    { name: 'Formats', href: '/formats/jpg' },
    { name: format.name },
  ];

  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: siteConfig.url },
    { name: 'Formats', url: `${siteConfig.url}/formats/jpg` },
    { name: format.name, url: `${siteConfig.url}/formats/${format.slug}` },
  ]);

  return (
    <>
      <JsonLd data={breadcrumbSchema} />

      <div className="py-8 md:py-12 space-y-10">
        <Container>
          <Breadcrumbs items={breadcrumbs} />

          {/* Header */}
          <div className="max-w-3xl mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#F4F0FD] text-[#7C3AED] mb-3">
              <Info className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Format Guide • {format.extension}</span>
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#0F112E] tracking-tight mb-4">
              {format.name} File Format Guide
            </h1>
            <p className="text-base md:text-lg text-[#5E6488] leading-relaxed">
              {format.description}
            </p>
          </div>

          {/* Details Overview Card */}
          <div className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] p-6 md:p-8 shadow-sm mb-10 space-y-4">
            <h2 className="text-xl font-bold text-[#0F112E]">About {format.name}</h2>
            <p className="text-base text-[#5E6488] leading-relaxed">
              {format.details}
            </p>
            <div className="p-4 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl mt-4">
              <h3 className="text-sm font-semibold text-[#0F112E] mb-1">Recommended Usage</h3>
              <p className="text-sm text-[#5E6488]">{format.bestFor}</p>
            </div>
          </div>

          {/* Pros and Cons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] p-6 space-y-3">
              <h3 className="font-bold text-lg text-[#16A34A] flex items-center gap-2">
                <Check className="w-5 h-5 text-[#16A34A]" aria-hidden="true" />
                <span>Advantages</span>
              </h3>
              <ul className="space-y-2">
                {format.pros.map((pro, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-[#5E6488]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] mt-2 flex-shrink-0" />
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] p-6 space-y-3">
              <h3 className="font-bold text-lg text-[#DC2626] flex items-center gap-2">
                <X className="w-5 h-5 text-[#DC2626]" aria-hidden="true" />
                <span>Limitations</span>
              </h3>
              <ul className="space-y-2">
                {format.cons.map((con, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-[#5E6488]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] mt-2 flex-shrink-0" />
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <AdSlot slotId={`format-${format.slug}`} />

          {/* Compatible Tools */}
          {format.compatibleTools && format.compatibleTools.length > 0 && (
            <div className="border-t border-[#E4E2F0] pt-8">
              <RelatedTools
                slugs={format.compatibleTools}
                title={`Tools Supporting ${format.name}`}
              />
            </div>
          )}
        </Container>
      </div>
    </>
  );
}

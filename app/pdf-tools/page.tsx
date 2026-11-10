import React from 'react';
import type { Metadata } from 'next';
import Container from '@/components/layout/Container';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import ToolCard from '@/components/tool/ToolCard';
import HomeSearch from '@/components/tool/HomeSearch';
import AdSlot from '@/components/ads/AdSlot';
import { getToolBySlug, ToolDefinition, getAllTools } from '@/lib/tools';
import { getPublishedPage, buildCmsMetadata, CmsJsonLd } from '@/lib/cms/page-resolver';

const DEFAULT_METADATA: Metadata = {
  title: 'Free Online PDF Tools – Merge, Split, Compress & Convert',
  description:
    'Free browser-based PDF utilities. Merge PDF documents, split pages, compress file sizes, rotate orientation, delete, reorder, and convert to images safely.',
};

export async function generateMetadata(): Promise<Metadata> {
  const cmsPage = await getPublishedPage('pdf-tools');
  return buildCmsMetadata(cmsPage, DEFAULT_METADATA);
}

// Canonical tool groupings for PDF Tools Hub
const CONVERT_SLUGS = ['pdf-to-jpg', 'pdf-to-png'];

const ORGANIZE_SLUGS = [
  'merge-pdf',
  'split-pdf',
  'delete-pdf-pages',
  'reorder-pdf-pages',
  'rotate-pdf',
];

const OPTIMIZE_SLUGS = ['compress-pdf'];

const CREATE_SLUGS = ['image-to-pdf', 'jpg-to-pdf', 'png-to-pdf'];

function resolveTools(slugs: string[]): ToolDefinition[] {
  return slugs
    .map((slug) => getToolBySlug(slug))
    .filter((t): t is ToolDefinition => Boolean(t));
}

export default async function PdfToolsPage() {
  const cmsPage = await getPublishedPage('pdf-tools');
  const allTools = getAllTools();
  const pdfTools = allTools.filter(
    (t) =>
      t.category.startsWith('pdf') ||
      t.slug === 'image-to-pdf' ||
      t.slug === 'jpg-to-pdf' ||
      t.slug === 'png-to-pdf'
  );

  const convertTools = resolveTools(CONVERT_SLUGS);
  const organizeTools = resolveTools(ORGANIZE_SLUGS);
  const optimizeTools = resolveTools(OPTIMIZE_SLUGS);
  const createTools = resolveTools(CREATE_SLUGS);

  return (
    <div className="py-8 md:py-16 space-y-12 bg-[#FCFBFF]">
      <Container>
        <Breadcrumbs items={[{ name: cmsPage?.name || 'PDF Tools' }]} />
        <CmsJsonLd schema={cmsPage?.seo?.schemaJson} />

        {/* Discovery Header */}
        <div className="max-w-3xl mb-10 space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#0F112E] tracking-tight">
            {cmsPage?.name ? cmsPage.name : 'PDF Tools'}
          </h1>
          <p className="text-xl md:text-2xl font-bold text-[#7C3AED]">
            What do you want to do?
          </p>
          <p className="text-base md:text-lg text-[#5E6488] leading-relaxed">
            Manage your PDF files securely. Combine documents, extract pages, compress large files,
            rotate orientations, and convert PDFs without server uploads.
          </p>
        </div>

        {/* PDF Tools Search */}
        <div className="mb-12">
          <HomeSearch
            tools={pdfTools}
            placeholder="Search PDF tools..."
            id="pdf-tools-search"
          />
        </div>

        {/* 1. Convert Section */}
        <section className="mb-14" aria-labelledby="pdf-convert-heading">
          <div className="mb-8">
            <h2
              id="pdf-convert-heading"
              className="text-2xl font-bold text-[#0F112E] tracking-tight"
            >
              Convert
            </h2>
            <p className="text-sm text-[#5E6488] mt-1.5">
              Extract high-resolution JPG or PNG images from your PDF pages.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {convertTools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        </section>

        {/* 2. Organize Section */}
        <section className="mb-14" aria-labelledby="pdf-organize-heading">
          <div className="mb-8">
            <h2
              id="pdf-organize-heading"
              className="text-2xl font-bold text-[#0F112E] tracking-tight"
            >
              Organize
            </h2>
            <p className="text-sm text-[#5E6488] mt-1.5">
              Merge multiple files, extract page ranges, delete pages, reorder pages, and rotate orientation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizeTools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        </section>

        <AdSlot slotId="pdf-tools-middle" />

        {/* 3. Optimize Section */}
        <section className="mb-14" aria-labelledby="pdf-optimize-heading">
          <div className="mb-8">
            <h2
              id="pdf-optimize-heading"
              className="text-2xl font-bold text-[#0F112E] tracking-tight"
            >
              Optimize
            </h2>
            <p className="text-sm text-[#5E6488] mt-1.5">
              Reduce PDF file sizes safely with customizable compression quality profiles.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {optimizeTools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        </section>

        {/* 4. Create Section */}
        <section aria-labelledby="pdf-create-heading">
          <div className="mb-8">
            <h2
              id="pdf-create-heading"
              className="text-2xl font-bold text-[#0F112E] tracking-tight"
            >
              Create
            </h2>
            <p className="text-sm text-[#5E6488] mt-1.5">
              Turn individual or batch images into formatted PDF documents.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {createTools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        </section>
      </Container>
    </div>
  );
}

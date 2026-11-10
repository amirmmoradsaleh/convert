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
  title: 'Free Online Image Tools – Convert, Compress & Edit Photos',
  description:
    'Free browser-based image converters and utilities. Convert JPG, PNG, WEBP, HEIC, compress photos, resize, crop, and rotate with 100% privacy.',
};

export async function generateMetadata(): Promise<Metadata> {
  const cmsPage = await getPublishedPage('image-tools');
  return buildCmsMetadata(cmsPage, DEFAULT_METADATA);
}

// Canonical tool groupings for Image Tools Hub
const CONVERT_SLUGS = [
  'jpg-to-png',
  'png-to-jpg',
  'jpg-to-webp',
  'webp-to-jpg',
  'png-to-webp',
  'webp-to-png',
  'heic-to-jpg',
  'svg-to-png',
  'gif-to-png',
  'bmp-to-png',
];

const COMPRESS_SLUGS = ['compress-image'];

const EDIT_SLUGS = ['resize-image', 'crop-image', 'rotate-image'];

const CREATE_SLUGS = ['image-to-pdf', 'jpg-to-pdf', 'png-to-pdf'];

function resolveTools(slugs: string[]): ToolDefinition[] {
  return slugs
    .map((slug) => getToolBySlug(slug))
    .filter((t): t is ToolDefinition => Boolean(t));
}

export default async function ImageToolsPage() {
  const cmsPage = await getPublishedPage('image-tools');
  const allTools = getAllTools();
  const imageTools = allTools.filter(
    (t) =>
      t.category.startsWith('image') ||
      t.slug === 'image-to-pdf' ||
      t.slug === 'jpg-to-pdf' ||
      t.slug === 'png-to-pdf'
  );

  const convertTools = resolveTools(CONVERT_SLUGS);
  const compressTools = resolveTools(COMPRESS_SLUGS);
  const editTools = resolveTools(EDIT_SLUGS);
  const createTools = resolveTools(CREATE_SLUGS);

  return (
    <div className="py-8 md:py-16 space-y-12 bg-[#FCFBFF]">
      <Container>
        <Breadcrumbs items={[{ name: cmsPage?.name || 'Image Tools' }]} />
        <CmsJsonLd schema={cmsPage?.seo?.schemaJson} />

        {/* Discovery Header */}
        <div className="max-w-3xl mb-10 space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#0F112E] tracking-tight">
            {cmsPage?.name ? cmsPage.name : 'Image Tools'}
          </h1>
          <p className="text-xl md:text-2xl font-bold text-[#7C3AED]">
            What do you want to do?
          </p>
          <p className="text-base md:text-lg text-[#5E6488] leading-relaxed">
            Convert image formats, optimize file sizes, crop, resize, and rotate pictures directly in
            your browser with zero uploads to remote servers.
          </p>
        </div>

        {/* Image Tools Search */}
        <div className="mb-12">
          <HomeSearch
            tools={imageTools}
            placeholder="Search image tools..."
            id="image-tools-search"
          />
        </div>

        {/* 1. Convert Section */}
        <section className="mb-14" aria-labelledby="image-convert-heading">
          <div className="mb-8">
            <h2
              id="image-convert-heading"
              className="text-2xl font-bold text-[#0F112E] tracking-tight"
            >
              Convert
            </h2>
            <p className="text-sm text-[#5E6488] mt-1.5">
              Switch between JPG, PNG, WebP, HEIC, SVG, GIF, and BMP formats instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {convertTools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        </section>

        {/* 2. Compress Section */}
        <section className="mb-14" aria-labelledby="image-compress-heading">
          <div className="mb-8">
            <h2
              id="image-compress-heading"
              className="text-2xl font-bold text-[#0F112E] tracking-tight"
            >
              Compress
            </h2>
            <p className="text-sm text-[#5E6488] mt-1.5">
              Shrink JPG, PNG, and WebP photo sizes while preserving visual quality.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {compressTools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        </section>

        <AdSlot slotId="image-tools-middle" />

        {/* 3. Edit Section */}
        <section className="mb-14" aria-labelledby="image-edit-heading">
          <div className="mb-8">
            <h2
              id="image-edit-heading"
              className="text-2xl font-bold text-[#0F112E] tracking-tight"
            >
              Edit
            </h2>
            <p className="text-sm text-[#5E6488] mt-1.5">
              Resize pixel dimensions, crop aspect ratios, and rotate image orientation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {editTools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        </section>

        {/* 4. Create Section */}
        <section aria-labelledby="image-create-heading">
          <div className="mb-8">
            <h2
              id="image-create-heading"
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

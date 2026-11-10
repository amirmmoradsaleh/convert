import React from 'react';
import type { Metadata } from 'next';
import { getAllTools, getToolBySlug } from '@/lib/tools';
import { getAllFormats } from '@/lib/formats';
import { getPublishedPage, buildCmsMetadata } from '@/lib/cms/page-resolver';
import HomePageClient from '@/components/home/HomePageClient';

const DEFAULT_METADATA: Metadata = {
  title: 'Free Online File Tools – Convert, Compress & Edit Files Free',
  description:
    'Fast, secure, 100% free image and PDF conversion utilities. Convert JPG, PNG, WEBP, HEIC, PDF and compress documents with complete client-side privacy.',
};

export async function generateMetadata(): Promise<Metadata> {
  const cmsPage = await getPublishedPage('home');
  return buildCmsMetadata(cmsPage, DEFAULT_METADATA);
}

export default async function HomePage() {
  const cmsPage = await getPublishedPage('home');
  const allTools = getAllTools();
  const allFormats = getAllFormats();

  // Curated popular tools: 6 high-utility tools across Image & PDF
  const popularSlugs = [
    'jpg-to-png',
    'png-to-jpg',
    'compress-image',
    'compress-pdf',
    'merge-pdf',
    'pdf-to-jpg',
  ];
  const popularTools = popularSlugs
    .map((slug) => getToolBySlug(slug))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const imageToolsCount = allTools.filter(
    (t) =>
      t.category.startsWith('image') ||
      ['image-to-pdf', 'jpg-to-pdf', 'png-to-pdf'].includes(t.slug)
  ).length;

  const pdfToolsCount = allTools.filter(
    (t) =>
      t.category.startsWith('pdf') &&
      !['image-to-pdf', 'jpg-to-pdf', 'png-to-pdf'].includes(t.slug)
  ).length;

  return (
    <HomePageClient
      initialCmsPage={cmsPage}
      allTools={allTools}
      allFormats={allFormats}
      popularTools={popularTools}
      imageToolsCount={imageToolsCount}
      pdfToolsCount={pdfToolsCount}
    />
  );
}

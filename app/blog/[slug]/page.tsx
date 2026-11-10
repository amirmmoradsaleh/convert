import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublishedPostBySlug, buildBlogPostMetadata, getBlogPostJsonLd } from '@/lib/cms/blog-resolver';
import BlogPostClient from '@/components/blog/BlogPostClient';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

interface BlogArticleProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogArticleProps): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  return buildBlogPostMetadata(decodedSlug, {
    title: 'Article Not Found',
    description: 'The requested guide could not be found.',
  });
}

export default async function BlogPostPage({ params }: BlogArticleProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const post = await getPublishedPostBySlug(decodedSlug);

  if (!post) {
    notFound();
  }

  const jsonLd = await getBlogPostJsonLd(slug);

  return <BlogPostClient post={post} slug={decodedSlug} jsonLd={jsonLd} />;
}

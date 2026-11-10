import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getAllTools, getToolBySlug, ToolDefinition } from '@/lib/tools';
import ToolPage from '@/components/tool/ToolPage';
import { siteConfig } from '@/lib/seo';
import { getPublishedTool, getPreviewTool, buildToolMetadata, getToolJsonLd } from '@/lib/cms/tool-resolver';
import JsonLd from '@/components/seo/JsonLd';
import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin/session';
import { hasPermission } from '@/lib/admin/permissions';

interface ToolRouteProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ preview?: string }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function checkAdminPreviewAccess(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (!token) return false;
    const session = await verifySessionToken(token);
    return Boolean(session && hasPermission(session.role, 'VIEW_CMS'));
  } catch {
    return false;
  }
}

export async function generateMetadata({ params, searchParams }: ToolRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const sParams = searchParams ? await searchParams : {};
  const wantsPreview = sParams.preview === 'true';
  const isAuthorized = wantsPreview ? await checkAdminPreviewAccess() : false;

  const tool = getToolBySlug(slug);

  if (!tool) {
    return {
      title: 'Tool Not Found',
      description: 'The requested conversion tool could not be found.',
    };
  }

  const canonicalUrl = `${siteConfig.url}/tools/${tool.slug}`;

  const defaultMeta: Metadata = {
    title: tool.title,
    description: tool.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: tool.title,
      description: tool.description,
      url: canonicalUrl,
      siteName: siteConfig.name,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: tool.title,
      description: tool.description,
    },
  };

  const meta = await buildToolMetadata(slug, defaultMeta);

  // Protected: Draft previews must NEVER be indexed by search engines
  if (wantsPreview && isAuthorized) {
    return {
      ...meta,
      robots: {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
          'max-video-preview': -1,
          'max-image-preview': 'none',
          'max-snippet': -1,
        },
      },
    };
  }

  return meta;
}

export default async function DynamicToolPage({ params, searchParams }: ToolRouteProps) {
  const { slug } = await params;
  const sParams = searchParams ? await searchParams : {};
  const wantsPreview = sParams.preview === 'true';

  let tool: ToolDefinition | null = null;
  let isPreview = false;

  // Server-side authorization check for draft preview
  if (wantsPreview) {
    const isAuthorized = await checkAdminPreviewAccess();
    if (isAuthorized) {
      tool = await getPreviewTool(slug);
      isPreview = true;
    }
  }

  // Fallback for public visitors or when preview was not requested/authorized:
  // Public visitors get ONLY the published tool
  if (!tool) {
    tool = await getPublishedTool(slug);
  }

  if (!tool) {
    notFound();
  }

  const jsonLd = await getToolJsonLd(slug);

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      <ToolPage tool={tool} isPreview={isPreview} />
    </>
  );
}

'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Eye, AlertCircle, RefreshCw, Sparkles, ExternalLink } from 'lucide-react';
import ToolPage from '@/components/tool/ToolPage';
import { ToolDefinition } from '@/lib/tools';

interface ToolPreviewProps {
  params: Promise<{ slug: string }>;
}

export default function AdminToolPreview({ params }: ToolPreviewProps) {
  const { slug } = use(params);
  const router = useRouter();

  const [tool, setTool] = useState<ToolDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    async function loadPreview() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/tools/${slug}/preview`);
        if (!res.ok) throw new Error('Failed to load draft tool preview.');
        const data = await res.json();
        setTool(data.tool);

        // Also check if already published
        const toolRes = await fetch(`/api/admin/tools/${slug}`);
        if (toolRes.ok) {
          const toolData = await toolRes.json();
          setIsPublished(Boolean(toolData.override?.isPublished));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error loading draft tool preview.';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    }
    loadPreview();
  }, [slug]);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/admin/tools/${slug}/publish`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish tool.');

      setIsPublished(true);
      alert('Tool published successfully with CMS overrides active!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error publishing tool.';
      alert(msg);
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-xs text-[#5E6488]">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-[#7C3AED]" />
        <span>Loading draft preview for {slug}...</span>
      </div>
    );
  }

  if (error || !tool) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center bg-white rounded-xl border border-[#E4E2F0] space-y-4">
        <AlertCircle className="w-8 h-8 text-[#DC2626] mx-auto" />
        <h2 className="text-lg font-bold text-[#0F112E]">Unable to Preview Draft</h2>
        <p className="text-xs text-[#5E6488]">{error || 'Tool not found.'}</p>
        <Link
          href={`/admin/tools/${slug}`}
          className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] rounded-lg"
        >
          Return to Editor
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Preview Banner */}
      <div className="sticky top-0 z-40 bg-[#0F112E] text-white px-4 py-3 rounded-xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#2DD4BF]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#2DD4BF]">
            Draft Preview Mode
          </span>
          <span className="text-xs text-[#94A3B8]">|</span>
          <span className="text-xs font-medium text-[#E4E2F0]">
            Viewing Draft Overrides for: <span className="font-semibold text-white">{tool.name}</span> (/tools/{tool.slug})
          </span>
          <span
            className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold ${
              isPublished
                ? 'bg-[#F4F0FD] text-[#7C3AED]'
                : 'bg-[#FFFBEB] text-[#B45309]'
            }`}
          >
            {isPublished ? 'PUBLISHED' : 'DRAFT'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/tools/${slug}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#E4E2F0] hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Editor</span>
          </Link>

          {!isPublished ? (
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0E7490] hover:bg-[#155E75] rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isPublishing ? 'Publishing...' : 'Publish Draft'}</span>
            </button>
          ) : (
            <Link
              href={`/tools/${slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg transition-all"
            >
              <span>View Live Public Page</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Render the full interactive ToolPage with draft merged content */}
      <div className="bg-white rounded-2xl border border-[#E4E2F0] shadow-subtle overflow-hidden">
        <ToolPage tool={tool} />
      </div>
    </div>
  );
}

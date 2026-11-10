import React from 'react';
import Link from 'next/link';
import { CheckCircle2, FileCheck, ArrowRight } from 'lucide-react';
import { formatBytes } from '@/engines/shared/file-utils';
import DownloadButton from './DownloadButton';

export interface RelatedToolSuggestion {
  name: string;
  slug: string;
  desc?: string;
}

export interface ConversionResultData {
  fileName: string;
  originalSize: number;
  convertedSize: number;
  downloadUrl?: string;
  onDownload?: () => void;
  onReset?: () => void;
  relatedTools?: RelatedToolSuggestion[];
  categoryHubUrl?: string;
  categoryHubName?: string;
}

interface ConversionResultProps {
  result: ConversionResultData;
  className?: string;
}

export function ConversionResult({ result, className = '' }: ConversionResultProps) {
  const savingsBytes = result.originalSize - result.convertedSize;
  const percentSaved =
    result.originalSize > 0 && savingsBytes > 0
      ? Math.round((savingsBytes / result.originalSize) * 100)
      : null;

  return (
    <div
      className={`w-full bg-[#FFFFFF] border border-[#16A34A]/30 rounded-[20px] p-6 md:p-8 shadow-sm text-center space-y-6 ${className}`}
    >
      <div className="w-14 h-14 rounded-full bg-[#F0FDF4] text-[#16A34A] flex items-center justify-center mx-auto shadow-sm">
        <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <h3 className="text-xl md:text-2xl font-bold text-[#0F112E]">
          Processing Complete!
        </h3>
        <p className="text-sm text-[#5E6488]">
          Your converted file is ready for download.
        </p>
      </div>

      {/* File summary stats */}
      <div className="max-w-md mx-auto p-4 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl flex items-center justify-between text-left">
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <div className="w-10 h-10 rounded-lg bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center flex-shrink-0">
            <FileCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0F112E] truncate">
              {result.fileName}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-[#5E6488]">
              <span>{formatBytes(result.originalSize)}</span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
              <span className="font-semibold text-[#16A34A]">{formatBytes(result.convertedSize)}</span>
            </div>
          </div>
        </div>

        {percentSaved !== null && percentSaved > 0 && (
          <span className="text-xs font-semibold px-2 py-1 rounded bg-[#F0FDF4] text-[#16A34A] whitespace-nowrap">
            -{percentSaved}%
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <DownloadButton
          onClick={result.onDownload}
          href={result.downloadUrl}
          downloadFilename={result.fileName}
          label="Download File"
        />

        {result.onReset && (
          <button
            type="button"
            onClick={result.onReset}
            className="px-5 py-3 rounded-xl text-sm font-semibold text-[#0F112E] hover:bg-[#F4F3FA] border border-[#E4E2F0] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
          >
            Convert another file
          </button>
        )}
      </div>

      {/* Post-Action Related Tools Discovery */}
      {result.relatedTools && result.relatedTools.length > 0 && (
        <div className="mt-8 pt-6 border-t border-[#E4E2F0] text-left">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#7C3AED]">
              Next steps with your file
            </p>
            {result.categoryHubUrl && (
              <Link
                href={result.categoryHubUrl}
                className="text-xs font-medium text-[#7C3AED] hover:underline inline-flex items-center gap-1"
              >
                <span>Explore {result.categoryHubName || 'all tools'}</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {result.relatedTools.map((tool) => (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                className="p-3 bg-[#FFFFFF] border border-[#E4E2F0] hover:border-[#7C3AED]/40 hover:bg-[#F4F0FD] rounded-xl transition-all group"
              >
                <p className="text-xs font-semibold text-[#0F112E] group-hover:text-[#7C3AED] truncate">
                  {tool.name}
                </p>
                {tool.desc && (
                  <p className="text-[11px] text-[#5E6488] truncate mt-0.5">
                    {tool.desc}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ConversionResult;

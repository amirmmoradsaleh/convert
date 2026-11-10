import React from 'react';
import { Download } from 'lucide-react';
import { formatDownloadFilename } from '@/engines/shared/file-utils';

interface DownloadButtonProps {
  onClick?: () => void;
  href?: string;
  downloadFilename?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function DownloadButton({
  onClick,
  href,
  downloadFilename,
  label = 'Download Converted File',
  disabled = false,
  className = '',
}: DownloadButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9] active:bg-[#5B21B6] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base shadow-sm';

  if (href) {
    return (
      <a
        href={href}
        download={formatDownloadFilename(downloadFilename)}
        className={`${baseClasses} ${className}`}
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        <span>{label}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${className}`}
    >
      <Download className="w-4 h-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

export default DownloadButton;

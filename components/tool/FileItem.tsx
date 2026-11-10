import React from 'react';
import { X, FileText, Image as ImageIcon } from 'lucide-react';
import { formatBytes } from '@/engines/shared/file-utils';

export interface FileItemData {
  id: string;
  file: File;
  previewUrl?: string;
  status?: 'idle' | 'processing' | 'done' | 'error';
  errorMessage?: string;
}

interface FileItemProps {
  item: FileItemData;
  onRemove?: (id: string) => void;
  disabled?: boolean;
}

export function FileItem({ item, onRemove, disabled = false }: FileItemProps) {
  const isImage = Boolean(item.file?.type?.startsWith('image/'));

  return (
    <div className="flex items-center justify-between p-3.5 bg-[#FFFFFF] border border-[#E4E2F0] rounded-xl hover:border-[#7C3AED]/40 transition-colors">
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <div className="w-10 h-10 rounded-lg bg-[#F4F3FA] border border-[#E4E2F0] flex items-center justify-center flex-shrink-0 text-[#7C3AED] overflow-hidden">
          {item.previewUrl ? (
            <img
              src={item.previewUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : isImage ? (
            <ImageIcon className="w-5 h-5 text-[#7C3AED]" aria-hidden="true" />
          ) : (
            <FileText className="w-5 h-5 text-[#3B82F6]" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0F112E] truncate">
            {item.file.name}
          </p>
          <div className="flex items-center gap-2 text-xs text-[#5E6488]">
            <span>{formatBytes(item.file.size)}</span>
            {item.status && (
              <span
                className={`capitalize text-[11px] font-medium px-1.5 py-0.5 rounded ${
                  item.status === 'done'
                    ? 'bg-[#F0FDF4] text-[#16A34A]'
                    : item.status === 'error'
                    ? 'bg-[#FEF2F2] text-[#DC2626]'
                    : item.status === 'processing'
                    ? 'bg-[#F4F0FD] text-[#7C3AED]'
                    : 'text-[#5E6488]'
                }`}
              >
                {item.status}
              </span>
            )}
          </div>
        </div>
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          disabled={disabled}
          aria-label={`Remove file ${item.file.name}`}
          className="p-1.5 text-[#5E6488] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default FileItem;

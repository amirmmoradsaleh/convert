import React from 'react';
import { Trash2 } from 'lucide-react';
import FileItem, { FileItemData } from './FileItem';

interface FileListProps {
  items: FileItemData[];
  onRemove: (id: string) => void;
  onClearAll?: () => void;
  disabled?: boolean;
  className?: string;
}

export function FileList({
  items,
  onRemove,
  onClearAll,
  disabled = false,
  className = '',
}: FileListProps) {
  if (items.length === 0) return null;

  return (
    <div className={`w-full space-y-3 ${className}`}>
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#5E6488]">
        <span>Selected Files ({items.length})</span>
        {onClearAll && (
          <button
            type="button"
            onClick={onClearAll}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-[#5E6488] hover:text-[#DC2626] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded px-1"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear all</span>
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {items.map((item) => (
          <FileItem
            key={item.id}
            item={item}
            onRemove={onRemove}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

export default FileList;

'use client';

import React from 'react';
import { Pencil, ArrowUp, ArrowDown, Copy, CopyPlus, ClipboardPaste, Trash2 } from 'lucide-react';

interface InlineBlockWrapperProps {
  blockId: string;
  blockType: string;
  label: string;
  isEditing: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onCopy?: () => void;
  onPasteAfter?: () => void;
  canPaste?: boolean;
  copiedBlockLabel?: string;
  onDuplicate?: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
}

export function InlineBlockWrapper({
  blockId,
  blockType,
  label,
  isEditing,
  isSelected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onCopy,
  onPasteAfter,
  canPaste = false,
  copiedBlockLabel,
  onDuplicate,
  onDelete,
  children,
}: InlineBlockWrapperProps) {
  if (!isEditing) {
    return <>{children}</>;
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  const hasAnyActions = Boolean(
    onMoveUp || onMoveDown || onCopy || onPasteAfter || onDuplicate || onDelete
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Edit ${label} block`}
      aria-pressed={isSelected}
      onClick={(e) => {
        // Prevent clicking links/buttons inside from navigating when in edit mode
        e.preventDefault();
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={handleKeyDown}
      className={`relative group rounded-2xl transition-all duration-200 outline-none my-2 ${
        isSelected
          ? 'ring-2 ring-[#7C3AED] ring-offset-4 ring-offset-[#FCFBFF] shadow-sm bg-[#7C3AED]/[0.02]'
          : 'hover:ring-2 hover:ring-[#7C3AED]/40 hover:ring-offset-2 hover:ring-offset-[#FCFBFF] cursor-pointer'
      }`}
    >
      {/* Floating Header Controls */}
      <div className="absolute -top-3.5 right-4 z-20 flex items-center gap-1.5 transition-all">
        {/* Quick Contextual Actions (Visible on hover/selected) */}
        {hasAnyActions && (
          <div
            className={`flex items-center gap-1 bg-white border border-[#E4E2F0] rounded-full px-2 py-0.5 shadow-md ${
              isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            } transition-opacity`}
            onClick={(e) => e.stopPropagation()}
          >
            {onMoveUp && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp();
                }}
                className="p-1 hover:text-[#7C3AED] text-slate-500 rounded"
                title="Move Section Up"
                aria-label="Move Section Up"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
            )}
            {onMoveDown && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveDown();
                }}
                className="p-1 hover:text-[#7C3AED] text-slate-500 rounded"
                title="Move Section Down"
                aria-label="Move Section Down"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            )}
            {onCopy && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy();
                }}
                className="p-1 hover:text-[#7C3AED] text-slate-500 rounded"
                title={`Copy ${label} Block`}
                aria-label={`Copy ${label} Block`}
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
            {onPasteAfter && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPasteAfter();
                }}
                disabled={!canPaste}
                className={`p-1 rounded ${
                  canPaste
                    ? 'hover:text-[#7C3AED] text-amber-600'
                    : 'text-slate-300 cursor-not-allowed'
                }`}
                title={
                  canPaste
                    ? `Paste ${copiedBlockLabel ? `"${copiedBlockLabel}"` : 'Copied Block'} After This Section`
                    : 'Paste After (Clipboard is empty)'
                }
                aria-label="Paste Copied Block After This Section"
              >
                <ClipboardPaste className="w-3 h-3" />
              </button>
            )}
            {onDuplicate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }}
                className="p-1 hover:text-[#7C3AED] text-slate-500 rounded"
                title="Duplicate Section on This Page"
                aria-label="Duplicate Section"
              >
                <CopyPlus className="w-3 h-3" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1 hover:text-red-600 text-slate-500 rounded"
                title="Delete Section"
                aria-label="Delete Section"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Edit Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all shadow-md ${
            isSelected
              ? 'bg-[#7C3AED] text-white ring-2 ring-white scale-105'
              : 'bg-white text-[#7C3AED] border border-[#E4E2F0] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 hover:bg-[#F4F0FD]'
          }`}
        >
          <Pencil className="w-3 h-3" aria-hidden="true" />
          <span>{isSelected ? `Editing ${label}` : `Click to Edit ${label}`}</span>
        </div>
      </div>

      {/* Block Content */}
      <div className="pointer-events-none select-none">{children}</div>
    </div>
  );
}

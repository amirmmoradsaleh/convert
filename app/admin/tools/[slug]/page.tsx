'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  History,
  Plus,
  Trash2,
  Wrench,
  Search,
  Globe,
  Settings,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Check,
  X,
  HelpCircle,
  ListOrdered,
  Layers,
  Share2,
  Image as ImageIcon,
} from 'lucide-react';
import { getAllTools, ToolDefinition } from '@/lib/tools';
import MediaPickerModal from '@/components/admin/media/MediaPickerModal';
import {
  normalizeBlock,
  normalizeBlocksList,
  toggleBlockEnabled,
  deleteBlock as cmsDeleteBlock,
  reorderBlocks as cmsReorderBlocks,
  duplicateBlock as cmsDuplicateBlock,
  serializeBlockForClipboard,
  deserializeAndPasteBlock
} from '@/lib/cms/blocks';
import { isBatch1Tool, getBatch1ToolBlocks } from '@/lib/cms/tool-blocks-batch1';
import {
  ChevronUp,
  ChevronDown,
  Copy,
  Clipboard,
  EyeOff,
} from 'lucide-react';

interface ToolContentData {
  id?: string;
  toolSlug: string;
  customTitle: string | null;
  customH1: string | null;
  customDescription: string | null;
  customIntro: string | null;
  customValueProp: string | null;
  customHowTo: { title: string; description: string }[] | null;
  customFeatures: { title: string; description: string }[] | null;
  customFaq: { question: string; answer: string }[] | null;
  customRelatedTools: string[] | null;
  blocks?: any[] | null;
  isPublished: boolean;
  updatedAt: string | null;
  seo?: {
    seoTitle: string | null;
    metaDescription: string | null;
    canonicalUrl: string | null;
    robotsIndex: boolean;
    robotsFollow: boolean;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    twitterTitle: string | null;
    twitterDescription: string | null;
    twitterImage: string | null;
    schemaType: string | null;
    schemaJson: any | null;
    focusKeyword: string | null;
  } | null;
}

function CmsBlockEditorItem({
  block,
  idx,
  total,
  onMoveUp,
  onMoveDown,
  onToggleEnabled,
  onDuplicate,
  onCopy,
  onDelete,
  onUpdateContent,
  otherTools,
}: {
  block: any;
  idx: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleEnabled: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onUpdateContent: (content: any) => void;
  otherTools: any[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const content = block.content || {};

  // Dynamic label for the header
  const getBlockLabel = () => {
    switch (block.type) {
      case 'hero':
        return `Hero: "${content.title || 'Untitled'}"`;
      case 'benefits_trust':
        return `Benefits & Trust (${(content.items || []).length} items)`;
      case 'intro':
        return `Intro: "${content.heading || 'Untitled'}"`;
      case 'features':
        return `Features Grid (${(content.items || []).length} features)`;
      case 'how_to_use':
      case 'how_to':
        return `How To Use Steps (${(content.items || []).length} steps)`;
      case 'faq':
        return `FAQ List (${(content.items || []).length} items)`;
      case 'related_tools':
        return `Related Tools Link Grid (${(content.slugs || []).length} tools)`;
      case 'cta':
        return `CTA: "${content.title || 'Untitled'}"`;
      case 'section':
        return `Section: "${content.title || 'Untitled'}"`;
      case 'heading':
        return `Heading: [H${content.level || 2}] "${content.text || 'Untitled'}"`;
      case 'paragraph':
        return `Paragraph: "${content.text ? content.text.substring(0, 40) + '...' : 'Empty'}"`;
      case 'rich_text':
        return `HTML/Rich Text: "${content.html ? content.html.substring(0, 40) + '...' : 'Empty'}"`;
      case 'image':
        return `Image: "${content.src || 'No Source'}"`;
      case 'link':
        return `Link: "${content.text || 'Untitled'}" → ${content.href || '#'}`;
      case 'spacer':
        return `Spacer: ${content.height || 24}px`;
      case 'privacy_note':
        return `Privacy Notice: "${content.title || 'Protected'}"`;
      case 'use_cases':
        return `Use Cases (${(content.items || []).length} cases)`;
      default:
        return `${block.type.toUpperCase()} block`;
    }
  };

  return (
    <div className={`border rounded-xl transition-all shadow-xs bg-white ${
      block.enabled === false ? 'opacity-60 border-slate-200' : 'border-slate-200 hover:border-[#7C3AED]/30'
    }`}>
      {/* Header bar */}
      <div className="flex items-center justify-between p-3.5 select-none bg-[#FAF9FF] rounded-t-xl border-b border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex flex-col gap-1">
            <button
              onClick={onMoveUp}
              disabled={idx === 0}
              className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-30"
              title="Move Up"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={idx === total - 1}
              className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-30"
              title="Move Down"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div
            className="flex-1 cursor-pointer min-w-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-[#7C3AED] bg-[#F4F0FD] px-1.5 py-0.5 rounded font-bold uppercase">
                {block.type}
              </span>
              <span className="text-xs font-bold text-slate-800 truncate block">
                {getBlockLabel()}
              </span>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 shrink-0 ml-4">
          <button
            onClick={onToggleEnabled}
            className={`p-1.5 rounded-lg transition-colors ${
              block.enabled !== false
                ? 'text-emerald-600 hover:bg-emerald-50'
                : 'text-slate-400 hover:bg-slate-100'
            }`}
            title={block.enabled !== false ? "Disable block" : "Enable block"}
          >
            {block.enabled !== false ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4 text-slate-400" />
            )}
          </button>
          <button
            onClick={onCopy}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Copy block payload"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDuplicate}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Duplicate block"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            title="Delete block"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-5 bg-slate-200 mx-1" />
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            title={isExpanded ? "Collapse Editor" : "Expand Editor"}
          >
            <ChevronDown className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expanded body (Inline block editors) */}
      {isExpanded && (
        <div className="p-5 border-t border-slate-100 space-y-4 bg-white rounded-b-xl text-xs">
          {block.type === 'hero' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Badge Text (Optional)</label>
                <input
                  type="text"
                  value={content.badge || ''}
                  onChange={(e) => onUpdateContent({ ...content, badge: e.target.value })}
                  placeholder="e.g. Hot, New, Fast"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">H1 Hero Title</label>
                <input
                  type="text"
                  value={content.title || ''}
                  onChange={(e) => onUpdateContent({ ...content, title: e.target.value })}
                  placeholder="Hero headline"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Hero Description</label>
                <textarea
                  rows={2}
                  value={content.description || ''}
                  onChange={(e) => onUpdateContent({ ...content, description: e.target.value })}
                  placeholder="Hero description body"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Supporting / Disclaimer Text (Optional)</label>
                <input
                  type="text"
                  value={content.supportingText || ''}
                  onChange={(e) => onUpdateContent({ ...content, supportingText: e.target.value })}
                  placeholder="Quiet descriptive line under description"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>
            </div>
          )}

          {block.type === 'benefits_trust' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-1.5">
                <span className="font-semibold text-slate-700">Dynamic Trust Badges Collection</span>
                <button
                  onClick={() => {
                    const items = content.items || [];
                    const newItem = {
                      id: `itm-b-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      enabled: true,
                      icon: 'Check',
                      text: 'New Benefit'
                    };
                    onUpdateContent({ ...content, items: [...items, newItem] });
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7C3AED] bg-[#F4F0FD] px-2 py-0.8 rounded hover:bg-[#D1EBE5]"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Benefit Badge</span>
                </button>
              </div>

              {(content.items || []).length === 0 ? (
                <p className="text-slate-400 italic text-center py-4 bg-slate-50 rounded-lg">No trust badges added yet.</p>
              ) : (
                <div className="space-y-2">
                  {(content.items || []).map((item: any, sIdx: number) => (
                    <div key={item.id || sIdx} className="flex items-center gap-2 p-2 bg-slate-50 border rounded-lg">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => {
                            if (sIdx === 0) return;
                            const items = [...content.items];
                            const temp = items[sIdx];
                            items[sIdx] = items[sIdx - 1];
                            items[sIdx - 1] = temp;
                            onUpdateContent({ ...content, items });
                          }}
                          disabled={sIdx === 0}
                          className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (sIdx === content.items.length - 1) return;
                            const items = [...content.items];
                            const temp = items[sIdx];
                            items[sIdx] = items[sIdx + 1];
                            items[sIdx + 1] = temp;
                            onUpdateContent({ ...content, items });
                          }}
                          disabled={sIdx === content.items.length - 1}
                          className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <select
                        value={item.icon || 'Check'}
                        onChange={(e) => {
                          const items = [...content.items];
                          items[sIdx] = { ...items[sIdx], icon: e.target.value };
                          onUpdateContent({ ...content, items });
                        }}
                        className="border rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#7C3AED] shrink-0"
                      >
                        <option value="Zap">Zap (Lightning)</option>
                        <option value="Check">Check (Completed)</option>
                        <option value="Shield">Shield (Safe)</option>
                        <option value="Lock">Lock (Private)</option>
                      </select>

                      <input
                        type="text"
                        value={item.text || ''}
                        onChange={(e) => {
                          const items = [...content.items];
                          items[sIdx] = { ...items[sIdx], text: e.target.value };
                          onUpdateContent({ ...content, items });
                        }}
                        placeholder="Label"
                        className="flex-1 min-w-0 px-2 py-1 border rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                      />

                      <button
                        onClick={() => {
                          const items = [...content.items];
                          items[sIdx] = { ...items[sIdx], enabled: !items[sIdx].enabled };
                          onUpdateContent({ ...content, items });
                        }}
                        className={`p-1 rounded hover:bg-slate-200 shrink-0 ${
                          item.enabled !== false ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                        title={item.enabled !== false ? "Disable item" : "Enable item"}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          const items = [...content.items];
                          const dupe = {
                            ...item,
                            id: `itm-b-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
                          };
                          items.splice(sIdx + 1, 0, dupe);
                          onUpdateContent({ ...content, items });
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded shrink-0"
                        title="Duplicate item"
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          const items = content.items.filter((_: any, i: number) => i !== sIdx);
                          onUpdateContent({ ...content, items });
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded shrink-0"
                        title="Delete item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {block.type === 'intro' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Intro Heading</label>
                <input
                  type="text"
                  value={content.heading || ''}
                  onChange={(e) => onUpdateContent({ ...content, heading: e.target.value })}
                  placeholder="e.g. Why Convert PNG to JPG?"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Description Paragraph (Raw Text)</label>
                <textarea
                  rows={3}
                  value={content.text || ''}
                  onChange={(e) => onUpdateContent({ ...content, text: e.target.value })}
                  placeholder="Introductory body paragraph"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Or HTML Override (HTML takes precedence over Raw Text if filled)</label>
                <textarea
                  rows={3}
                  value={content.html || ''}
                  onChange={(e) => onUpdateContent({ ...content, html: e.target.value })}
                  placeholder="<p>Formatted HTML content...</p>"
                  className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>
            </div>
          )}

          {block.type === 'features' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-2 border-b">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Section Title</label>
                  <input
                    type="text"
                    value={content.heading || ''}
                    onChange={(e) => onUpdateContent({ ...content, heading: e.target.value })}
                    placeholder="e.g. Key Features"
                    className="w-full px-2.5 py-1.2 text-xs border rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Section Description</label>
                  <input
                    type="text"
                    value={content.description || ''}
                    onChange={(e) => onUpdateContent({ ...content, description: e.target.value })}
                    placeholder="e.g. High speed browser image tools"
                    className="w-full px-2.5 py-1.2 text-xs border rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Dynamic Key Features Cards</span>
                <button
                  onClick={() => {
                    const items = content.items || [];
                    const newItem = {
                      id: `itm-f-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      enabled: true,
                      title: 'New Feature',
                      description: 'Feature explanation'
                    };
                    onUpdateContent({ ...content, items: [...items, newItem] });
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7C3AED] bg-[#F4F0FD] px-2 py-0.8 rounded hover:bg-[#D1EBE5]"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Feature Card</span>
                </button>
              </div>

              {(content.items || []).length === 0 ? (
                <p className="text-slate-400 italic text-center py-4 bg-slate-50 rounded-lg">No features added yet.</p>
              ) : (
                <div className="space-y-2">
                  {(content.items || []).map((item: any, sIdx: number) => (
                    <div key={item.id || sIdx} className="p-3 bg-slate-50 border rounded-lg space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              if (sIdx === 0) return;
                              const items = [...content.items];
                              const temp = items[sIdx];
                              items[sIdx] = items[sIdx - 1];
                              items[sIdx - 1] = temp;
                              onUpdateContent({ ...content, items });
                            }}
                            disabled={sIdx === 0}
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (sIdx === content.items.length - 1) return;
                              const items = [...content.items];
                              const temp = items[sIdx];
                              items[sIdx] = items[sIdx + 1];
                              items[sIdx + 1] = temp;
                              onUpdateContent({ ...content, items });
                            }}
                            disabled={sIdx === content.items.length - 1}
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const items = [...content.items];
                              items[sIdx] = { ...items[sIdx], enabled: !items[sIdx].enabled };
                              onUpdateContent({ ...content, items });
                            }}
                            className={`p-1 rounded hover:bg-slate-200 shrink-0 ${
                              item.enabled !== false ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                            title={item.enabled !== false ? "Disable item" : "Enable item"}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const items = [...content.items];
                              const dupe = {
                                ...item,
                                id: `itm-f-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
                              };
                              items.splice(sIdx + 1, 0, dupe);
                              onUpdateContent({ ...content, items });
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded shrink-0"
                            title="Duplicate item"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const items = content.items.filter((_: any, i: number) => i !== sIdx);
                              onUpdateContent({ ...content, items });
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded shrink-0"
                            title="Delete item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="md:col-span-1">
                          <label className="block text-[10px] text-slate-500 mb-0.5">Feature Headline</label>
                          <input
                            type="text"
                            value={item.title || ''}
                            onChange={(e) => {
                              const items = [...content.items];
                              items[sIdx] = { ...items[sIdx], title: e.target.value };
                              onUpdateContent({ ...content, items });
                            }}
                            placeholder="Title"
                            className="w-full px-2 py-1.5 border rounded bg-white text-xs"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] text-slate-500 mb-0.5">Feature Description text</label>
                          <input
                            type="text"
                            value={item.description || ''}
                            onChange={(e) => {
                              const items = [...content.items];
                              items[sIdx] = { ...items[sIdx], description: e.target.value };
                              onUpdateContent({ ...content, items });
                            }}
                            placeholder="Description"
                            className="w-full px-2 py-1.5 border rounded bg-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(block.type === 'how_to_use' || block.type === 'how_to') && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-2 border-b">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Section Title</label>
                  <input
                    type="text"
                    value={content.heading || ''}
                    onChange={(e) => onUpdateContent({ ...content, heading: e.target.value })}
                    placeholder="e.g. How to Use png-to-jpg"
                    className="w-full px-2.5 py-1.2 text-xs border rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Section Description</label>
                  <input
                    type="text"
                    value={content.description || ''}
                    onChange={(e) => onUpdateContent({ ...content, description: e.target.value })}
                    placeholder="e.g. Drag and drop to convert instantly"
                    className="w-full px-2.5 py-1.2 text-xs border rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Dynamic How-To Step Items</span>
                <button
                  onClick={() => {
                    const items = content.items || [];
                    const newItem = {
                      id: `itm-h-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      enabled: true,
                      title: 'New Step',
                      description: 'Step explanation'
                    };
                    onUpdateContent({ ...content, items: [...items, newItem] });
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7C3AED] bg-[#F4F0FD] px-2 py-0.8 rounded hover:bg-[#D1EBE5]"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Step Item</span>
                </button>
              </div>

              {(content.items || []).length === 0 ? (
                <p className="text-slate-400 italic text-center py-4 bg-slate-50 rounded-lg">No steps added yet.</p>
              ) : (
                <div className="space-y-2">
                  {(content.items || []).map((item: any, sIdx: number) => (
                    <div key={item.id || sIdx} className="p-3 bg-slate-50 border rounded-lg space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              if (sIdx === 0) return;
                              const items = [...content.items];
                              const temp = items[sIdx];
                              items[sIdx] = items[sIdx - 1];
                              items[sIdx - 1] = temp;
                              onUpdateContent({ ...content, items });
                            }}
                            disabled={sIdx === 0}
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (sIdx === content.items.length - 1) return;
                              const items = [...content.items];
                              const temp = items[sIdx];
                              items[sIdx] = items[sIdx + 1];
                              items[sIdx + 1] = temp;
                              onUpdateContent({ ...content, items });
                            }}
                            disabled={sIdx === content.items.length - 1}
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const items = [...content.items];
                              items[sIdx] = { ...items[sIdx], enabled: !items[sIdx].enabled };
                              onUpdateContent({ ...content, items });
                            }}
                            className={`p-1 rounded hover:bg-slate-200 shrink-0 ${
                              item.enabled !== false ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                            title={item.enabled !== false ? "Disable item" : "Enable item"}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const items = [...content.items];
                              const dupe = {
                                ...item,
                                id: `itm-h-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
                              };
                              items.splice(sIdx + 1, 0, dupe);
                              onUpdateContent({ ...content, items });
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded shrink-0"
                            title="Duplicate item"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const items = content.items.filter((_: any, i: number) => i !== sIdx);
                              onUpdateContent({ ...content, items });
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded shrink-0"
                            title="Delete item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="md:col-span-1">
                          <label className="block text-[10px] text-slate-500 mb-0.5">Step Headline</label>
                          <input
                            type="text"
                            value={item.title || ''}
                            onChange={(e) => {
                              const items = [...content.items];
                              items[sIdx] = { ...items[sIdx], title: e.target.value };
                              onUpdateContent({ ...content, items });
                            }}
                            placeholder="Title"
                            className="w-full px-2 py-1.5 border rounded bg-white text-xs"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] text-slate-500 mb-0.5">Step Explanation details</label>
                          <input
                            type="text"
                            value={item.description || ''}
                            onChange={(e) => {
                              const items = [...content.items];
                              items[sIdx] = { ...items[sIdx], description: e.target.value };
                              onUpdateContent({ ...content, items });
                            }}
                            placeholder="Description"
                            className="w-full px-2 py-1.5 border rounded bg-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {block.type === 'faq' && (
            <div className="space-y-3">
              <div className="pb-2 border-b">
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">FAQ Grid Headline</label>
                <input
                  type="text"
                  value={content.heading || ''}
                  onChange={(e) => onUpdateContent({ ...content, heading: e.target.value })}
                  placeholder="e.g. Frequently Asked Questions"
                  className="w-full md:w-1/2 px-2.5 py-1.2 text-xs border rounded-lg focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Dynamic FAQ Accordion Items</span>
                <button
                  onClick={() => {
                    const items = content.items || [];
                    const newItem = {
                      id: `itm-faq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      enabled: true,
                      question: 'New Question',
                      answer: 'New answer'
                    };
                    onUpdateContent({ ...content, items: [...items, newItem] });
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7C3AED] bg-[#F4F0FD] px-2 py-0.8 rounded hover:bg-[#D1EBE5]"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add FAQ Item</span>
                </button>
              </div>

              {(content.items || []).length === 0 ? (
                <p className="text-slate-400 italic text-center py-4 bg-slate-50 rounded-lg">No FAQs added yet.</p>
              ) : (
                <div className="space-y-2">
                  {(content.items || []).map((item: any, sIdx: number) => (
                    <div key={item.id || sIdx} className="p-3 bg-slate-50 border rounded-lg space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              if (sIdx === 0) return;
                              const items = [...content.items];
                              const temp = items[sIdx];
                              items[sIdx] = items[sIdx - 1];
                              items[sIdx - 1] = temp;
                              onUpdateContent({ ...content, items });
                            }}
                            disabled={sIdx === 0}
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (sIdx === content.items.length - 1) return;
                              const items = [...content.items];
                              const temp = items[sIdx];
                              items[sIdx] = items[sIdx + 1];
                              items[sIdx + 1] = temp;
                              onUpdateContent({ ...content, items });
                            }}
                            disabled={sIdx === content.items.length - 1}
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const items = [...content.items];
                              items[sIdx] = { ...items[sIdx], enabled: !items[sIdx].enabled };
                              onUpdateContent({ ...content, items });
                            }}
                            className={`p-1 rounded hover:bg-slate-200 shrink-0 ${
                              item.enabled !== false ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                            title={item.enabled !== false ? "Disable item" : "Enable item"}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const items = [...content.items];
                              const dupe = {
                                ...item,
                                id: `itm-faq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
                              };
                              items.splice(sIdx + 1, 0, dupe);
                              onUpdateContent({ ...content, items });
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded shrink-0"
                            title="Duplicate item"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const items = content.items.filter((_: any, i: number) => i !== sIdx);
                              onUpdateContent({ ...content, items });
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded shrink-0"
                            title="Delete item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Question</label>
                          <input
                            type="text"
                            value={item.question || ''}
                            onChange={(e) => {
                              const items = [...content.items];
                              items[sIdx] = { ...items[sIdx], question: e.target.value };
                              onUpdateContent({ ...content, items });
                            }}
                            placeholder="Question"
                            className="w-full px-2 py-1.5 border rounded bg-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Answer</label>
                          <textarea
                            rows={2}
                            value={item.answer || ''}
                            onChange={(e) => {
                              const items = [...content.items];
                              items[sIdx] = { ...items[sIdx], answer: e.target.value };
                              onUpdateContent({ ...content, items });
                            }}
                            placeholder="Answer text"
                            className="w-full px-2 py-1.5 border rounded bg-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {block.type === 'related_tools' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Grid Section Heading</label>
                <input
                  type="text"
                  value={content.heading || ''}
                  onChange={(e) => onUpdateContent({ ...content, heading: e.target.value })}
                  placeholder="e.g. Related Utilities"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#0F112E] mb-1.5">
                  Select Associated Canonical Slugs (Maximum 4 recommended)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 bg-slate-50 p-3 rounded-lg max-h-[160px] overflow-y-auto">
                  {otherTools.map((t) => {
                    const slugs = content.slugs || [];
                    const isChecked = slugs.includes(t.slug);
                    return (
                      <label key={t.slug} className="flex items-center gap-2 cursor-pointer p-1 text-[11px] hover:bg-slate-100 rounded">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            let nextSlugs = [...slugs];
                            if (isChecked) {
                              nextSlugs = nextSlugs.filter((s) => s !== t.slug);
                            } else {
                              nextSlugs = [...nextSlugs, t.slug];
                            }
                            onUpdateContent({ ...content, slugs: nextSlugs });
                          }}
                          className="rounded border-slate-300 text-[#7C3AED] focus:ring-[#7C3AED]"
                        />
                        <span className="truncate">{t.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {block.type === 'cta' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Banner Title</label>
                <input
                  type="text"
                  value={content.title || ''}
                  onChange={(e) => onUpdateContent({ ...content, title: e.target.value })}
                  placeholder="Premium headline"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Banner Description Text</label>
                <textarea
                  rows={2}
                  value={content.description || ''}
                  onChange={(e) => onUpdateContent({ ...content, description: e.target.value })}
                  placeholder="Description paragraph"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Button text label</label>
                  <input
                    type="text"
                    value={content.buttonText || ''}
                    onChange={(e) => onUpdateContent({ ...content, buttonText: e.target.value })}
                    placeholder="e.g. Explore All Tools"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Button target link URL</label>
                  <input
                    type="text"
                    value={content.href || ''}
                    onChange={(e) => onUpdateContent({ ...content, href: e.target.value })}
                    placeholder="e.g. /"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {block.type === 'section' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Section Title</label>
                <input
                  type="text"
                  value={content.title || ''}
                  onChange={(e) => onUpdateContent({ ...content, title: e.target.value })}
                  placeholder="Section heading text"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Section Description (Optional)</label>
                <textarea
                  rows={2}
                  value={content.description || ''}
                  onChange={(e) => onUpdateContent({ ...content, description: e.target.value })}
                  placeholder="Section paragraph body"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
          )}

          {block.type === 'heading' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">HTML level</label>
                  <select
                    value={content.level || 2}
                    onChange={(e) => onUpdateContent({ ...content, level: parseInt(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value={1}>H1</option>
                    <option value={2}>H2</option>
                    <option value={3}>H3</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Heading text content</label>
                  <input
                    type="text"
                    value={content.text || ''}
                    onChange={(e) => onUpdateContent({ ...content, text: e.target.value })}
                    placeholder="Headline text"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {block.type === 'paragraph' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Paragraph Text content</label>
              <textarea
                rows={3}
                value={content.text || ''}
                onChange={(e) => onUpdateContent({ ...content, text: e.target.value })}
                placeholder="Descriptive paragraph..."
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
              />
            </div>
          )}

          {block.type === 'rich_text' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1 font-mono">Custom HTML / Rich Text payload</label>
              <textarea
                rows={4}
                value={content.html || ''}
                onChange={(e) => onUpdateContent({ ...content, html: e.target.value })}
                placeholder="<p>Write your markup content here...</p>"
                className="w-full px-3 py-1.5 font-mono border border-slate-200 rounded-lg focus:outline-none"
              />
            </div>
          )}

          {block.type === 'image' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Image source URL</label>
                <input
                  type="text"
                  value={content.src || ''}
                  onChange={(e) => onUpdateContent({ ...content, src: e.target.value })}
                  placeholder="https://images.unsplash.com/... or path"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Alt description</label>
                  <input
                    type="text"
                    value={content.alt || ''}
                    onChange={(e) => onUpdateContent({ ...content, alt: e.target.value })}
                    placeholder="Alternative description text"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Caption (Optional)</label>
                  <input
                    type="text"
                    value={content.caption || ''}
                    onChange={(e) => onUpdateContent({ ...content, caption: e.target.value })}
                    placeholder="Image caption text"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {block.type === 'link' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Anchor link text</label>
                <input
                  type="text"
                  value={content.text || ''}
                  onChange={(e) => onUpdateContent({ ...content, text: e.target.value })}
                  placeholder="e.g. Visit homepage"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Target URL link</label>
                  <input
                    type="text"
                    value={content.href || ''}
                    onChange={(e) => onUpdateContent({ ...content, href: e.target.value })}
                    placeholder="e.g. /"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    checked={Boolean(content.isExternal)}
                    onChange={(e) => onUpdateContent({ ...content, isExternal: e.target.checked })}
                    className="rounded border-slate-300 focus:ring-[#7C3AED] text-[#7C3AED]"
                  />
                  <span className="text-[11px] font-semibold text-slate-700">Open in a new browser tab</span>
                </div>
              </div>
            </div>
          )}

          {block.type === 'spacer' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Spacer Height (px)</label>
              <input
                type="number"
                value={content.height || 24}
                onChange={(e) => onUpdateContent({ ...content, height: parseInt(e.target.value) || 0 })}
                placeholder="24"
                className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg"
              />
            </div>
          )}

          {block.type === 'privacy_note' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Privacy Notice Title</label>
                <input
                  type="text"
                  value={content.title || ''}
                  onChange={(e) => onUpdateContent({ ...content, title: e.target.value })}
                  placeholder="e.g. Your Files Stay Private on Your Device"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Privacy Description</label>
                <textarea
                  rows={3}
                  value={content.description || ''}
                  onChange={(e) => onUpdateContent({ ...content, description: e.target.value })}
                  placeholder="Privacy commitment description..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Bullet Points (One per line)</label>
                <textarea
                  rows={3}
                  value={Array.isArray(content.bullets) ? content.bullets.join('\n') : ''}
                  onChange={(e) =>
                    onUpdateContent({
                      ...content,
                      bullets: e.target.value.split('\n').filter((l: string) => l.trim().length > 0),
                    })
                  }
                  placeholder="Zero server uploads...\nNo telemetry...\nAutomatic cleanup..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
          )}

          {block.type === 'use_cases' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-2 border-b">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Section Title</label>
                  <input
                    type="text"
                    value={content.heading || ''}
                    onChange={(e) => onUpdateContent({ ...content, heading: e.target.value })}
                    placeholder="e.g. Common Use Cases"
                    className="w-full px-2.5 py-1.2 text-xs border rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Section Description</label>
                  <input
                    type="text"
                    value={content.description || ''}
                    onChange={(e) => onUpdateContent({ ...content, description: e.target.value })}
                    placeholder="e.g. Practical scenarios where this tool saves time..."
                    className="w-full px-2.5 py-1.2 text-xs border rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Use Case Items</span>
                <button
                  onClick={() => {
                    const items = content.items || [];
                    const newItem = {
                      id: `itm-uc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      enabled: true,
                      title: 'New Use Case',
                      description: 'Scenario explanation'
                    };
                    onUpdateContent({ ...content, items: [...items, newItem] });
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7C3AED] bg-[#F4F0FD] px-2 py-0.8 rounded hover:bg-[#D1EBE5]"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Use Case</span>
                </button>
              </div>

              {(content.items || []).length === 0 ? (
                <p className="text-slate-400 italic text-center py-4 bg-slate-50 rounded-lg">No use cases added yet.</p>
              ) : (
                <div className="space-y-2">
                  {(content.items || []).map((item: any, sIdx: number) => (
                    <div key={item.id || sIdx} className="p-3 bg-slate-50 border rounded-lg space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700">Case #{sIdx + 1}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const items = content.items.filter((_: any, i: number) => i !== sIdx);
                              onUpdateContent({ ...content, items });
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded shrink-0"
                            title="Delete case"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Title</label>
                          <input
                            type="text"
                            value={item.title || ''}
                            onChange={(e) => {
                              const items = [...content.items];
                              items[sIdx] = { ...items[sIdx], title: e.target.value };
                              onUpdateContent({ ...content, items });
                            }}
                            className="w-full px-2 py-1.5 border rounded bg-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Description</label>
                          <input
                            type="text"
                            value={item.description || ''}
                            onChange={(e) => {
                              const items = [...content.items];
                              items[sIdx] = { ...items[sIdx], description: e.target.value };
                              onUpdateContent({ ...content, items });
                            }}
                            className="w-full px-2 py-1.5 border rounded bg-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ToolEditorProps {
  params: Promise<{ slug: string }>;
}

export default function AdminToolEditor({ params }: ToolEditorProps) {
  const { slug } = use(params);
  const router = useRouter();

  const [canonical, setCanonical] = useState<ToolDefinition | null>(null);
  const [override, setOverride] = useState<ToolContentData | null>(null);
  const [activeTab, setActiveTab] = useState<'CONTENT' | 'HOW_TO' | 'FEATURES' | 'FAQ' | 'RELATED' | 'SEO' | 'PUBLISHING' | 'BLOCKS'>('CONTENT');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Form Fields - Basic
  const [customTitle, setCustomTitle] = useState('');
  const [customH1, setCustomH1] = useState('');
  const [customIntro, setCustomIntro] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customValueProp, setCustomValueProp] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [blocks, setBlocks] = useState<any[]>([]);

  // Form Fields - Structured
  const [howToSteps, setHowToSteps] = useState<{ title: string; description: string }[]>([]);
  const [featuresList, setFeaturesList] = useState<{ title: string; description: string }[]>([]);
  const [faqList, setFaqList] = useState<{ question: string; answer: string }[]>([]);
  const [relatedToolsList, setRelatedToolsList] = useState<string[]>([]);

  // Form Fields - SEO
  const [seoTitle, setSeoTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [robotsFollow, setRobotsFollow] = useState(true);
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImage, setOgImage] = useState('');
  const [twitterTitle, setTwitterTitle] = useState('');
  const [twitterDescription, setTwitterDescription] = useState('');
  const [twitterImage, setTwitterImage] = useState('');
  const [schemaJsonText, setSchemaJsonText] = useState('');
  const [jsonValidationResult, setJsonValidationResult] = useState<{ valid: boolean; message: string } | null>(null);

  // Media Picker State
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);

  const all25Tools = getAllTools();
  const otherTools = all25Tools.filter((t) => t.slug !== slug);

  const fetchToolData = async (preserveStatus = false) => {
    setIsLoading(true);
    if (!preserveStatus) {
      setStatusMessage(null);
    }
    try {
      const res = await fetch(`/api/admin/tools/${slug}`);
      if (!res.ok) {
        throw new Error('Tool not found or server error.');
      }
      const data = await res.json();
      setCanonical(data.canonical);
      const ov = data.override;
      setOverride(ov);

      if (ov) {
        setCustomTitle(ov.customTitle || '');
        setCustomH1(ov.customH1 || '');
        setCustomIntro(ov.customIntro || '');
        setCustomDescription(ov.customDescription || '');
        setCustomValueProp(ov.customValueProp || '');
        setHowToSteps(Array.isArray(ov.customHowTo) ? ov.customHowTo : []);
        setFeaturesList(Array.isArray(ov.customFeatures) ? ov.customFeatures : []);
        setFaqList(Array.isArray(ov.customFaq) ? ov.customFaq : []);
        setRelatedToolsList(Array.isArray(ov.customRelatedTools) ? ov.customRelatedTools : []);
        setBlocks(Array.isArray(ov.blocks) ? ov.blocks : []);

        if (ov.seo) {
          setSeoTitle(ov.seo.seoTitle || '');
          setMetaDescription(ov.seo.metaDescription || '');
          setCanonicalUrl(ov.seo.canonicalUrl || '');
          setRobotsIndex(ov.seo.robotsIndex !== false);
          setRobotsFollow(ov.seo.robotsFollow !== false);
          setOgTitle(ov.seo.ogTitle || '');
          setOgDescription(ov.seo.ogDescription || '');
          setOgImage(ov.seo.ogImage || '');
          setTwitterTitle(ov.seo.twitterTitle || '');
          setTwitterDescription(ov.seo.twitterDescription || '');
          setTwitterImage(ov.seo.twitterImage || '');
          setSchemaJsonText(ov.seo.schemaJson ? JSON.stringify(ov.seo.schemaJson, null, 2) : '');
        }
      } else {
        // No override yet - initialize canonical defaults for convenience
        setCanonicalUrl(`/tools/${slug}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching tool details.';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchToolData();
  }, [slug]);

  // JSON-LD Validator
  useEffect(() => {
    if (!schemaJsonText.trim()) {
      setJsonValidationResult(null);
      return;
    }
    try {
      JSON.parse(schemaJsonText);
      setJsonValidationResult({ valid: true, message: 'Valid JSON-LD schema syntax.' });
    } catch {
      setJsonValidationResult({ valid: false, message: 'Invalid JSON format. Check syntax, commas, and quotes.' });
    }
  }, [schemaJsonText]);

  // How-to handlers
  const handleAddStep = () => {
    setHowToSteps([...howToSteps, { title: '', description: '' }]);
  };
  const handleRemoveStep = (idx: number) => {
    setHowToSteps(howToSteps.filter((_, i) => i !== idx));
  };
  const handleStepChange = (idx: number, field: 'title' | 'description', val: string) => {
    const next = [...howToSteps];
    next[idx][field] = val;
    setHowToSteps(next);
  };
  const handleLoadCanonicalHowTo = () => {
    if (canonical?.howTo) {
      setHowToSteps([...canonical.howTo]);
      setStatusMessage({ type: 'success', text: 'Loaded canonical how-to steps into editor.' });
    }
  };

  // Features handlers
  const handleAddFeature = () => {
    setFeaturesList([...featuresList, { title: '', description: '' }]);
  };
  const handleRemoveFeature = (idx: number) => {
    setFeaturesList(featuresList.filter((_, i) => i !== idx));
  };
  const handleFeatureChange = (idx: number, field: 'title' | 'description', val: string) => {
    const next = [...featuresList];
    next[idx][field] = val;
    setFeaturesList(next);
  };
  const handleLoadCanonicalFeatures = () => {
    if (canonical?.features) {
      setFeaturesList([...canonical.features]);
      setStatusMessage({ type: 'success', text: 'Loaded canonical features into editor.' });
    }
  };

  // FAQ handlers
  const handleAddFaq = () => {
    setFaqList([...faqList, { question: '', answer: '' }]);
  };
  const handleRemoveFaq = (idx: number) => {
    setFaqList(faqList.filter((_, i) => i !== idx));
  };
  const handleFaqChange = (idx: number, field: 'question' | 'answer', val: string) => {
    const next = [...faqList];
    next[idx][field] = val;
    setFaqList(next);
  };
  const handleLoadCanonicalFaq = () => {
    if (canonical?.faq) {
      setFaqList([...canonical.faq]);
      setStatusMessage({ type: 'success', text: 'Loaded canonical FAQ items into editor.' });
    }
  };

  // Related Tools handlers
  const handleToggleRelatedTool = (toolSlug: string) => {
    if (relatedToolsList.includes(toolSlug)) {
      setRelatedToolsList(relatedToolsList.filter((s) => s !== toolSlug));
    } else {
      setRelatedToolsList([...relatedToolsList, toolSlug]);
    }
  };
  const handleLoadCanonicalRelated = () => {
    if (canonical?.relatedTools) {
      setRelatedToolsList([...canonical.relatedTools]);
      setStatusMessage({ type: 'success', text: 'Loaded canonical related tools into editor.' });
    }
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    // Validate JSON-LD if present
    let parsedSchema: any = null;
    if (schemaJsonText.trim()) {
      try {
        parsedSchema = JSON.parse(schemaJsonText);
      } catch {
        setStatusMessage({ type: 'error', text: 'Cannot save: JSON-LD structured data contains syntax errors.' });
        setIsSaving(false);
        return;
      }
    }

    try {
      const payload = {
        customTitle: customTitle.trim() || null,
        customH1: customH1.trim() || null,
        customIntro: customIntro.trim() || null,
        customDescription: customDescription.trim() || null,
        customValueProp: customValueProp.trim() || null,
        customHowTo: howToSteps.length > 0 ? howToSteps : null,
        customFeatures: featuresList.length > 0 ? featuresList : null,
        customFaq: faqList.length > 0 ? faqList : null,
        customRelatedTools: relatedToolsList.length > 0 ? relatedToolsList : null,
        blocks: blocks.length > 0 ? blocks : null,
        reason: revisionReason.trim() || 'Saved draft from admin editor',
        seo: {
          seoTitle: seoTitle.trim() || null,
          metaDescription: metaDescription.trim() || null,
          canonicalUrl: canonicalUrl.trim() || null,
          robotsIndex,
          robotsFollow,
          ogTitle: ogTitle.trim() || null,
          ogDescription: ogDescription.trim() || null,
          ogImage: ogImage.trim() || null,
          twitterTitle: twitterTitle.trim() || null,
          twitterDescription: twitterDescription.trim() || null,
          twitterImage: twitterImage.trim() || null,
          schemaJson: parsedSchema,
        },
      };

      const res = await fetch(`/api/admin/tools/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save tool draft.');
      }

      setRevisionReason('');
      await fetchToolData(true);
      setStatusMessage({ type: 'success', text: 'Draft content saved and revision snapshot created.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save.';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/admin/tools/${slug}/publish`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish tool.');

      await fetchToolData(true);
      setStatusMessage({ type: 'success', text: `Tool '${canonical?.name}' is now PUBLISHED with CMS overrides active on public routes.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Publish failed.';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!confirm(`Are you sure you want to unpublish '${canonical?.name}'? The public page will immediately fall back to canonical code defaults.`)) {
      return;
    }
    setIsPublishing(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/admin/tools/${slug}/unpublish`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unpublish tool.');

      await fetchToolData(true);
      setStatusMessage({ type: 'warning', text: `Tool unpublished. Public page reverted to canonical defaults.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unpublish failed.';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-xs text-[#5E6488]">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#7C3AED]" />
        <span>Loading tool editor for {slug}...</span>
      </div>
    );
  }

  if (!canonical) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-[#E4E2F0] space-y-3">
        <AlertTriangle className="w-8 h-8 text-[#E11D48] mx-auto" />
        <h2 className="text-base font-bold text-[#0F112E]">Tool Not Found</h2>
        <p className="text-xs text-[#5E6488]">
          The slug <code className="px-1.5 py-0.5 bg-[#F4F3FA] font-mono">{slug}</code> does not exist in the authoritative 25-tool registry.
        </p>
        <Link
          href="/admin/tools"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#7C3AED] bg-[#F4F0FD] rounded-lg hover:bg-[#D1EBE5]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Tools Directory</span>
        </Link>
      </div>
    );
  }

  const isPublished = Boolean(override?.isPublished);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#E4E2F0] shadow-subtle">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/tools"
            className="p-2 text-[#5E6488] hover:text-[#0F112E] hover:bg-[#F4F3FA] rounded-lg transition-colors"
            title="Back to Tools"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#0F112E]">{canonical.name}</h1>
              {isPublished ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                  <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                  Published CMS
                </span>
              ) : override ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">
                  <Clock className="w-3 h-3 text-[#F59E0B]" />
                  Draft Overrides Saved
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F4F3FA] text-[#5E6488] border border-[#E4E2F0]">
                  Code Default (No Overrides)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-[#5E6488] mt-0.5 font-mono">
              <span>/tools/{canonical.slug}</span>
              <span>•</span>
              <span className="uppercase text-[10px] bg-[#F4F3FA] px-1.5 py-0.2 rounded font-sans text-[#475467]">
                {canonical.category}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preview Draft */}
          <Link
            href={`/admin/tools/${canonical.slug}/preview`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#475467] bg-white border border-[#E4E2F0] rounded-lg hover:bg-[#F4F3FA] transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span>Preview Draft</span>
          </Link>

          {/* Revisions History */}
          <Link
            href={`/admin/tools/${canonical.slug}/revisions`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#475467] bg-white border border-[#E4E2F0] rounded-lg hover:bg-[#F4F3FA] transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            <span>Revisions</span>
          </Link>

          {/* Save Draft */}
          <button
            onClick={handleSaveDraft}
            disabled={isSaving || isPublishing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg transition-colors shadow-xs disabled:opacity-50"
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
          </button>

          {/* Publish / Unpublish */}
          {isPublished ? (
            <button
              onClick={handleUnpublish}
              disabled={isPublishing || isSaving}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-[#92400E] bg-[#FEF3C7] hover:bg-[#FDE68A] rounded-lg transition-colors disabled:opacity-50"
            >
              <span>Unpublish</span>
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={isPublishing || isSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#10B981] hover:bg-[#059669] rounded-lg transition-colors shadow-xs disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isPublishing ? 'Publishing...' : 'Publish'}</span>
            </button>
          )}

          {/* Public Live View */}
          <Link
            href={`/tools/${canonical.slug}`}
            target="_blank"
            className="p-2 text-[#5E6488] hover:text-[#0F112E] rounded-lg transition-colors"
            title="Open live public URL"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]'
              : statusMessage.type === 'error'
              ? 'bg-[#FFF1F2] border-[#FECDD3] text-[#9F1239]'
              : 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-white rounded-xl border border-[#E4E2F0] shadow-subtle">
        {[
          { key: 'CONTENT', label: 'Basic Info', icon: Wrench },
          { key: 'BLOCKS', label: `CMS Blocks (${blocks.length})`, icon: Layers },
          { key: 'HOW_TO', label: `How-To Steps (${howToSteps.length})`, icon: ListOrdered },
          { key: 'FEATURES', label: `Features (${featuresList.length})`, icon: Sparkles },
          { key: 'FAQ', label: `FAQ (${faqList.length})`, icon: HelpCircle },
          { key: 'RELATED', label: `Related Tools (${relatedToolsList.length})`, icon: Layers },
          { key: 'SEO', label: 'Advanced SEO', icon: Globe },
          { key: 'PUBLISHING', label: 'Publishing & Audit', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                isActive
                  ? 'bg-[#7C3AED] text-white shadow-xs'
                  : 'text-[#5E6488] hover:text-[#0F112E] hover:bg-[#F4F3FA]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab: Basic Content */}
      {activeTab === 'CONTENT' && (
        <div className="bg-white p-6 rounded-xl border border-[#E4E2F0] shadow-subtle space-y-5">
          <div className="border-b border-[#E4E2F0] pb-3">
            <h2 className="text-sm font-bold text-[#0F112E]">Tool Basic Content Overrides</h2>
            <p className="text-xs text-[#5E6488] mt-0.5">
              Any field left empty automatically falls back to the canonical code definition in <code className="font-mono">lib/tools.ts</code>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="custom-title-input" className="block text-xs font-semibold text-[#0F112E] mb-1">
                Display Title Override
              </label>
              <input
                id="custom-title-input"
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={canonical.title}
                className="w-full px-3 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              />
              <span className="text-[10px] text-[#5E6488] mt-0.5 block">
                Canonical: {canonical.title}
              </span>
            </div>

            <div>
              <label htmlFor="custom-h1-input" className="block text-xs font-semibold text-[#0F112E] mb-1">
                H1 Main Heading Override
              </label>
              <input
                id="custom-h1-input"
                type="text"
                value={customH1}
                onChange={(e) => setCustomH1(e.target.value)}
                placeholder={canonical.h1}
                className="w-full px-3 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              />
              <span className="text-[10px] text-[#5E6488] mt-0.5 block">
                Canonical: {canonical.h1}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F112E] mb-1">
              Short Description Override
            </label>
            <textarea
              rows={2}
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder={canonical.description}
              className="w-full px-3 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            />
            <span className="text-[10px] text-[#5E6488] mt-0.5 block">
              Canonical: {canonical.description}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F112E] mb-1">
              Intro Paragraph Override
            </label>
            <textarea
              rows={4}
              value={customIntro}
              onChange={(e) => setCustomIntro(e.target.value)}
              placeholder={canonical.intro}
              className="w-full px-3 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            />
            <span className="text-[10px] text-[#5E6488] mt-0.5 block line-clamp-2">
              Canonical: {canonical.intro}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F112E] mb-1">
              Value Proposition Override
            </label>
            <textarea
              rows={2}
              value={customValueProp}
              onChange={(e) => setCustomValueProp(e.target.value)}
              placeholder={canonical.valueProposition || 'Value proposition...'}
              className="w-full px-3 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            />
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold text-[#0F112E] mb-1">
              Revision Log Note (Optional)
            </label>
            <input
              type="text"
              value={revisionReason}
              onChange={(e) => setRevisionReason(e.target.value)}
              placeholder="e.g. Updated H1 and intro for seasonal SEO push"
              className="w-full px-3 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            />
          </div>
        </div>
      )}

      {/* Tab: CMS Blocks */}
      {activeTab === 'BLOCKS' && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="bg-white p-6 rounded-xl border border-[#E4E2F0] shadow-subtle space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E2F0] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#0F112E]">Universal Content Blocks Builder</h2>
                <p className="text-xs text-[#5E6488] mt-0.5">
                  Manage the full-page narrative structures surrounding this functional tool.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {slug === 'png-to-jpg' && blocks.length === 0 && (
                  <button
                    onClick={() => {
                      const defaultPngToJpgBlocks = [
                        {
                          "id": "blk-default-hero",
                          "type": "hero",
                          "enabled": true,
                          "order": 0,
                          "content": {
                            "title": "Convert PNG to JPG",
                            "description": "Convert PNG images into lightweight, universal JPG files directly in your browser. Control output quality and choose a solid white or black background for transparent areas."
                          }
                        },
                        {
                          "id": "blk-default-benefits",
                          "type": "benefits_trust",
                          "enabled": true,
                          "order": 1,
                          "content": {
                            "items": [
                              { "id": "itm-b1", "enabled": true, "icon": "Zap", "text": "Fast & Local" },
                              { "id": "itm-b2", "enabled": true, "icon": "Check", "text": "100% Free" },
                              { "id": "itm-b3", "enabled": true, "icon": "Shield", "text": "No Signup" },
                              { "id": "itm-b4", "enabled": true, "icon": "Lock", "text": "Client-Side Privacy" }
                            ]
                          }
                        },
                        {
                          "id": "blk-default-intro",
                          "type": "intro",
                          "enabled": true,
                          "order": 2,
                          "content": {
                            "heading": "Why Convert PNG to JPG?",
                            "text": "PNG files are lossless and support transparency, but they can be extremely large. JPG uses efficient lossy compression which significantly reduces file sizes, making them perfect for sharing, uploading, or embedding in websites and documents."
                          }
                        },
                        {
                          "id": "blk-default-how-to",
                          "type": "how_to_use",
                          "enabled": true,
                          "order": 3,
                          "content": {
                            "heading": "How to Use PNG to JPG",
                            "description": "Follow these simple steps to process your files directly in your browser.",
                            "items": [
                              { "id": "itm-h1", "enabled": true, "title": "Upload your PNG files", "description": "Drag and drop your PNG images into the dropzone or click to browse files from your device." },
                              { "id": "itm-h2", "enabled": true, "title": "Choose JPG quality and background color", "description": "Select your preferred JPG compression level (High 90%, Medium 80%, or Low 70%) and background color for transparency." },
                              { "id": "itm-h3", "enabled": true, "title": "Click Convert to JPG", "description": "Hit the Convert to JPG button to begin client-side processing directly in your browser." },
                              { "id": "itm-h4", "enabled": true, "title": "Download your JPG files", "description": "Download your converted JPG images individually or save all of them together as a ZIP archive." }
                            ]
                          }
                        },
                        {
                          "id": "blk-default-features",
                          "type": "features",
                          "enabled": true,
                          "order": 4,
                          "content": {
                            "heading": "Key Features of PNG to JPG",
                            "description": "Engineered for speed, privacy, and seamless browser-based processing.",
                            "items": [
                              { "id": "itm-f1", "enabled": true, "title": "PNG to JPG Conversion", "description": "Fast, high-fidelity conversion from PNG to universal JPEG format." },
                              { "id": "itm-f2", "enabled": true, "title": "Multiple Files", "description": "Convert up to 20 PNG images simultaneously in a single batch." },
                              { "id": "itm-f3", "enabled": true, "title": "50 MB per File", "description": "Handles large high-resolution PNG photos and illustrations up to 50 MB each." },
                              { "id": "itm-f4", "enabled": true, "title": "JPG Quality Options", "description": "Easily select High (90%), Medium (80%), or Low (70%) compression." },
                              { "id": "itm-f5", "enabled": true, "title": "White or Background transparency", "description": "Cleanly composite transparent or semi-transparent areas onto your choice of solid white or black." },
                              { "id": "itm-f6", "enabled": true, "title": "Original Dimensions Preserved", "description": "Preserves the exact pixel width and height of each image without resizing or stretching." }
                            ]
                          }
                        },
                        {
                          "id": "blk-default-faq",
                          "type": "faq",
                          "enabled": true,
                          "order": 5,
                          "content": {
                            "heading": "Frequently Asked Questions",
                            "items": [
                              { "id": "itm-q1", "enabled": true, "question": "What happens to transparent areas when converting PNG to JPG?", "answer": "JPG format does not support transparency. Any transparent or semi-transparent areas in your PNG are cleanly filled with your choice of a solid white or black background before saving." },
                              { "id": "itm-q2", "enabled": true, "question": "Can I convert multiple PNG files at once?", "answer": "Yes, you can upload and convert up to 20 PNG files in a single batch and download them individually or all together as a convenient ZIP archive." }
                            ]
                          }
                        },
                        {
                          "id": "blk-default-related",
                          "type": "related_tools",
                          "enabled": true,
                          "order": 6,
                          "content": {
                            "heading": "Related Tools",
                            "slugs": ["jpg-to-png", "jpg-to-webp", "compress-image"]
                          }
                        },
                        {
                          "id": "blk-default-cta",
                          "type": "cta",
                          "enabled": true,
                          "order": 7,
                          "content": {
                            "title": "Need more conversion options?",
                            "description": "Convert24 features a whole suite of free, safe, and lightning-fast image utilities right inside your browser.",
                            "buttonText": "Explore All Tools",
                            "href": "/"
                          }
                        }
                      ];
                      setBlocks(defaultPngToJpgBlocks);
                      setStatusMessage({ type: 'success', text: 'Pre-populated with high-fidelity canonical content blocks.' });
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-[#7C3AED] bg-[#F4F0FD] hover:bg-[#D1EBE5] rounded-lg transition-colors border border-[#7C3AED]/10"
                  >
                    Pre-populate defaults (PNG to JPG)
                  </button>
                )}
                {isBatch1Tool(slug) && blocks.length === 0 && (
                  <button
                    onClick={() => {
                      const defaultBlocks = getBatch1ToolBlocks(slug);
                      if (defaultBlocks) {
                        setBlocks(defaultBlocks);
                        setStatusMessage({ type: 'success', text: `Pre-populated with high-fidelity canonical content blocks for ${slug}.` });
                      }
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-[#7C3AED] bg-[#F4F0FD] hover:bg-[#D1EBE5] rounded-lg transition-colors border border-[#7C3AED]/10"
                  >
                    Pre-populate defaults ({canonical?.name || slug})
                  </button>
                )}
                <button
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      const pasted = deserializeAndPasteBlock(text, blocks.length);
                      if (pasted) {
                        setBlocks([...blocks, pasted]);
                        setStatusMessage({ type: 'success', text: `Pasted block "${pasted.type}" from clipboard.` });
                      } else {
                        // Fallback to localStorage copy
                        const storageText = localStorage.getItem('cms_block_clipboard');
                        if (storageText) {
                          const pastedStorage = deserializeAndPasteBlock(storageText, blocks.length);
                          if (pastedStorage) {
                            setBlocks([...blocks, pastedStorage]);
                            setStatusMessage({ type: 'success', text: `Pasted block "${pastedStorage.type}" from local memory.` });
                            return;
                          }
                        }
                        setStatusMessage({ type: 'error', text: 'Clipboard does not contain a valid Phase 07A content block.' });
                      }
                    } catch {
                      const storageText = localStorage.getItem('cms_block_clipboard');
                      if (storageText) {
                        const pastedStorage = deserializeAndPasteBlock(storageText, blocks.length);
                        if (pastedStorage) {
                          setBlocks([...blocks, pastedStorage]);
                          setStatusMessage({ type: 'success', text: `Pasted block "${pastedStorage.type}" from local memory.` });
                          return;
                        }
                      }
                      setStatusMessage({ type: 'error', text: 'Could not read clipboard. Please ensure clipboard permission is enabled.' });
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#475467] bg-white border border-[#E4E2F0] hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  <span>Paste Block</span>
                </button>
                
                {/* Block selector */}
                <div className="flex items-center gap-1">
                  <select
                    id="add-block-select"
                    className="text-xs border border-[#E4E2F0] rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-[#7C3AED] focus:outline-none bg-white font-medium"
                    defaultValue="hero"
                  >
                    <option value="hero">Hero Header</option>
                    <option value="benefits_trust">Benefits & Trust</option>
                    <option value="intro">Intro / About Section</option>
                    <option value="features">Features Grid</option>
                    <option value="how_to_use">How To Use Steps</option>
                    <option value="faq">FAQ List</option>
                    <option value="related_tools">Related Tools Links</option>
                    <option value="cta">CTA Banner</option>
                    <option value="section">Simple Section</option>
                    <option value="heading">Heading Element</option>
                    <option value="paragraph">Paragraph Element</option>
                    <option value="rich_text">HTML / Rich Text</option>
                    <option value="image">Image Element</option>
                    <option value="link">Anchor Link</option>
                    <option value="privacy_note">Privacy Notice</option>
                    <option value="use_cases">Use Cases Grid</option>
                    <option value="spacer">Blank Spacer</option>
                  </select>
                  <button
                    onClick={() => {
                      const selectEl = document.getElementById('add-block-select') as HTMLSelectElement;
                      const type = selectEl ? selectEl.value : 'hero';
                      const newBlock = normalizeBlock({ type }, blocks.length);
                      setBlocks([...blocks, newBlock]);
                      setStatusMessage({ type: 'success', text: `Added new block of type "${type}".` });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Block</span>
                  </button>
                </div>
              </div>
            </div>

            {blocks.length === 0 ? (
              <div className="p-12 text-center bg-[#F4F3FA] rounded-xl border border-dashed border-[#E4E2F0] space-y-3">
                <Layers className="w-8 h-8 text-[#94A3B8] mx-auto" />
                <div className="text-xs font-bold text-[#475467]">No Universal Blocks Defined Yet</div>
                <p className="text-[11px] text-[#5E6488] max-w-md mx-auto">
                  By default, this tool page runs on hardcoded canonical layouts. Enable blocks to take complete content control.
                </p>
                {(slug === 'png-to-jpg' || isBatch1Tool(slug)) && (
                  <button
                    onClick={() => {
                      document.getElementById('add-block-select')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-xs text-[#7C3AED] font-bold hover:underline"
                  >
                    Click "Pre-populate defaults" above to convert hardcoded layout into CMS blocks instantly!
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {blocks.map((block, idx) => (
                  <CmsBlockEditorItem
                    key={block.id}
                    block={block}
                    idx={idx}
                    total={blocks.length}
                    onMoveUp={() => {
                      if (idx === 0) return;
                      const next = [...blocks];
                      const temp = next[idx];
                      next[idx] = next[idx - 1];
                      next[idx - 1] = temp;
                      setBlocks(next.map((b, i) => ({ ...b, order: i })));
                    }}
                    onMoveDown={() => {
                      if (idx === blocks.length - 1) return;
                      const next = [...blocks];
                      const temp = next[idx];
                      next[idx] = next[idx + 1];
                      next[idx + 1] = temp;
                      setBlocks(next.map((b, i) => ({ ...b, order: i })));
                    }}
                    onToggleEnabled={() => {
                      const next = [...blocks];
                      next[idx] = toggleBlockEnabled(next[idx]);
                      setBlocks(next);
                    }}
                    onDuplicate={() => {
                      const dupe = cmsDuplicateBlock(block);
                      const next = [...blocks];
                      next.splice(idx + 1, 0, dupe);
                      setBlocks(next.map((b, i) => ({ ...b, order: i })));
                      setStatusMessage({ type: 'success', text: `Duplicated block "${block.type}".` });
                    }}
                    onCopy={() => {
                      const serialized = serializeBlockForClipboard(block);
                      try {
                        navigator.clipboard.writeText(serialized);
                      } catch {
                        // ignore clipboard write failure
                      }
                      localStorage.setItem('cms_block_clipboard', serialized);
                      setStatusMessage({ type: 'success', text: `Copied block "${block.type}" to local clipboard.` });
                    }}
                    onDelete={() => {
                      if (confirm(`Delete this "${block.type}" block?`)) {
                        setBlocks(cmsDeleteBlock(blocks, block.id).map((b, i) => ({ ...b, order: i })));
                        setStatusMessage({ type: 'warning', text: `Deleted block.` });
                      }
                    }}
                    onUpdateContent={(updatedContent) => {
                      const next = [...blocks];
                      next[idx] = { ...next[idx], content: updatedContent };
                      // Also mirror content fields directly on root for backward-compatibility
                      for (const [k, v] of Object.entries(updatedContent)) {
                        next[idx][k] = v;
                      }
                      setBlocks(next);
                    }}
                    otherTools={otherTools}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: How-To Steps */}
      {activeTab === 'HOW_TO' && (
        <div className="bg-white p-6 rounded-xl border border-[#E4E2F0] shadow-subtle space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E2F0] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#0F112E]">How-To Steps Editor</h2>
              <p className="text-xs text-[#5E6488] mt-0.5">
                Define the step-by-step instructions displayed on the public tool page.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLoadCanonicalHowTo}
                className="px-2.5 py-1 text-xs font-semibold text-[#475467] bg-[#F4F3FA] hover:bg-[#E4E2F0] rounded-lg transition-colors"
              >
                Load Canonical Defaults
              </button>
              <button
                onClick={handleAddStep}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Step</span>
              </button>
            </div>
          </div>

          {howToSteps.length === 0 ? (
            <div className="p-8 text-center bg-[#F4F3FA] rounded-xl border border-dashed border-[#E4E2F0] space-y-2">
              <ListOrdered className="w-6 h-6 text-[#94A3B8] mx-auto" />
              <div className="text-xs font-semibold text-[#475467]">No Custom Steps Defined</div>
              <p className="text-[11px] text-[#5E6488]">
                The public page currently uses the 3 canonical steps from code. Click "Load Canonical Defaults" or "Add Step" to customize.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {howToSteps.map((step, idx) => (
                <div key={idx} className="p-4 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#7C3AED] px-2 py-0.5 bg-[#F4F0FD] rounded">
                      Step {idx + 1}
                    </span>
                    <button
                      onClick={() => handleRemoveStep(idx)}
                      className="p-1 text-[#94A3B8] hover:text-[#E11D48] transition-colors"
                      title="Remove step"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#0F112E] mb-1">
                      Step Title
                    </label>
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) => handleStepChange(idx, 'title', e.target.value)}
                      placeholder="e.g. Select or drop your JPG files"
                      className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#0F112E] mb-1">
                      Step Description
                    </label>
                    <textarea
                      rows={2}
                      value={step.description}
                      onChange={(e) => handleStepChange(idx, 'description', e.target.value)}
                      placeholder="e.g. Choose files up to 50 MB..."
                      className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Features */}
      {activeTab === 'FEATURES' && (
        <div className="bg-white p-6 rounded-xl border border-[#E4E2F0] shadow-subtle space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E2F0] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#0F112E]">Feature Cards Editor</h2>
              <p className="text-xs text-[#5E6488] mt-0.5">
                Highlight key technical features, client-side guarantees, and benefits.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLoadCanonicalFeatures}
                className="px-2.5 py-1 text-xs font-semibold text-[#475467] bg-[#F4F3FA] hover:bg-[#E4E2F0] rounded-lg transition-colors"
              >
                Load Canonical Defaults
              </button>
              <button
                onClick={handleAddFeature}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Feature</span>
              </button>
            </div>
          </div>

          {featuresList.length === 0 ? (
            <div className="p-8 text-center bg-[#F4F3FA] rounded-xl border border-dashed border-[#E4E2F0] space-y-2">
              <Sparkles className="w-6 h-6 text-[#94A3B8] mx-auto" />
              <div className="text-xs font-semibold text-[#475467]">No Custom Features Defined</div>
              <p className="text-[11px] text-[#5E6488]">
                The public page currently uses canonical features from code. Click "Load Canonical Defaults" or "Add Feature" to customize.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featuresList.map((feat, idx) => (
                <div key={idx} className="p-4 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#7C3AED] px-2 py-0.5 bg-[#F4F0FD] rounded">
                      Feature #{idx + 1}
                    </span>
                    <button
                      onClick={() => handleRemoveFeature(idx)}
                      className="p-1 text-[#94A3B8] hover:text-[#E11D48] transition-colors"
                      title="Remove feature"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#0F112E] mb-1">
                      Feature Title
                    </label>
                    <input
                      type="text"
                      value={feat.title}
                      onChange={(e) => handleFeatureChange(idx, 'title', e.target.value)}
                      placeholder="e.g. 100% Client-Side Processing"
                      className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#0F112E] mb-1">
                      Feature Description
                    </label>
                    <textarea
                      rows={2}
                      value={feat.description}
                      onChange={(e) => handleFeatureChange(idx, 'description', e.target.value)}
                      placeholder="e.g. Conversions execute entirely on your device..."
                      className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: FAQ */}
      {activeTab === 'FAQ' && (
        <div className="bg-white p-6 rounded-xl border border-[#E4E2F0] shadow-subtle space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E2F0] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#0F112E]">Frequently Asked Questions (FAQ)</h2>
              <p className="text-xs text-[#5E6488] mt-0.5">
                Manage FAQ accordions. Questions and answers are automatically surfaced on the public page.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLoadCanonicalFaq}
                className="px-2.5 py-1 text-xs font-semibold text-[#475467] bg-[#F4F3FA] hover:bg-[#E4E2F0] rounded-lg transition-colors"
              >
                Load Canonical Defaults
              </button>
              <button
                onClick={handleAddFaq}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add FAQ</span>
              </button>
            </div>
          </div>

          {faqList.length === 0 ? (
            <div className="p-8 text-center bg-[#F4F3FA] rounded-xl border border-dashed border-[#E4E2F0] space-y-2">
              <HelpCircle className="w-6 h-6 text-[#94A3B8] mx-auto" />
              <div className="text-xs font-semibold text-[#475467]">No Custom FAQ Items Defined</div>
              <p className="text-[11px] text-[#5E6488]">
                The public page currently uses the canonical FAQ entries. Click "Load Canonical Defaults" or "Add FAQ" to customize.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {faqList.map((item, idx) => (
                <div key={idx} className="p-4 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#7C3AED] px-2 py-0.5 bg-[#F4F0FD] rounded">
                      Question #{idx + 1}
                    </span>
                    <button
                      onClick={() => handleRemoveFaq(idx)}
                      className="p-1 text-[#94A3B8] hover:text-[#E11D48] transition-colors"
                      title="Remove FAQ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#0F112E] mb-1">
                      Question
                    </label>
                    <input
                      type="text"
                      value={item.question}
                      onChange={(e) => handleFaqChange(idx, 'question', e.target.value)}
                      placeholder="e.g. Is this file converter completely free?"
                      className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#0F112E] mb-1">
                      Answer
                    </label>
                    <textarea
                      rows={2}
                      value={item.answer}
                      onChange={(e) => handleFaqChange(idx, 'answer', e.target.value)}
                      placeholder="e.g. Yes, 100% free with no limits..."
                      className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Related Tools */}
      {activeTab === 'RELATED' && (
        <div className="bg-white p-6 rounded-xl border border-[#E4E2F0] shadow-subtle space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E2F0] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#0F112E]">Related Tools Selection</h2>
              <p className="text-xs text-[#5E6488] mt-0.5">
                Select related tools from the 24 remaining canonical tools. Arbitrary external slugs are strictly prohibited.
              </p>
            </div>
            <button
              onClick={handleLoadCanonicalRelated}
              className="px-2.5 py-1 text-xs font-semibold text-[#475467] bg-[#F4F3FA] hover:bg-[#E4E2F0] rounded-lg transition-colors"
            >
              Load Canonical Defaults
            </button>
          </div>

          <div className="p-3 bg-[#F4F0FD] border border-[#B3E0D8] rounded-xl text-xs text-[#7C3AED] flex items-center justify-between">
            <span>
              <strong>Selected ({relatedToolsList.length}):</strong>{' '}
              {relatedToolsList.length === 0 ? 'None (using code default)' : relatedToolsList.join(', ')}
            </span>
            {relatedToolsList.length > 0 && (
              <button
                onClick={() => setRelatedToolsList([])}
                className="text-[11px] font-semibold underline hover:text-[#6D28D9]"
              >
                Clear Selection
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {otherTools.map((t) => {
              const isSelected = relatedToolsList.includes(t.slug);
              return (
                <div
                  key={t.slug}
                  onClick={() => handleToggleRelatedTool(t.slug)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#F4F0FD] border-[#7C3AED] text-[#7C3AED] shadow-xs'
                      : 'bg-white border-[#E4E2F0] text-[#475467] hover:border-[#E4E2F0]'
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="text-xs font-semibold truncate">{t.name}</div>
                    <div className="text-[10px] text-[#5E6488] font-mono">/tools/{t.slug}</div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-[#7C3AED] border-[#7C3AED] text-white'
                        : 'border-[#E4E2F0] bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Advanced SEO */}
      {activeTab === 'SEO' && (
        <div className="bg-white p-6 rounded-xl border border-[#E4E2F0] shadow-subtle space-y-6">
          <div className="border-b border-[#E4E2F0] pb-3">
            <h2 className="text-sm font-bold text-[#0F112E]">Advanced SEO & Social Metadata Overrides</h2>
            <p className="text-xs text-[#5E6488] mt-0.5">
              Configure search engine metadata, OpenGraph cards, Twitter cards, and JSON-LD structured data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#0F112E]">SEO Title Tag</label>
                <span className={`text-[10px] ${seoTitle.length > 60 ? 'text-[#E11D48] font-bold' : 'text-[#5E6488]'}`}>
                  {seoTitle.length}/60 chars
                </span>
              </div>
              <input
                type="text"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder={canonical.title}
                className="w-full px-3 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F112E] mb-1">
                Canonical URL
              </label>
              <input
                type="text"
                value={canonicalUrl}
                onChange={(e) => setCanonicalUrl(e.target.value)}
                placeholder={`/tools/${canonical.slug}`}
                className="w-full px-3 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              />
              <span className="text-[10px] text-[#5E6488] mt-0.5 block">
                Must remain based on /tools/{canonical.slug}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[#0F112E]">Meta Description</label>
              <span className={`text-[10px] ${metaDescription.length > 160 ? 'text-[#E11D48] font-bold' : 'text-[#5E6488]'}`}>
                {metaDescription.length}/160 chars
              </span>
            </div>
            <textarea
              rows={2}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              placeholder={canonical.description}
              className="w-full px-3 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            />
          </div>

          {/* Robots Directives */}
          <div className="p-4 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-[#0F112E]">Robots Directives</h3>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#0F112E]">
                <input
                  type="checkbox"
                  checked={robotsIndex}
                  onChange={(e) => setRobotsIndex(e.target.checked)}
                  className="rounded text-[#7C3AED] focus:ring-[#7C3AED]"
                />
                <span>Allow Indexing (<code className="font-mono text-[10px]">index</code>)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#0F112E]">
                <input
                  type="checkbox"
                  checked={robotsFollow}
                  onChange={(e) => setRobotsFollow(e.target.checked)}
                  className="rounded text-[#7C3AED] focus:ring-[#7C3AED]"
                />
                <span>Allow Follow (<code className="font-mono text-[10px]">follow</code>)</span>
              </label>
            </div>
          </div>

          {/* Open Graph & Twitter Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Open Graph */}
            <div className="p-4 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-[#0F112E] flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-[#7C3AED]" />
                <span>Open Graph (Facebook, LinkedIn)</span>
              </h3>
              <div>
                <label className="block text-[11px] font-semibold text-[#0F112E] mb-1">OG Title</label>
                <input
                  type="text"
                  value={ogTitle}
                  onChange={(e) => setOgTitle(e.target.value)}
                  placeholder={seoTitle || canonical.title}
                  className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#0F112E] mb-1">OG Description</label>
                <textarea
                  rows={2}
                  value={ogDescription}
                  onChange={(e) => setOgDescription(e.target.value)}
                  placeholder={metaDescription || canonical.description}
                  className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg bg-white"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-[#0F112E]">OG Image URL</label>
                  <button
                    type="button"
                    onClick={() => setIsMediaPickerOpen(true)}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#7C3AED] hover:underline"
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Select from Media Library</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={ogImage}
                  onChange={(e) => setOgImage(e.target.value)}
                  placeholder="/images/og-tool.png or /uploads/..."
                  className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg bg-white"
                />
              </div>
            </div>

            {/* Twitter */}
            <div className="p-4 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-[#0F112E] flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-[#7C3AED]" />
                <span>Twitter Card Metadata</span>
              </h3>
              <div>
                <label className="block text-[11px] font-semibold text-[#0F112E] mb-1">Twitter Title</label>
                <input
                  type="text"
                  value={twitterTitle}
                  onChange={(e) => setTwitterTitle(e.target.value)}
                  placeholder={seoTitle || canonical.title}
                  className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#0F112E] mb-1">Twitter Description</label>
                <textarea
                  rows={2}
                  value={twitterDescription}
                  onChange={(e) => setTwitterDescription(e.target.value)}
                  placeholder={metaDescription || canonical.description}
                  className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#0F112E] mb-1">Twitter Image URL</label>
                <input
                  type="text"
                  value={twitterImage}
                  onChange={(e) => setTwitterImage(e.target.value)}
                  placeholder="/images/og-tool.png"
                  className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          {/* JSON-LD Structured Data */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[#0F112E]">
                Custom JSON-LD Structured Data
              </label>
              {jsonValidationResult && (
                <span
                  className={`text-[10px] font-semibold flex items-center gap-1 ${
                    jsonValidationResult.valid ? 'text-[#10B981]' : 'text-[#E11D48]'
                  }`}
                >
                  {jsonValidationResult.valid ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  <span>{jsonValidationResult.message}</span>
                </span>
              )}
            </div>
            <textarea
              rows={6}
              value={schemaJsonText}
              onChange={(e) => setSchemaJsonText(e.target.value)}
              placeholder={`{\n  "@context": "https://schema.org",\n  "@type": "WebApplication",\n  "name": "${canonical.name}",\n  "applicationCategory": "UtilitiesApplication"\n}`}
              className="w-full px-3 py-2 text-xs font-mono border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-[#F4F3FA]"
            />
            <span className="text-[10px] text-[#5E6488] mt-0.5 block">
              Pure JSON object only. Script tags and HTML elements are rejected.
            </span>
          </div>
        </div>
      )}

      {/* Tab: Publishing & Audit */}
      {activeTab === 'PUBLISHING' && (
        <div className="bg-white p-6 rounded-xl border border-[#E4E2F0] shadow-subtle space-y-6">
          <div className="border-b border-[#E4E2F0] pb-3">
            <h2 className="text-sm font-bold text-[#0F112E]">Publishing Controls & Status</h2>
            <p className="text-xs text-[#5E6488] mt-0.5">
              Control whether this tool renders canonical code defaults or customized CMS overrides.
            </p>
          </div>

          <div className="p-4 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-[#0F112E]">Current Publishing Status</div>
                <div className="text-xs text-[#5E6488] mt-0.5">
                  {isPublished
                    ? 'Active: Public visitors see published CMS overrides.'
                    : 'Draft/Default: Public visitors see canonical registry defaults.'}
                </div>
              </div>

              <div>
                {isPublished ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                    PUBLISHED
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">
                    <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
                    DRAFT
                  </span>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[#E4E2F0] flex items-center justify-between text-xs text-[#5E6488]">
              <span>Last Modified:</span>
              <span className="font-mono text-[#0F112E]">
                {override?.updatedAt ? new Date(override.updatedAt).toLocaleString() : 'Never modified'}
              </span>
            </div>
          </div>

          {/* Primary Publishing Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {isPublished ? (
              <button
                onClick={handleUnpublish}
                disabled={isPublishing}
                className="px-4 py-2 text-xs font-semibold text-[#92400E] bg-[#FEF3C7] hover:bg-[#FDE68A] rounded-lg transition-colors border border-[#FDE68A]"
              >
                Unpublish (Revert Public Page to Canonical Defaults)
              </button>
            ) : (
              <button
                onClick={handlePublish}
                disabled={isPublishing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#10B981] hover:bg-[#059669] rounded-lg transition-colors shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>Publish CMS Overrides to Public</span>
              </button>
            )}

            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#0F112E] bg-white border border-[#E4E2F0] hover:bg-[#F4F3FA] rounded-lg transition-colors"
            >
              <Save className="w-4 h-4 text-[#7C3AED]" />
              <span>Save Current Form as Draft</span>
            </button>
          </div>
        </div>
      )}

      <MediaPickerModal
        isOpen={isMediaPickerOpen}
        onClose={() => setIsMediaPickerOpen(false)}
        currentUrl={ogImage}
        onSelect={(asset) => {
          setOgImage(asset ? asset.url : '');
        }}
      />
    </div>
  );
}

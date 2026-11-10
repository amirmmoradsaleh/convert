/**
 * Container Block Contract & Utilities
 * Defines presets, settings schemas, responsive layout class mappings,
 * nesting limits, and validation helpers for the 'container' CMS block.
 */

export const MAX_CONTAINER_DEPTH = 2;

export type ContainerInnerWidth = 'narrow' | 'default' | 'wide' | 'full';
export type ContainerLayout = 'vertical' | 'horizontal' | 'grid';
export type ContainerGridCols = 2 | 3 | 4;
export type ContainerGap = 'none' | 'sm' | 'md' | 'lg' | 'xl';
export type ContainerAlign = 'start' | 'center' | 'end' | 'stretch';
export type ContainerPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl';
export type ContainerBackground =
  | 'transparent'
  | 'white'
  | 'muted'
  | 'slate'
  | 'indigo'
  | 'purple'
  | 'gradient';
export type ContainerBorderRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
export type ContainerBorder = 'none' | 'subtle' | 'solid' | 'primary';

export interface ContainerBlockSettings {
  innerWidth: ContainerInnerWidth;
  layout: ContainerLayout;
  gridCols: ContainerGridCols;
  gap: ContainerGap;
  align: ContainerAlign;
  padding: ContainerPadding;
  background: ContainerBackground;
  borderRadius: ContainerBorderRadius;
  border: ContainerBorder;
}

export const DEFAULT_CONTAINER_SETTINGS: ContainerBlockSettings = {
  innerWidth: 'default',
  layout: 'vertical',
  gridCols: 2,
  gap: 'md',
  align: 'stretch',
  padding: 'md',
  background: 'transparent',
  borderRadius: 'xl',
  border: 'none',
};

/**
 * Singleton or fixed page-level sections that cannot be nested inside a container block.
 */
export const UNSUPPORTED_CONTAINER_CHILD_TYPES: string[] = [
  'hero',
  'popular_tools',
  'hubs',
  'pricing',
];

/**
 * Checks if a block type can be nested as a child inside a container.
 */
export function isSupportedContainerChildType(type: string, currentDepth = 1): {
  supported: boolean;
  reason?: string;
} {
  const normalizedType = String(type).toLowerCase();

  if (UNSUPPORTED_CONTAINER_CHILD_TYPES.includes(normalizedType)) {
    return {
      supported: false,
      reason: `Block type "${normalizedType}" is a top-level page section and cannot be nested inside a container.`,
    };
  }

  if (normalizedType === 'container' && currentDepth >= MAX_CONTAINER_DEPTH) {
    return {
      supported: false,
      reason: `Maximum container nesting depth of ${MAX_CONTAINER_DEPTH} exceeded.`,
    };
  }

  return { supported: true };
}

/**
 * Resolves outer wrapper Tailwind classes for container width, padding, background, border, and radius.
 */
export function getContainerWrapperClasses(settings?: Partial<ContainerBlockSettings>): string {
  const s: ContainerBlockSettings = { ...DEFAULT_CONTAINER_SETTINGS, ...settings };

  const widthClasses: Record<ContainerInnerWidth, string> = {
    narrow: 'max-w-3xl mx-auto',
    default: 'max-w-5xl mx-auto',
    wide: 'max-w-7xl mx-auto',
    full: 'w-full',
  };

  const bgClasses: Record<ContainerBackground, string> = {
    transparent: 'bg-transparent',
    white: 'bg-white shadow-sm',
    muted: 'bg-[#FAF9FF]',
    slate: 'bg-slate-50',
    indigo: 'bg-indigo-50/50',
    purple: 'bg-purple-50/40',
    gradient: 'bg-gradient-to-br from-[#FAF9FF] via-white to-[#F4F3FA] shadow-sm',
  };

  const radiusClasses: Record<ContainerBorderRadius, string> = {
    none: 'rounded-none',
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
    '2xl': 'rounded-[28px]',
    full: 'rounded-3xl',
  };

  const borderClasses: Record<ContainerBorder, string> = {
    none: 'border-0',
    subtle: 'border border-[#E4E2F0]',
    solid: 'border-2 border-slate-300',
    primary: 'border-2 border-[#7C3AED]/30',
  };

  const paddingClasses: Record<ContainerPadding, string> = {
    none: 'p-0',
    sm: 'p-3 sm:p-4',
    md: 'p-5 sm:p-6 md:p-8',
    lg: 'p-8 sm:p-10 md:p-12',
    xl: 'p-10 sm:p-14 md:p-16',
  };

  const w = widthClasses[s.innerWidth] || widthClasses.default;
  const bg = bgClasses[s.background] || bgClasses.transparent;
  const r = radiusClasses[s.borderRadius] || radiusClasses.xl;
  const b = borderClasses[s.border] || borderClasses.none;
  const p = paddingClasses[s.padding] || paddingClasses.md;

  return `w-full my-6 transition-all ${w} ${bg} ${r} ${b} ${p}`.trim();
}

/**
 * Resolves inner flow/grid classes (flex column, flex row, grid columns, alignment, and gap).
 * Fully responsive with mobile-first fallbacks (grid stacks on mobile, horizontal flex stacks on small screens).
 */
export function getContainerInnerClasses(settings?: Partial<ContainerBlockSettings>): string {
  const s: ContainerBlockSettings = { ...DEFAULT_CONTAINER_SETTINGS, ...settings };

  const gapClasses: Record<ContainerGap, string> = {
    none: 'gap-0',
    sm: 'gap-3',
    md: 'gap-6',
    lg: 'gap-8',
    xl: 'gap-12',
  };

  const alignClasses: Record<ContainerAlign, string> = {
    start: 'items-start justify-start',
    center: 'items-center justify-center',
    end: 'items-end justify-end',
    stretch: 'items-stretch justify-start',
  };

  const g = gapClasses[s.gap] || gapClasses.md;
  const a = alignClasses[s.align] || alignClasses.stretch;

  if (s.layout === 'grid') {
    const cols =
      Number(s.gridCols) === 3
        ? 'lg:grid-cols-3'
        : Number(s.gridCols) === 4
        ? 'lg:grid-cols-4'
        : 'lg:grid-cols-2';
    return `grid grid-cols-1 sm:grid-cols-2 ${cols} ${g} w-full`;
  }

  if (s.layout === 'horizontal') {
    return `flex flex-col sm:flex-row flex-wrap ${a} ${g} w-full`;
  }

  // default: vertical stack
  return `flex flex-col ${a} ${g} w-full`;
}

/**
 * Validates and sanitizes raw container settings against approved whitelists.
 * Rejects arbitrary values or unauthorized CSS injection attempts by falling back to safe defaults.
 */
export function sanitizeContainerSettings(rawSettings?: any): ContainerBlockSettings {
  if (!rawSettings || typeof rawSettings !== 'object') {
    return { ...DEFAULT_CONTAINER_SETTINGS };
  }

  const validWidths: ContainerInnerWidth[] = ['narrow', 'default', 'wide', 'full'];
  const validLayouts: ContainerLayout[] = ['vertical', 'horizontal', 'grid'];
  const validCols: ContainerGridCols[] = [2, 3, 4];
  const validGaps: ContainerGap[] = ['none', 'sm', 'md', 'lg', 'xl'];
  const validAligns: ContainerAlign[] = ['start', 'center', 'end', 'stretch'];
  const validPaddings: ContainerPadding[] = ['none', 'sm', 'md', 'lg', 'xl'];
  const validBgs: ContainerBackground[] = [
    'transparent',
    'white',
    'muted',
    'slate',
    'indigo',
    'purple',
    'gradient',
  ];
  const validRadii: ContainerBorderRadius[] = ['none', 'sm', 'md', 'lg', 'xl', '2xl', 'full'];
  const validBorders: ContainerBorder[] = ['none', 'subtle', 'solid', 'primary'];

  return {
    innerWidth: validWidths.includes(rawSettings.innerWidth)
      ? rawSettings.innerWidth
      : DEFAULT_CONTAINER_SETTINGS.innerWidth,
    layout: validLayouts.includes(rawSettings.layout)
      ? rawSettings.layout
      : DEFAULT_CONTAINER_SETTINGS.layout,
    gridCols: validCols.includes(Number(rawSettings.gridCols) as any)
      ? (Number(rawSettings.gridCols) as ContainerGridCols)
      : DEFAULT_CONTAINER_SETTINGS.gridCols,
    gap: validGaps.includes(rawSettings.gap) ? rawSettings.gap : DEFAULT_CONTAINER_SETTINGS.gap,
    align: validAligns.includes(rawSettings.align)
      ? rawSettings.align
      : DEFAULT_CONTAINER_SETTINGS.align,
    padding: validPaddings.includes(rawSettings.padding)
      ? rawSettings.padding
      : DEFAULT_CONTAINER_SETTINGS.padding,
    background: validBgs.includes(rawSettings.background)
      ? rawSettings.background
      : DEFAULT_CONTAINER_SETTINGS.background,
    borderRadius: validRadii.includes(rawSettings.borderRadius)
      ? rawSettings.borderRadius
      : DEFAULT_CONTAINER_SETTINGS.borderRadius,
    border: validBorders.includes(rawSettings.border)
      ? rawSettings.border
      : DEFAULT_CONTAINER_SETTINGS.border,
  };
}

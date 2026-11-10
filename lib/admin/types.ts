export type AdminRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'CONTENT_MANAGER'
  | 'EDITOR'
  | 'VIEWER';

export type AdminPermission =
  | 'MANAGE_USERS'
  | 'MANAGE_SETTINGS'
  | 'PUBLISH_CONTENT'
  | 'EDIT_CONTENT'
  | 'MANAGE_MEDIA'
  | 'MANAGE_SEO'
  | 'VIEW_AUDIT_LOGS'
  | 'VIEW_CMS';

export type PageStatus = 'DRAFT' | 'PUBLISHED';

export interface AdminUserSession {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

export type BlockType =
  | 'section'
  | 'heading'
  | 'paragraph'
  | 'rich_text'
  | 'cta'
  | 'link'
  | 'image'
  | 'faq'
  | 'feature';

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface SectionBlock extends BaseBlock {
  type: 'section';
  title: string;
  description?: string;
}

export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  level: 1 | 2 | 3;
  text: string;
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  text: string;
}

export interface RichTextBlock extends BaseBlock {
  type: 'rich_text';
  html: string;
}

export interface CtaBlock extends BaseBlock {
  type: 'cta';
  label: string;
  href: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

export interface LinkBlock extends BaseBlock {
  type: 'link';
  text: string;
  href: string;
  isExternal?: boolean;
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
}

export interface FaqBlock extends BaseBlock {
  type: 'faq';
  question: string;
  answer: string;
}

export interface FeatureBlock extends BaseBlock {
  type: 'feature';
  title: string;
  description: string;
  icon?: string;
}

export type StructuredPageBlock =
  | SectionBlock
  | HeadingBlock
  | ParagraphBlock
  | RichTextBlock
  | CtaBlock
  | LinkBlock
  | ImageBlock
  | FaqBlock
  | FeatureBlock;

export interface ContentBlock {
  id: string;
  type:
    | 'heading'
    | 'paragraph'
    | 'rich_text'
    | 'button'
    | 'section'
    | 'faq'
    | 'tool_ref'
    | 'image'
    | 'link'
    | 'feature'
    | 'cta';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

export interface PageSeoInput {
  seoTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImage?: string | null;
  schemaType?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schemaJson?: Record<string, any> | null;
  focusKeyword?: string | null;
}

export interface CreatePageInput {
  slug: string;
  name: string;
  status?: PageStatus;
  blocks?: ContentBlock[];
  customCss?: string;
  seo?: PageSeoInput;
}

export interface UpdatePageInput {
  name?: string;
  slug?: string;
  status?: PageStatus;
  blocks?: ContentBlock[];
  customCss?: string;
  seo?: PageSeoInput;
  reason?: string;
}

export interface ToolHowToStep {
  title: string;
  description: string;
}

export interface ToolFeatureItem {
  title: string;
  description: string;
}

export interface ToolFaqItem {
  question: string;
  answer: string;
}

export interface UpdateToolContentInput {
  customTitle?: string | null;
  customH1?: string | null;
  customDescription?: string | null;
  customIntro?: string | null;
  customValueProp?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customHowTo?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customFeatures?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customFaq?: any;
  customRelatedTools?: string[] | null;
  blocks?: any;
  isPublished?: boolean;
  seo?: PageSeoInput;
  reason?: string;
  expectedUpdatedAt?: string;
}

export interface HeaderNavItem {
  id: string;
  label: string;
  href: string;
  order?: number;
  visible?: boolean;
  openNewTab?: boolean;
  isExternal?: boolean;
}

export interface FooterLinkItem {
  label: string;
  href: string;
  openNewTab?: boolean;
}

export interface FooterGroupItem {
  title: string;
  links: FooterLinkItem[];
}

export const DEFAULT_HEADER_NAV: HeaderNavItem[] = [
  { id: 'nav-blog', label: 'Blog', href: '/blog', order: 1, visible: true, openNewTab: false },
  { id: 'nav-pricing', label: 'Pricing', href: '/#pricing', order: 2, visible: true, openNewTab: false },
  { id: 'nav-help', label: 'Help', href: '/#faq', order: 3, visible: true, openNewTab: false },
];

export const DEFAULT_FOOTER_GROUPS: FooterGroupItem[] = [
  {
    title: 'Tools & Converters',
    links: [
      { label: 'Image Tools Hub', href: '/image-tools' },
      { label: 'PDF Tools Hub', href: '/pdf-tools' },
      { label: 'JPG to PNG', href: '/tools/jpg-to-png' },
      { label: 'Compress Image', href: '/tools/compress-image' },
      { label: 'Merge PDF', href: '/tools/merge-pdf' },
    ],
  },
  {
    title: 'Formats & Guides',
    links: [
      { label: 'JPG Format Guide', href: '/formats/jpg' },
      { label: 'PNG Format Guide', href: '/formats/png' },
      { label: 'WEBP Format Guide', href: '/formats/webp' },
      { label: 'PDF Format Guide', href: '/formats/pdf' },
      { label: 'Blog & Tutorials', href: '/blog' },
    ],
  },
  {
    title: 'About & Legal',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Contact', href: '/contact' },
    ],
  },
];

export interface UpdateSettingsInput {
  siteName?: string;
  siteUrl?: string;
  siteLogo?: string | null;
  headerTagline?: string | null;
  headerCtaLabel?: string | null;
  headerCtaLink?: string | null;
  headerCtaVisible?: boolean;
  headerNav?: HeaderNavItem[];
  footerDescription?: string | null;
  copyrightText?: string | null;
  trustText?: string | null;
  footerGroups?: FooterGroupItem[];
  defaultSeoTitle?: string | null;
  defaultMetaDescription?: string | null;
  defaultOgImage?: string | null;
  defaultTwitterImage?: string | null;
  googleAnalyticsId?: string | null;
  googleAdSenseId?: string | null;
  socialLinks?: Record<string, string> | null;
}

export interface SiteSettingsData extends UpdateSettingsInput {
  id: string;
  updatedAt?: string | Date;
}

export interface AuditLogItem {
  id: string;
  userId: string | null;
  userName?: string | null;
  userEmail?: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any> | null;
  createdAt: string;
}

export interface DashboardStats {
  totalAdminUsers: number;
  publishedPages: number;
  draftPages: number;
  totalPages: number;
  customizedTools: number;
  totalTools: number;
  publishedBlogPosts: number;
  draftBlogPosts: number;
  recentAuditLogs: AuditLogItem[];
  databaseStatus: 'connected' | 'fallback_memory';
}

export type PostStatus = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED';

export interface BlogCategoryItem {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  postCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BlogTagItem {
  id: string;
  slug: string;
  name: string;
  postCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BlogPostItem {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  content: string;
  featuredImage?: string | null;
  featuredImageAlt?: string | null;
  readingTime?: string | null;
  status: PostStatus;
  publishedAt?: string | null;
  scheduledFor?: string | null;
  authorId?: string | null;
  author?: { id: string; name: string; email: string; role?: string } | null;
  categoryId?: string | null;
  category?: BlogCategoryItem | null;
  tags?: { postId?: string; tagId: string; tag?: BlogTagItem | null }[];
  seo?: PageSeoInput | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlogPostInput {
  title: string;
  slug?: string;
  excerpt?: string | null;
  content: string;
  featuredImage?: string | null;
  featuredImageAlt?: string | null;
  status?: PostStatus;
  publishedAt?: string | Date | null;
  scheduledFor?: string | Date | null;
  categoryId?: string | null;
  tagIds?: string[];
  seo?: PageSeoInput;
}

export interface UpdateBlogPostInput {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: string;
  featuredImage?: string | null;
  featuredImageAlt?: string | null;
  status?: PostStatus;
  publishedAt?: string | Date | null;
  scheduledFor?: string | Date | null;
  categoryId?: string | null;
  tagIds?: string[];
  seo?: PageSeoInput;
  reason?: string;
}

export interface ListBlogPostsOptions {
  status?: PostStatus;
  categoryId?: string;
  categorySlug?: string;
  tagId?: string;
  tagSlug?: string;
  search?: string;
  page?: number;
  limit?: number;
  publishedOnly?: boolean;
}

export interface BlogPostRevisionItem {
  id: string;
  postId: string;
  contentSnapshot: any;
  seoSnapshot?: any;
  authorId?: string | null;
  author?: { id: string; name: string; email: string } | null;
  reason?: string | null;
  createdAt: string;
}

export interface MediaAssetItem {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
  storagePath: string;
  alt: string | null;
  title: string | null;
  caption: string | null;
  description: string | null;
  uploadedById: string | null;
  uploadedBy?: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadMediaInput {
  file: Buffer | Uint8Array;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  alt?: string | null;
  title?: string | null;
  caption?: string | null;
  description?: string | null;
}

export interface UpdateMediaInput {
  title?: string | null;
  alt?: string | null;
  caption?: string | null;
  description?: string | null;
}

export interface ListMediaOptions {
  search?: string;
  mimeType?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'size' | 'filename';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminUserItem {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdminUserInput {
  email: string;
  name: string;
  password?: string;
  role: AdminRole;
  isActive?: boolean;
}

export interface UpdateAdminUserInput {
  name?: string;
  email?: string;
  role?: AdminRole;
  isActive?: boolean;
  password?: string;
}

export interface ListAdminUsersOptions {
  search?: string;
  role?: AdminRole;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'name' | 'lastLoginAt' | 'email';
  sortOrder?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// CMS JSON Backup & Restore Types (Phase 12.2-A)
// ---------------------------------------------------------------------------

export const CMS_BACKUP_FORMAT_IDENTIFIER = 'convert24-cms-backup';
export const CMS_BACKUP_CURRENT_VERSION = 1;
export const CMS_BACKUP_MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB

export interface CmsBackupPage {
  slug: string;
  name: string;
  status: PageStatus;
  publishedAt?: string | null;
  content: {
    version: number;
    isPublished: boolean;
    blocks: any[];
    customCss?: string | null;
  };
  seo?: PageSeoInput | null;
}

export interface CmsBackupTool {
  toolSlug: string;
  customTitle?: string | null;
  customH1?: string | null;
  customDescription?: string | null;
  customIntro?: string | null;
  customValueProp?: string | null;
  customHowTo?: ToolHowToStep[] | null;
  customFeatures?: ToolFeatureItem[] | null;
  customFaq?: ToolFaqItem[] | null;
  customRelatedTools?: string[] | null;
  blocks?: any[] | null;
  isPublished?: boolean;
  seo?: PageSeoInput | null;
}

export interface CmsBackupBlogPost {
  slug: string;
  title: string;
  excerpt?: string | null;
  content: string;
  featuredImage?: string | null;
  featuredImageAlt?: string | null;
  readingTime?: string | null;
  status: PostStatus;
  publishedAt?: string | null;
  scheduledFor?: string | null;
  categorySlug?: string | null;
  tagSlugs?: string[];
  seo?: PageSeoInput | null;
}

export interface CmsBackupBlogCategory {
  slug: string;
  name: string;
  description?: string | null;
}

export interface CmsBackupBlogTag {
  slug: string;
  name: string;
}

export interface CmsBackupBlogTaxonomy {
  categories: CmsBackupBlogCategory[];
  tags: CmsBackupBlogTag[];
}

export interface CmsBackupNavigationItem {
  menu: string;
  label: string;
  destination: string;
  order: number;
  visible: boolean;
  icon?: string | null;
  isExternal?: boolean;
  openNewTab?: boolean;
}

export interface CmsBackupSiteSettings {
  global: {
    siteName?: string;
    siteUrl?: string;
    defaultSeoTitle?: string | null;
    defaultMetaDescription?: string | null;
    defaultOgImage?: string | null;
    defaultTwitterImage?: string | null;
    googleAnalyticsId?: string | null;
    googleAdSenseId?: string | null;
    socialLinks?: Record<string, string> | null;
    headerTagline?: string | null;
    headerCtaLabel?: string | null;
    headerCtaLink?: string | null;
    headerCtaVisible?: boolean;
  };
  navigation: CmsBackupNavigationItem[];
  footer: {
    brandDescription?: string | null;
    copyrightText?: string | null;
    trustText?: string | null;
    linksJson?: any;
  };
}

export interface CmsBackupFormatContent {
  formatSlug: string;
  customTitle?: string | null;
  customDescription?: string | null;
  customDetails?: string | null;
  customBestFor?: string | null;
  customPros?: string | null;
  customCons?: string | null;
}

export interface CmsBackupMediaReference {
  filename: string;
  originalFilename?: string | null;
  mimeType: string;
  size: number;
  width?: number | null;
  height?: number | null;
  url: string;
  alt?: string | null;
  title?: string | null;
  caption?: string | null;
  description?: string | null;
}

export interface CmsBackupData {
  pages: CmsBackupPage[];
  toolContent: CmsBackupTool[];
  blogPosts: CmsBackupBlogPost[];
  blogTaxonomy: CmsBackupBlogTaxonomy;
  siteSettings: CmsBackupSiteSettings;
  formatContents: CmsBackupFormatContent[];
  mediaReferences: CmsBackupMediaReference[];
}

export interface CmsBackupFile {
  exportFormat: string;
  formatVersion: number;
  exportedAt: string;
  exportedBy: {
    id: string;
    email: string;
    name: string;
  };
  site: {
    name: string;
    url: string;
  };
  data: CmsBackupData;
}

export interface CmsBackupItemDetail {
  key: string;
  title: string;
  action: 'create' | 'update' | 'skip';
  status: 'valid' | 'warning' | 'error';
  reason?: string;
}

export interface CmsBackupSectionSummary {
  total: number;
  toCreate: number;
  toUpdate: number;
  toSkip: number;
  errors: string[];
  warnings: string[];
  details: CmsBackupItemDetail[];
}

export interface CmsBackupPreviewResult {
  isValid: boolean;
  exportFormat: string;
  formatVersion: number;
  exportedAt?: string;
  exportedBy?: {
    id?: string;
    email?: string;
    name?: string;
  };
  site?: {
    name?: string;
    url?: string;
  };
  summary: {
    pages: CmsBackupSectionSummary;
    toolContent: CmsBackupSectionSummary;
    blogPosts: CmsBackupSectionSummary;
    blogTaxonomy: CmsBackupSectionSummary;
    siteSettings: CmsBackupSectionSummary;
    formatContents: CmsBackupSectionSummary;
    mediaReferences: CmsBackupSectionSummary;
  };
  totals: {
    totalRecords: number;
    toCreate: number;
    toUpdate: number;
    toSkip: number;
    totalErrors: number;
    totalWarnings: number;
  };
  blockingErrors: string[];
  warnings: string[];
}

export interface CmsBackupRestoreCounts {
  pages: { created: number; updated: number; skipped: number };
  toolContent: { created: number; updated: number; skipped: number };
  blogPosts: { created: number; updated: number; skipped: number };
  blogCategories: { created: number; updated: number; skipped: number };
  blogTags: { created: number; updated: number; skipped: number };
  siteSettings: { updated: boolean; navigationCount: number; footerUpdated: boolean; skipped: boolean };
  formatContents: { created: number; updated: number; skipped: number };
  mediaReferences: { created: number; updated: number; skipped: number };
}

export interface CmsBackupRestoreResult {
  success: boolean;
  message: string;
  durationMs: number;
  auditLogId?: string;
  restored: CmsBackupRestoreCounts;
  skippedCount: number;
  failedCount: number;
  errors?: string[];
}




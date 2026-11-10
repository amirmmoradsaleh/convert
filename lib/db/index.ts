import { prisma, isPrismaConfigured } from './prisma';
import type { Role, PageStatus, PostStatus } from '@prisma/client';

export const DEFAULT_ADMIN = {
  id: 'admin-super-01',
  email: 'admin@filetools.local',
  passwordHash: '$2b$12$EcWOLShVkkA4lZAFbx1LCeBdIZKb4cDOjK/cw6w0TWs9uh9SB70YC', // 'AdminPassword123!'
  name: 'System Administrator',
  role: 'SUPER_ADMIN' as Role,
  isActive: true,
  lastLoginAt: null as Date | null,
  failedLoginAttempts: 0,
  lockedUntil: null as Date | null,
  passwordResetTokenHash: null as string | null,
  passwordResetExpiresAt: null as Date | null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

interface MemoryStorage {
  adminUsers: Map<string, any>;
  pages: Map<string, any>;
  pageContents: Map<string, any>;
  pageSeos: Map<string, any>;
  toolContents: Map<string, any>;
  toolSeos: Map<string, any>;
  pageRevisions: any[];
  toolRevisions: any[];
  blogPosts: Map<string, any>;
  blogCategories: Map<string, any>;
  blogTags: Map<string, any>;
  postTags: Map<string, any>;
  postSeos: Map<string, any>;
  postRevisions: any[];
  mediaAssets: Map<string, any>;
  auditLogs: any[];
  globalSettings: any;
  navigationItems: Map<string, any>;
  footerSettings: Map<string, any>;
  formatContents: Map<string, any>;
}

const globalForMemory = globalThis as unknown as {
  __filetools_memory_store__?: MemoryStorage;
};

function initMemoryStore(): MemoryStorage {
  if (globalForMemory.__filetools_memory_store__) {
    return globalForMemory.__filetools_memory_store__;
  }
  const store: MemoryStorage = {
    adminUsers: new Map([
      [DEFAULT_ADMIN.id, { ...DEFAULT_ADMIN }],
    ]),
    pages: new Map(),
    pageContents: new Map(),
    pageSeos: new Map(),
    toolContents: new Map(),
    toolSeos: new Map(),
    pageRevisions: [],
    toolRevisions: [],
    blogPosts: new Map(),
    blogCategories: new Map(),
    blogTags: new Map(),
    postTags: new Map(),
    postSeos: new Map(),
    postRevisions: [],
    mediaAssets: new Map(),
    auditLogs: [],
    globalSettings: {
      id: 'default',
      siteName: 'Free Online File Tools',
      siteUrl: 'https://example.com',
      defaultSeoTitle: 'Free Online File Tools – Convert, Compress & Edit Files Free',
      defaultMetaDescription: 'Convert, compress and manage your files quickly and easily with 100% client-side privacy.',
      defaultOgImage: '/images/og-image.png',
      defaultTwitterImage: '/images/og-image.png',
      googleAnalyticsId: null,
      googleAdSenseId: null,
      socialLinks: {},
      updatedAt: new Date(),
    },
    navigationItems: new Map(),
    footerSettings: new Map([
      ['default', {
        id: 'default',
        brandDescription: 'Fast, privacy-focused image and PDF utility tools. Process files safely in your browser without registration or uploads.',
        copyrightText: '© 2026 Convert24. Free online file utility service. All rights reserved.',
        trustText: 'Client-side processing • 100% Free • No registration',
        linksJson: [
          {
            title: "Tools & Converters",
            links: [
              { label: "Image Tools", href: "/image-tools" },
              { label: "PDF Tools", href: "/pdf-tools" },
              { label: "JPG to PNG", href: "/tools/jpg-to-png" },
              { label: "Compress Image", href: "/tools/compress-image" },
              { label: "Merge PDF", href: "/tools/merge-pdf" }
            ]
          },
          {
            title: "Formats & Guides",
            links: [
              { label: "JPG Format Guide", href: "/formats/jpg" },
              { label: "PNG Format Guide", href: "/formats/png" },
              { label: "WEBP Format Guide", href: "/formats/webp" },
              { label: "PDF Format Guide", href: "/formats/pdf" },
              { label: "Blog & Tutorials", href: "/blog" }
            ]
          },
          {
            title: "About & Legal",
            links: [
              { label: "About Us", href: "/about" },
              { label: "Privacy Policy", href: "/privacy" },
              { label: "Terms of Service", href: "/terms" },
              { label: "Contact", href: "/contact" }
            ]
          }
        ],
        updatedAt: new Date(),
      }]
    ]),
    formatContents: new Map(),
  };
  globalForMemory.__filetools_memory_store__ = store;
  return store;
}

const memoryStore: MemoryStorage = initMemoryStore();

function cloneMemoryStore(store: MemoryStorage): MemoryStorage {
  return {
    adminUsers: new Map(Array.from(store.adminUsers.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
    pages: new Map(Array.from(store.pages.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
    pageContents: new Map(Array.from(store.pageContents.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
    pageSeos: new Map(Array.from(store.pageSeos.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
    toolContents: new Map(Array.from(store.toolContents.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
    toolSeos: new Map(Array.from(store.toolSeos.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
    pageRevisions: JSON.parse(JSON.stringify(store.pageRevisions)),
    toolRevisions: JSON.parse(JSON.stringify(store.toolRevisions)),
    blogPosts: new Map(Array.from(store.blogPosts.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
    blogCategories: new Map(Array.from(store.blogCategories.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
    blogTags: new Map(Array.from(store.blogTags.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
    postTags: new Map(Array.from(store.postTags.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
    postSeos: new Map(Array.from(store.postSeos.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
    postRevisions: JSON.parse(JSON.stringify(store.postRevisions)),
    mediaAssets: new Map(Array.from(store.mediaAssets.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
    auditLogs: JSON.parse(JSON.stringify(store.auditLogs)),
    globalSettings: JSON.parse(JSON.stringify(store.globalSettings)),
    navigationItems: new Map(Array.from(store.navigationItems.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
    footerSettings: new Map(Array.from(store.footerSettings.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
    formatContents: new Map(Array.from(store.formatContents.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
  };
}

function restoreMemoryStore(target: MemoryStorage, snapshot: MemoryStorage) {
  for (const [key, val] of Object.entries(snapshot)) {
    if (val instanceof Map) {
      (target as any)[key].clear();
      for (const [k, v] of val.entries()) {
        (target as any)[key].set(k, v);
      }
    } else if (Array.isArray(val)) {
      (target as any)[key] = [...val];
    } else {
      (target as any)[key] = { ...val };
    }
  }
}


// Seed default initial pages into memory
const DEFAULT_PAGES = [
  { id: 'page-home', slug: 'home', name: 'Home Page', status: 'PUBLISHED' as PageStatus },
  { id: 'page-image-tools', slug: 'image-tools', name: 'Image Tools Directory', status: 'PUBLISHED' as PageStatus },
  { id: 'page-pdf-tools', slug: 'pdf-tools', name: 'PDF Tools Directory', status: 'PUBLISHED' as PageStatus },
  { id: 'page-about', slug: 'about', name: 'About Us', status: 'PUBLISHED' as PageStatus },
  { id: 'page-privacy', slug: 'privacy', name: 'Privacy Policy', status: 'PUBLISHED' as PageStatus },
  { id: 'page-terms', slug: 'terms', name: 'Terms of Service', status: 'PUBLISHED' as PageStatus },
  { id: 'page-contact', slug: 'contact', name: 'Contact Us', status: 'PUBLISHED' as PageStatus },
];

const DEFAULT_PAGE_CONTENTS: Record<string, any> = {
  'page-about': {
    blocks: [
      { id: 'blk-about-h1', type: 'heading', level: 1, text: 'About FileTools' },
      { id: 'blk-about-p1', type: 'paragraph', text: 'Fast, privacy-first image and PDF utilities designed to run directly on your own device.' },
      { id: 'blk-about-p2', type: 'paragraph', text: 'FileTools was founded with a straightforward conviction: basic file conversion and document management should be accessible to everyone without friction, paywalls, or privacy compromises.' },
      { id: 'blk-about-f1', type: 'feature', title: 'Zero Server Uploads', description: 'Complete privacy by default. We do not store, view, or retain your files.' },
      { id: 'blk-about-f2', type: 'feature', title: '100% Free Service', description: 'No subscriptions, account signups, credit cards, or hidden fees.' },
      { id: 'blk-about-f3', type: 'feature', title: 'Instant Processing', description: 'Fast client execution eliminates network upload and download bottlenecks.' },
      { id: 'blk-about-f4', type: 'feature', title: 'Clean Design', description: 'No intrusive popups or deceptive dark patterns. Pure utility.' },
    ],
    customCss: null,
  },
  'page-contact': {
    blocks: [
      { id: 'blk-contact-h1', type: 'heading', level: 1, text: 'Contact Us' },
      { id: 'blk-contact-p1', type: 'paragraph', text: 'Have questions, feedback, or need technical assistance with our file tools? We would love to hear from you.' },
      { id: 'blk-contact-cta', type: 'cta', label: 'Send an Email', href: 'mailto:support@example.com', variant: 'primary' },
    ],
    customCss: null,
  },
  'page-privacy': {
    blocks: [
      { id: 'blk-privacy-h1', type: 'heading', level: 1, text: 'Privacy Policy' },
      { id: 'blk-privacy-p1', type: 'paragraph', text: 'Your privacy is paramount. All file conversions are processed locally on your device using client-side WebAssembly and Canvas APIs. No file data is uploaded to remote servers.' },
    ],
    customCss: null,
  },
  'page-terms': {
    blocks: [
      { id: 'blk-terms-h1', type: 'heading', level: 1, text: 'Terms of Service' },
      { id: 'blk-terms-p1', type: 'paragraph', text: 'By using FileTools, you agree to these Terms of Service. FileTools provides browser-based file conversion and manipulation utilities free of charge.' },
    ],
    customCss: null,
  },
};

const DEFAULT_PAGE_SEOS: Record<string, any> = {
  'page-about': {
    seoTitle: 'About Us – Free Online File Utilities',
    metaDescription: 'Learn about FileTools, our mission to deliver fast, private, and 100% free image and PDF conversion utilities entirely within your browser.',
    canonicalUrl: '/about',
    robotsIndex: true,
    robotsFollow: true,
  },
  'page-contact': {
    seoTitle: 'Contact Us – Free Online File Tools',
    metaDescription: 'Get in touch with the FileTools team for questions, feedback, or support regarding our free file conversion tools.',
    canonicalUrl: '/contact',
    robotsIndex: true,
    robotsFollow: true,
  },
  'page-privacy': {
    seoTitle: 'Privacy Policy – Free Online File Tools',
    metaDescription: 'Read our Privacy Policy to understand how FileTools ensures complete confidentiality by processing files locally on your device.',
    canonicalUrl: '/privacy',
    robotsIndex: true,
    robotsFollow: true,
  },
  'page-terms': {
    seoTitle: 'Terms of Service – Free Online File Tools',
    metaDescription: 'Review the terms and conditions for using FileTools free online file conversion and optimization utilities.',
    canonicalUrl: '/terms',
    robotsIndex: true,
    robotsFollow: true,
  },
};

const DEFAULT_BLOG_CATEGORIES = [
  { id: 'cat-image-opt', slug: 'image-optimization', name: 'Image Optimization', description: 'Guides on compressing, converting, and formatting web images.' },
  { id: 'cat-pdf-work', slug: 'pdf-workflows', name: 'PDF Workflows', description: 'Best practices for merging, splitting, and organizing PDF documents.' },
  { id: 'cat-privacy-sec', slug: 'privacy-security', name: 'Privacy & Security', description: 'Learn how client-side processing keeps your confidential files secure.' },
  { id: 'cat-doc-tips', slug: 'document-tips', name: 'Document Tips', description: 'Productivity tricks and tutorials for digital file management.' },
];

function seedDefaultData() {
  for (const p of DEFAULT_PAGES) {
    memoryStore.pages.set(p.id, {
      ...p,
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const content = DEFAULT_PAGE_CONTENTS[p.id] || { blocks: [], customCss: null };
    memoryStore.pageContents.set(p.id, {
      id: `content-${p.id}`,
      pageId: p.id,
      version: 1,
      isPublished: p.status === 'PUBLISHED',
      blocks: content.blocks,
      customCss: content.customCss,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const seo = DEFAULT_PAGE_SEOS[p.id] || {
      seoTitle: `${p.name} – Free Online File Tools`,
      metaDescription: `Discover ${p.name} on FileTools. 100% private, client-side tools.`,
      canonicalUrl: `/${p.slug === 'home' ? '' : p.slug}`,
      robotsIndex: true,
      robotsFollow: true,
    };
    memoryStore.pageSeos.set(p.id, {
      id: `seo-${p.id}`,
      pageId: p.id,
      ...seo,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  }

  // Seed default blog categories
  for (const cat of DEFAULT_BLOG_CATEGORIES) {
    memoryStore.blogCategories.set(cat.id, {
      ...cat,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  }

  // Seed default navigation items
  const defaultNavs = [
    { id: 'nav-blog', menu: 'header', label: 'Blog', destination: '/blog', order: 2, visible: true, icon: 'BookOpen', isExternal: false, openNewTab: false },
    { id: 'nav-pricing', menu: 'header', label: 'Pricing', destination: '/#pricing', order: 3, visible: true, icon: 'DollarSign', isExternal: false, openNewTab: false },
    { id: 'nav-help', menu: 'header', label: 'Help', destination: '/#faq', order: 4, visible: true, icon: 'HelpCircle', isExternal: false, openNewTab: false },
  ];
  for (const n of defaultNavs) {
    memoryStore.navigationItems.set(n.id, {
      ...n,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Seed default footer settings
  memoryStore.footerSettings.set('default', {
    id: 'default',
    brandDescription: 'Fast, privacy-focused image and PDF utility tools. Process files safely in your browser without registration or uploads.',
    copyrightText: '© 2026 Convert24. Free online file utility service. All rights reserved.',
    trustText: 'Client-side processing • 100% Free • No registration',
    linksJson: [
      {
        title: "Tools & Converters",
        links: [
          { label: "Image Tools", href: "/image-tools" },
          { label: "PDF Tools", href: "/pdf-tools" },
          { label: "JPG to PNG", href: "/tools/jpg-to-png" },
          { label: "Compress Image", href: "/tools/compress-image" },
          { label: "Merge PDF", href: "/tools/merge-pdf" }
        ]
      },
      {
        title: "Formats & Guides",
        links: [
          { label: "JPG Format Guide", href: "/formats/jpg" },
          { label: "PNG Format Guide", href: "/formats/png" },
          { label: "WEBP Format Guide", href: "/formats/webp" },
          { label: "PDF Format Guide", href: "/formats/pdf" },
          { label: "Blog & Tutorials", href: "/blog" }
        ]
      },
      {
        title: "About & Legal",
        links: [
          { label: "About Us", href: "/about" },
          { label: "Privacy Policy", href: "/privacy" },
          { label: "Terms of Service", href: "/terms" },
          { label: "Contact", href: "/contact" }
        ]
      }
    ],
    updatedAt: new Date(),
  });
}

function attachBlogPostRelations(post: any, include?: any) {
  if (!post || !include) return post;
  const res = { ...post };

  if (include.author) {
    const author = post.authorId ? memoryStore.adminUsers.get(post.authorId) : null;
    res.author = author ? { id: author.id, name: author.name, email: author.email, role: author.role } : null;
  }

  if (include.category) {
    res.category = post.categoryId ? (memoryStore.blogCategories.get(post.categoryId) || null) : null;
  }

  if (include.seo) {
    res.seo = memoryStore.postSeos.get(post.id) || null;
  }

  if (include.tags) {
    const tags: any[] = [];
    for (const pt of memoryStore.postTags.values()) {
      if (pt.postId === post.id) {
        const tag = memoryStore.blogTags.get(pt.tagId);
        tags.push({
          postId: post.id,
          tagId: pt.tagId,
          tag: tag || null,
        });
      }
    }
    res.tags = tags;
  }

  if (include.revisions) {
    res.revisions = memoryStore.postRevisions.filter((r) => r.postId === post.id);
  }

  return res;
}

function filterBlogPosts(where?: any, orderBy?: any): any[] {
  let list = Array.from(memoryStore.blogPosts.values());

  if (where) {
    if (where.id) {
      if (typeof where.id === 'string') {
        list = list.filter((p) => p.id === where.id);
      } else if (where.id.not) {
        list = list.filter((p) => p.id !== where.id.not);
      }
    }
    if (where.slug) {
      list = list.filter((p) => p.slug === where.slug);
    }
    if (where.status) {
      list = list.filter((p) => p.status === where.status);
    }
    if (where.categoryId) {
      list = list.filter((p) => p.categoryId === where.categoryId);
    }
    if (where.authorId) {
      list = list.filter((p) => p.authorId === where.authorId);
    }
    if (where.publishedAt?.lte) {
      const maxDate = new Date(where.publishedAt.lte).getTime();
      list = list.filter((p) => p.publishedAt && new Date(p.publishedAt).getTime() <= maxDate);
    }
    if (where.scheduledFor?.lte) {
      const maxDate = new Date(where.scheduledFor.lte).getTime();
      list = list.filter((p) => p.scheduledFor && new Date(p.scheduledFor).getTime() <= maxDate);
    }
    if (where.tags?.some) {
      const tagCondition = where.tags.some;
      if (tagCondition.tagId) {
        list = list.filter((p) => {
          const pt = memoryStore.postTags.get(`${p.id}_${tagCondition.tagId}`);
          return Boolean(pt);
        });
      } else if (tagCondition.tag?.slug) {
        list = list.filter((p) => {
          for (const pt of memoryStore.postTags.values()) {
            if (pt.postId === p.id) {
              const tag = memoryStore.blogTags.get(pt.tagId);
              if (tag?.slug === tagCondition.tag.slug) return true;
            }
          }
          return false;
        });
      }
    }
    if (where.category?.slug) {
      list = list.filter((p) => {
        const cat = p.categoryId ? memoryStore.blogCategories.get(p.categoryId) : null;
        return cat?.slug === where.category.slug;
      });
    }
    if (where.OR && Array.isArray(where.OR)) {
      list = list.filter((p) => {
        return where.OR.some((condition: any) => {
          if (condition.title?.contains) {
            const query = condition.title.contains.toLowerCase();
            return p.title?.toLowerCase().includes(query);
          }
          if (condition.excerpt?.contains) {
            const query = condition.excerpt.contains.toLowerCase();
            return p.excerpt?.toLowerCase().includes(query);
          }
          if (condition.content?.contains) {
            const query = condition.content.contains.toLowerCase();
            return p.content?.toLowerCase().includes(query);
          }
          return false;
        });
      });
    }
  }

  // Handle orderBy
  if (orderBy) {
    if (orderBy.publishedAt === 'desc') {
      list.sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime());
    } else if (orderBy.publishedAt === 'asc') {
      list.sort((a, b) => new Date(a.publishedAt || a.createdAt).getTime() - new Date(b.publishedAt || b.createdAt).getTime());
    } else if (orderBy.updatedAt === 'desc') {
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else if (orderBy.createdAt === 'desc') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } else {
    list.sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime());
  }

  return list;
}

seedDefaultData();

function shouldUsePrisma(): boolean {
  return isPrismaConfigured();
}

/**
 * In-memory repository implementing standard Prisma query contracts
 * for reliable unit testing and offline development.
 */
export const memoryDb = {
  async $transaction(fnOrArray: any) {
    if (typeof fnOrArray === 'function') {
      const snapshot = cloneMemoryStore(memoryStore);
      try {
        return await fnOrArray(memoryDb);
      } catch (err) {
        restoreMemoryStore(memoryStore, snapshot);
        throw err;
      }
    }
    if (Array.isArray(fnOrArray)) {
      return Promise.all(fnOrArray);
    }
    throw new Error('Unsupported $transaction argument');
  },
  adminUser: {
    async findUnique({ where }: { where: { id?: string; email?: string } }) {
      if (where.id) {
        return memoryStore.adminUsers.get(where.id) || null;
      }
      if (where.email) {
        for (const u of memoryStore.adminUsers.values()) {
          if (u.email.toLowerCase() === where.email.toLowerCase()) return { ...u };
        }
      }
      return null;
    },
    async findFirst({ where }: { where?: any }) {
      for (const u of memoryStore.adminUsers.values()) {
        if (where?.id && u.id !== where.id) continue;
        if (where?.email && u.email.toLowerCase() !== where.email.toLowerCase()) continue;
        if (where?.isActive !== undefined && u.isActive !== where.isActive) continue;
        if (where?.role && u.role !== where.role) continue;
        if (where?.passwordResetTokenHash && u.passwordResetTokenHash !== where.passwordResetTokenHash) continue;
        return { ...u };
      }
      return null;
    },
    async findMany({ where, orderBy, take, skip }: { where?: any; orderBy?: any; take?: number; skip?: number } = {}) {
      let list = Array.from(memoryStore.adminUsers.values());
      if (where?.role) list = list.filter((u) => u.role === where.role);
      if (where?.isActive !== undefined) list = list.filter((u) => u.isActive === where.isActive);
      if (where?.OR && Array.isArray(where.OR)) {
        list = list.filter((u) => {
          return where.OR.some((cond: any) => {
            if (cond.name?.contains) return u.name?.toLowerCase().includes(cond.name.contains.toLowerCase());
            if (cond.email?.contains) return u.email?.toLowerCase().includes(cond.email.contains.toLowerCase());
            return false;
          });
        });
      }
      if (orderBy) {
        if (orderBy.createdAt === 'desc') {
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else if (orderBy.createdAt === 'asc') {
          list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        } else if (orderBy.name === 'asc') {
          list.sort((a, b) => a.name.localeCompare(b.name));
        } else if (orderBy.name === 'desc') {
          list.sort((a, b) => b.name.localeCompare(a.name));
        } else if (orderBy.email === 'asc') {
          list.sort((a, b) => a.email.localeCompare(b.email));
        } else if (orderBy.lastLoginAt === 'desc') {
          list.sort((a, b) => new Date(b.lastLoginAt || 0).getTime() - new Date(a.lastLoginAt || 0).getTime());
        }
      } else {
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      if (skip) list = list.slice(skip);
      if (take) list = list.slice(0, take);
      return list.map((u) => ({ ...u }));
    },
    async create({ data }: { data: any }) {
      const id = data.id || `admin-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const user = {
        id,
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name,
        role: data.role || 'EDITOR',
        isActive: data.isActive !== undefined ? data.isActive : true,
        lastLoginAt: data.lastLoginAt || null,
        failedLoginAttempts: data.failedLoginAttempts || 0,
        lockedUntil: data.lockedUntil || null,
        passwordResetTokenHash: data.passwordResetTokenHash || null,
        passwordResetExpiresAt: data.passwordResetExpiresAt || null,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date(),
      };
      memoryStore.adminUsers.set(id, user);
      return { ...user };
    },
    async update({ where, data }: { where: { id: string }; data: any }) {
      const existing = memoryStore.adminUsers.get(where.id);
      if (!existing) throw new Error(`AdminUser not found: ${where.id}`);
      const updated = {
        ...existing,
        ...data,
        updatedAt: new Date(),
      };
      memoryStore.adminUsers.set(where.id, updated);
      return { ...updated };
    },
    async delete({ where }: { where: { id: string } }) {
      const existing = memoryStore.adminUsers.get(where.id);
      if (existing) {
        memoryStore.adminUsers.delete(where.id);
      }
      return existing;
    },
    async count({ where }: { where?: any } = {}) {
      if (!where) return memoryStore.adminUsers.size;
      let count = 0;
      for (const u of memoryStore.adminUsers.values()) {
        if (where.role && u.role !== where.role) continue;
        if (where.isActive !== undefined && u.isActive !== where.isActive) continue;
        count++;
      }
      return count;
    },
  },

  page: {
    async findUnique({ where, include }: { where: { id?: string; slug?: string }; include?: any }) {
      let found: any = null;
      if (where.id) {
        found = memoryStore.pages.get(where.id) || null;
      } else if (where.slug) {
        for (const p of memoryStore.pages.values()) {
          if (p.slug === where.slug) {
            found = p;
            break;
          }
        }
      }
      if (!found) return null;
      const res = { ...found };
      if (include?.content) {
        res.content = memoryStore.pageContents.get(found.id) || null;
      }
      if (include?.seo) {
        res.seo = memoryStore.pageSeos.get(found.id) || null;
      }
      return res;
    },
    async findMany({ where, include, orderBy }: { where?: any; include?: any; orderBy?: any } = {}) {
      let list = Array.from(memoryStore.pages.values());
      if (where?.status) {
        list = list.filter((p) => p.status === where.status);
      }
      return list.map((p) => {
        const res = { ...p };
        if (include?.content) res.content = memoryStore.pageContents.get(p.id) || null;
        if (include?.seo) res.seo = memoryStore.pageSeos.get(p.id) || null;
        return res;
      });
    },
    async create({ data, include }: { data: any; include?: any }) {
      for (const p of memoryStore.pages.values()) {
        if (p.slug === data.slug) {
          throw new Error(`Unique constraint failed on the fields: (slug)`);
        }
      }
      const id = data.id || `page-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const page = {
        id,
        slug: data.slug,
        name: data.name,
        status: data.status || 'DRAFT',
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.pages.set(id, page);

      if (data.content?.create) {
        const c = {
          id: `content-${id}`,
          pageId: id,
          version: data.content.create.version || 1,
          isPublished: data.content.create.isPublished || false,
          blocks: data.content.create.blocks || [],
          customCss: data.content.create.customCss || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        memoryStore.pageContents.set(id, c);
      }

      if (data.seo?.create) {
        const s = {
          id: `seo-${id}`,
          pageId: id,
          ...data.seo.create,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        memoryStore.pageSeos.set(id, s);
      }

      const res: any = { ...page };
      if (include?.content) res.content = memoryStore.pageContents.get(id) || null;
      if (include?.seo) res.seo = memoryStore.pageSeos.get(id) || null;
      return res;
    },
    async update({ where, data, include }: { where: { id: string }; data: any; include?: any }) {
      const existing = memoryStore.pages.get(where.id);
      if (!existing) throw new Error(`Page not found: ${where.id}`);
      const updated = {
        ...existing,
        ...data,
        updatedAt: new Date(),
      };
      memoryStore.pages.set(where.id, updated);
      const res: any = { ...updated };
      if (include?.content) res.content = memoryStore.pageContents.get(where.id) || null;
      if (include?.seo) res.seo = memoryStore.pageSeos.get(where.id) || null;
      return res;
    },
    async delete({ where }: { where: { id: string } }) {
      const existing = memoryStore.pages.get(where.id);
      if (existing) {
        memoryStore.pages.delete(where.id);
        memoryStore.pageContents.delete(where.id);
        memoryStore.pageSeos.delete(where.id);
      }
      return existing || null;
    },
    async upsert({ where, create, update, include }: { where: { slug?: string; id?: string }; create: any; update: any; include?: any }) {
      let existing: any = null;
      if (where.slug) {
        for (const p of memoryStore.pages.values()) {
          if (p.slug === where.slug) { existing = p; break; }
        }
      } else if (where.id) {
        existing = memoryStore.pages.get(where.id);
      }
      if (existing) {
        return memoryDb.page.update({ where: { id: existing.id }, data: update, include });
      } else {
        return memoryDb.page.create({ data: create, include });
      }
    },
    async count({ where }: { where?: any } = {}) {
      if (!where) return memoryStore.pages.size;
      let count = 0;
      for (const p of memoryStore.pages.values()) {
        if (where.status && p.status !== where.status) continue;
        count++;
      }
      return count;
    },
  },

  pageContent: {
    async findUnique({ where }: { where: { pageId: string } }) {
      return memoryStore.pageContents.get(where.pageId) || null;
    },
    async create({ data }: { data: any }) {
      const c = {
        id: data.id || `content-${data.pageId}`,
        pageId: data.pageId,
        version: data.version || 1,
        isPublished: data.isPublished || false,
        blocks: data.blocks || [],
        customCss: data.customCss || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.pageContents.set(data.pageId, c);
      return { ...c };
    },
    async update({ where, data }: { where: { pageId: string }; data: any }) {
      const existing = memoryStore.pageContents.get(where.pageId) || {
        id: `content-${where.pageId}`,
        pageId: where.pageId,
        version: 1,
        isPublished: false,
        blocks: [],
        createdAt: new Date(),
      };
      const updated = {
        ...existing,
        ...data,
        updatedAt: new Date(),
      };
      memoryStore.pageContents.set(where.pageId, updated);
      return { ...updated };
    },
    async upsert({ where, create, update }: { where: { pageId: string }; create: any; update: any }) {
      const existing = memoryStore.pageContents.get(where.pageId);
      if (existing) {
        return memoryDb.pageContent.update({ where, data: update });
      } else {
        return memoryDb.pageContent.create({ data: create });
      }
    },
  },

  pageSeo: {
    async findUnique({ where }: { where: { pageId: string } }) {
      return memoryStore.pageSeos.get(where.pageId) || null;
    },
    async create({ data }: { data: any }) {
      const s = {
        id: data.id || `seo-${data.pageId}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.pageSeos.set(data.pageId, s);
      return { ...s };
    },
    async update({ where, data }: { where: { pageId: string }; data: any }) {
      const existing = memoryStore.pageSeos.get(where.pageId) || {
        id: `seo-${where.pageId}`,
        pageId: where.pageId,
        createdAt: new Date(),
      };
      const updated = {
        ...existing,
        ...data,
        updatedAt: new Date(),
      };
      memoryStore.pageSeos.set(where.pageId, updated);
      return { ...updated };
    },
    async upsert({ where, create, update }: { where: { pageId: string }; create: any; update: any }) {
      const existing = memoryStore.pageSeos.get(where.pageId);
      if (existing) {
        return memoryDb.pageSeo.update({ where, data: update });
      } else {
        return memoryDb.pageSeo.create({ data: create });
      }
    },
  },

  toolContent: {
    async findUnique({ where, include }: { where: { toolSlug?: string; id?: string }; include?: any }) {
      let found: any = null;
      if (where.toolSlug) {
        found = memoryStore.toolContents.get(where.toolSlug) || null;
      }
      if (!found) return null;
      const res = { ...found };
      if (include?.seo) {
        res.seo = memoryStore.toolSeos.get(found.id) || null;
      }
      return res;
    },
    async findMany({ include }: { include?: any } = {}) {
      return Array.from(memoryStore.toolContents.values()).map((t) => {
        const res = { ...t };
        if (include?.seo) res.seo = memoryStore.toolSeos.get(t.id) || null;
        return res;
      });
    },
    async upsert({ where, create, update, include }: { where: { toolSlug: string }; create: any; update: any; include?: any }) {
      const existing = memoryStore.toolContents.get(where.toolSlug);
      let target: any;
      if (existing) {
        const cleanUpdate: any = {};
        for (const [k, v] of Object.entries(update)) {
          if (v !== undefined) cleanUpdate[k] = v;
        }
        target = { ...existing, ...cleanUpdate, updatedAt: new Date() };
      } else {
        const id = `tc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        target = { id, ...create, createdAt: new Date(), updatedAt: new Date() };
      }
      memoryStore.toolContents.set(where.toolSlug, target);

      if (create.seo?.create || update.seo?.upsert) {
        const seoData = create.seo?.create || update.seo?.upsert?.create || update.seo?.upsert?.update;
        if (seoData) {
          memoryStore.toolSeos.set(target.id, {
            id: `ts-${target.id}`,
            toolContentId: target.id,
            ...seoData,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      const res = { ...target };
      if (include?.seo) res.seo = memoryStore.toolSeos.get(target.id) || null;
      return res;
    },
    async update({ where, data, include }: { where: { toolSlug?: string; id?: string }; data: any; include?: any }) {
      const slug = where.toolSlug;
      let existing: any = null;
      if (slug) {
        existing = memoryStore.toolContents.get(slug);
      } else if (where.id) {
        for (const t of memoryStore.toolContents.values()) {
          if (t.id === where.id) { existing = t; break; }
        }
      }
      if (!existing) throw new Error(`ToolContent not found: ${slug || where.id}`);
      const cleanData: any = {};
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) cleanData[k] = v;
      }
      const updated = {
        ...existing,
        ...cleanData,
        updatedAt: new Date(),
      };
      memoryStore.toolContents.set(existing.toolSlug, updated);
      const res = { ...updated };
      if (include?.seo) res.seo = memoryStore.toolSeos.get(existing.id) || null;
      return res;
    },
    async count() {
      return memoryStore.toolContents.size;
    },
  },

  toolSeo: {
    async findUnique({ where }: { where: { toolContentId?: string } }) {
      if (where.toolContentId) return memoryStore.toolSeos.get(where.toolContentId) || null;
      return null;
    },
    async create({ data }: { data: any }) {
      const s = {
        id: data.id || `ts-${data.toolContentId}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.toolSeos.set(data.toolContentId, s);
      return { ...s };
    },
    async update({ where, data }: { where: { toolContentId: string }; data: any }) {
      const existing = memoryStore.toolSeos.get(where.toolContentId) || {
        id: `ts-${where.toolContentId}`,
        toolContentId: where.toolContentId,
        createdAt: new Date(),
      };
      const updated = {
        ...existing,
        ...data,
        updatedAt: new Date(),
      };
      memoryStore.toolSeos.set(where.toolContentId, updated);
      return { ...updated };
    },
    async upsert({ where, create, update }: { where: { toolContentId: string }; create: any; update: any }) {
      const existing = memoryStore.toolSeos.get(where.toolContentId);
      const target = existing ? { ...existing, ...update, updatedAt: new Date() } : { id: `ts-${where.toolContentId}`, ...create, createdAt: new Date(), updatedAt: new Date() };
      memoryStore.toolSeos.set(where.toolContentId, target);
      return { ...target };
    },
  },

  pageRevision: {
    async create({ data }: { data: any }) {
      const rev = {
        id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...data,
        createdAt: new Date(),
      };
      memoryStore.pageRevisions.push(rev);
      return { ...rev };
    },
    async findUnique({ where }: { where: { id: string } }) {
      for (const r of memoryStore.pageRevisions) {
        if (r.id === where.id) return { ...r };
      }
      return null;
    },
    async findFirst({ where, orderBy }: { where?: any; orderBy?: any } = {}) {
      let list = [...memoryStore.pageRevisions];
      if (where?.id) list = list.filter((r) => r.id === where.id);
      if (where?.pageId) list = list.filter((r) => r.pageId === where.pageId);
      if (orderBy?.createdAt === 'desc') {
        list.reverse();
      }
      return list[0] ? { ...list[0] } : null;
    },
    async findMany({ where, orderBy }: { where?: any; orderBy?: any } = {}) {
      let list = [...memoryStore.pageRevisions];
      if (where?.pageId) list = list.filter((r) => r.pageId === where.pageId);
      if (orderBy?.createdAt === 'desc') {
        list.reverse();
      }
      return list;
    },
  },

  toolRevision: {
    async create({ data }: { data: any }) {
      const rev = {
        id: `trev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...data,
        createdAt: new Date(),
      };
      memoryStore.toolRevisions.push(rev);
      return { ...rev };
    },
    async findUnique({ where }: { where: { id: string } }) {
      for (const r of memoryStore.toolRevisions) {
        if (r.id === where.id) return { ...r };
      }
      return null;
    },
    async findFirst({ where, orderBy }: { where?: any; orderBy?: any } = {}) {
      let list = [...memoryStore.toolRevisions];
      if (where?.id) list = list.filter((r) => r.id === where.id);
      if (where?.toolSlug) list = list.filter((r) => r.toolSlug === where.toolSlug);
      if (where?.toolContentId) list = list.filter((r) => r.toolContentId === where.toolContentId);
      if (orderBy?.createdAt === 'desc') {
        list.reverse();
      }
      return list[0] ? { ...list[0] } : null;
    },
    async findMany({ where, orderBy }: { where?: any; orderBy?: any } = {}) {
      let list = [...memoryStore.toolRevisions];
      if (where?.toolSlug) list = list.filter((r) => r.toolSlug === where.toolSlug);
      if (where?.toolContentId) list = list.filter((r) => r.toolContentId === where.toolContentId);
      if (orderBy?.createdAt === 'desc') {
        list.reverse();
      }
      return list;
    },
  },

  auditLog: {
    async create({ data }: { data: any }) {
      const log = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...data,
        createdAt: new Date(),
      };
      memoryStore.auditLogs.unshift(log);
      return { ...log };
    },
    async findMany({ where, orderBy, take, skip }: { where?: any; orderBy?: any; take?: number; skip?: number } = {}) {
      let list = [...memoryStore.auditLogs];
      if (where?.userId) list = list.filter((l) => l.userId === where.userId);
      if (where?.entityType) list = list.filter((l) => l.entityType === where.entityType);
      if (where?.action) list = list.filter((l) => l.action === where.action);
      if (where?.entityId) list = list.filter((l) => l.entityId === where.entityId);
      const start = skip || 0;
      const end = take ? start + take : undefined;
      return list.slice(start, end).map((l) => {
        const user = l.userId ? memoryStore.adminUsers.get(l.userId) : null;
        return {
          ...l,
          user: user ? { id: user.id, name: user.name, email: user.email } : null,
        };
      });
    },
    async count() {
      return memoryStore.auditLogs.length;
    },
  },

  globalSettings: {
    async findUnique({ where }: { where: { id: string } }) {
      return { ...memoryStore.globalSettings };
    },
    async update({ where, data }: { where: { id: string }; data: any }) {
      memoryStore.globalSettings = {
        ...memoryStore.globalSettings,
        ...data,
        updatedAt: new Date(),
      };
      return { ...memoryStore.globalSettings };
    },
    async upsert({ where, create, update }: { where: { id: string }; create: any; update: any }) {
      memoryStore.globalSettings = {
        ...memoryStore.globalSettings,
        ...update,
        updatedAt: new Date(),
      };
      return { ...memoryStore.globalSettings };
    },
  },

  navigationItem: {
    async findUnique({ where }: { where: { id: string } }) {
      return memoryStore.navigationItems.get(where.id) || null;
    },
    async findMany({ where, orderBy }: { where?: any; orderBy?: any } = {}) {
      let list = Array.from(memoryStore.navigationItems.values());
      if (where?.menu) list = list.filter((i) => i.menu === where.menu);
      if (where?.visible !== undefined) list = list.filter((i) => i.visible === where.visible);
      
      if (orderBy?.order === 'asc') {
        list.sort((a, b) => a.order - b.order);
      } else if (orderBy?.order === 'desc') {
        list.sort((a, b) => b.order - a.order);
      }
      return list.map((i) => ({ ...i }));
    },
    async create({ data }: { data: any }) {
      const id = data.id || `nav-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();
      const item = {
        id,
        menu: data.menu || 'header',
        label: data.label,
        destination: data.destination,
        order: data.order || 0,
        visible: data.visible !== undefined ? data.visible : true,
        icon: data.icon || null,
        isExternal: data.isExternal || false,
        openNewTab: data.openNewTab || false,
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.navigationItems.set(id, item);
      return { ...item };
    },
    async update({ where, data }: { where: { id: string }; data: any }) {
      const existing = memoryStore.navigationItems.get(where.id);
      if (!existing) throw new Error(`NavigationItem not found: ${where.id}`);
      const updated = {
        ...existing,
        ...data,
        updatedAt: new Date(),
      };
      memoryStore.navigationItems.set(where.id, updated);
      return { ...updated };
    },
    async delete({ where }: { where: { id: string } }) {
      const existing = memoryStore.navigationItems.get(where.id);
      if (existing) {
        memoryStore.navigationItems.delete(where.id);
      }
      return existing;
    },
    async findFirst({ where }: { where?: any } = {}) {
      for (const item of memoryStore.navigationItems.values()) {
        if (where?.menu && item.menu !== where.menu) continue;
        if (where?.label && item.label !== where.label) continue;
        if (where?.destination && item.destination !== where.destination) continue;
        return { ...item };
      }
      return null;
    },
    async deleteMany({ where }: { where?: any } = {}) {
      let count = 0;
      for (const [id, item] of Array.from(memoryStore.navigationItems.entries())) {
        if (where?.menu && item.menu !== where.menu) continue;
        memoryStore.navigationItems.delete(id);
        count++;
      }
      return { count };
    },
    async count({ where }: { where?: any } = {}) {
      let list = Array.from(memoryStore.navigationItems.values());
      if (where?.menu) list = list.filter((i) => i.menu === where.menu);
      if (where?.visible !== undefined) list = list.filter((i) => i.visible === where.visible);
      return list.length;
    },
  },

  footerSettings: {
    async findUnique({ where }: { where: { id: string } }) {
      const id = where.id || 'default';
      const existing = memoryStore.footerSettings.get(id);
      if (!existing) {
        // Return default fallback
        return {
          id: 'default',
          brandDescription: 'Fast, privacy-focused image and PDF utility tools. Process files safely in your browser without registration or uploads.',
          copyrightText: '© 2026 Convert24. Free online file utility service. All rights reserved.',
          trustText: 'Client-side processing • 100% Free • No registration',
          linksJson: [],
          updatedAt: new Date(),
        };
      }
      return { ...existing };
    },
    async update({ where, data }: { where: { id: string }; data: any }) {
      const id = where.id || 'default';
      const existing = memoryStore.footerSettings.get(id) || { id, createdAt: new Date() };
      const updated = {
        ...existing,
        ...data,
        updatedAt: new Date(),
      };
      memoryStore.footerSettings.set(id, updated);
      return { ...updated };
    },
    async upsert({ where, create, update }: { where: { id: string }; create: any; update: any }) {
      const id = where.id || 'default';
      const existing = memoryStore.footerSettings.get(id);
      const target = existing ? { ...existing, ...update, updatedAt: new Date() } : { id, ...create, createdAt: new Date(), updatedAt: new Date() };
      memoryStore.footerSettings.set(id, target);
      return { ...target };
    },
  },

  blogPost: {
    async findUnique({ where, include }: { where: { id?: string; slug?: string }; include?: any }) {
      let post: any = null;
      if (where.id) {
        post = memoryStore.blogPosts.get(where.id);
      } else if (where.slug) {
        for (const p of memoryStore.blogPosts.values()) {
          if (p.slug === where.slug) {
            post = p;
            break;
          }
        }
      }
      if (!post) return null;
      return attachBlogPostRelations({ ...post }, include);
    },

    async findFirst({ where, include, orderBy }: { where?: any; include?: any; orderBy?: any } = {}) {
      const posts = filterBlogPosts(where, orderBy);
      if (posts.length === 0) return null;
      return attachBlogPostRelations({ ...posts[0] }, include);
    },

    async findMany({ where, include, orderBy, take, skip }: { where?: any; include?: any; orderBy?: any; take?: number; skip?: number } = {}) {
      const filtered = filterBlogPosts(where, orderBy);
      const start = skip || 0;
      const end = take ? start + take : undefined;
      return filtered.slice(start, end).map((p) => attachBlogPostRelations({ ...p }, include));
    },

    async create({ data, include }: { data: any; include?: any }) {
      const id = data.id || `post-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();
      const { seo, tags, ...postFields } = data;

      const post = {
        id,
        status: 'DRAFT',
        content: '',
        createdAt: now,
        updatedAt: now,
        ...postFields,
      };
      memoryStore.blogPosts.set(id, post);

      // Handle nested SEO create
      if (seo?.create) {
        const seoId = `pseo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        memoryStore.postSeos.set(id, {
          id: seoId,
          postId: id,
          robotsIndex: true,
          robotsFollow: true,
          schemaType: 'Article',
          createdAt: now,
          updatedAt: now,
          ...seo.create,
        });
      }

      // Handle nested tags create
      if (tags?.create && Array.isArray(tags.create)) {
        for (const item of tags.create) {
          const tagId = item.tagId || item.tag?.connect?.id;
          if (tagId) {
            memoryStore.postTags.set(`${id}_${tagId}`, { postId: id, tagId });
          }
        }
      }

      return attachBlogPostRelations({ ...post }, include);
    },

    async update({ where, data, include }: { where: { id: string }; data: any; include?: any }) {
      const existing = memoryStore.blogPosts.get(where.id);
      if (!existing) {
        throw new Error(`BlogPost not found: ${where.id}`);
      }

      const { seo, tags, ...postFields } = data;
      const updated = {
        ...existing,
        ...postFields,
        updatedAt: new Date(),
      };
      memoryStore.blogPosts.set(where.id, updated);

      // Handle SEO update/upsert/create
      if (seo) {
        const existingSeo = memoryStore.postSeos.get(where.id);
        const seoData = seo.update || seo.create || seo.upsert?.update || seo.upsert?.create;
        if (seoData) {
          const now = new Date();
          memoryStore.postSeos.set(where.id, {
            id: existingSeo?.id || `pseo-${Date.now()}`,
            postId: where.id,
            robotsIndex: true,
            robotsFollow: true,
            schemaType: 'Article',
            createdAt: existingSeo?.createdAt || now,
            updatedAt: now,
            ...existingSeo,
            ...seoData,
          });
        }
      }

      // Handle tags replacement/deleteMany/create
      if (tags) {
        if (tags.deleteMany) {
          for (const key of Array.from(memoryStore.postTags.keys())) {
            if (key.startsWith(`${where.id}_`)) {
              memoryStore.postTags.delete(key);
            }
          }
        }
        if (tags.create && Array.isArray(tags.create)) {
          for (const item of tags.create) {
            const tagId = item.tagId || item.tag?.connect?.id;
            if (tagId) {
              memoryStore.postTags.set(`${where.id}_${tagId}`, { postId: where.id, tagId });
            }
          }
        }
      }

      return attachBlogPostRelations({ ...updated }, include);
    },

    async delete({ where }: { where: { id: string } }) {
      const post = memoryStore.blogPosts.get(where.id);
      if (!post) {
        throw new Error(`BlogPost not found: ${where.id}`);
      }
      memoryStore.blogPosts.delete(where.id);
      memoryStore.postSeos.delete(where.id);
      for (const key of Array.from(memoryStore.postTags.keys())) {
        if (key.startsWith(`${where.id}_`)) {
          memoryStore.postTags.delete(key);
        }
      }
      memoryStore.postRevisions = memoryStore.postRevisions.filter((r) => r.postId !== where.id);
      return post;
    },

    async upsert({ where, create, update, include }: { where: { slug?: string; id?: string }; create: any; update: any; include?: any }) {
      let existing: any = null;
      if (where.slug) {
        for (const p of memoryStore.blogPosts.values()) {
          if (p.slug === where.slug) { existing = p; break; }
        }
      } else if (where.id) {
        existing = memoryStore.blogPosts.get(where.id);
      }
      if (existing) {
        return memoryDb.blogPost.update({ where: { id: existing.id }, data: update, include });
      } else {
        return memoryDb.blogPost.create({ data: create, include });
      }
    },

    async count({ where }: { where?: any } = {}) {
      return filterBlogPosts(where).length;
    },
  },

  blogCategory: {
    async findUnique({ where, include }: { where: { id?: string; slug?: string }; include?: any }) {
      let cat: any = null;
      if (where.id) {
        cat = memoryStore.blogCategories.get(where.id);
      } else if (where.slug) {
        for (const c of memoryStore.blogCategories.values()) {
          if (c.slug === where.slug) {
            cat = c;
            break;
          }
        }
      }
      if (!cat) return null;
      const res = { ...cat };
      if (include?._count?.select?.posts) {
        res._count = {
          posts: Array.from(memoryStore.blogPosts.values()).filter((p) => p.categoryId === cat.id).length,
        };
      }
      return res;
    },

    async findMany({ where, include, orderBy }: { where?: any; include?: any; orderBy?: any } = {}) {
      const list = Array.from(memoryStore.blogCategories.values());
      if (orderBy?.name === 'asc') {
        list.sort((a, b) => a.name.localeCompare(b.name));
      } else if (orderBy?.createdAt === 'desc') {
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      return list.map((cat) => {
        const res = { ...cat };
        if (include?._count?.select?.posts) {
          res._count = {
            posts: Array.from(memoryStore.blogPosts.values()).filter((p) => p.categoryId === cat.id).length,
          };
        }
        return res;
      });
    },

    async create({ data }: { data: any }) {
      const id = data.id || `cat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();
      const cat = { id, createdAt: now, updatedAt: now, ...data };
      memoryStore.blogCategories.set(id, cat);
      return { ...cat };
    },

    async update({ where, data }: { where: { id: string }; data: any }) {
      const existing = memoryStore.blogCategories.get(where.id);
      if (!existing) throw new Error(`BlogCategory not found: ${where.id}`);
      const updated = { ...existing, ...data, updatedAt: new Date() };
      memoryStore.blogCategories.set(where.id, updated);
      return { ...updated };
    },

    async delete({ where }: { where: { id: string } }) {
      const existing = memoryStore.blogCategories.get(where.id);
      if (!existing) throw new Error(`BlogCategory not found: ${where.id}`);
      memoryStore.blogCategories.delete(where.id);
      return existing;
    },

    async upsert({ where, create, update }: { where: { slug?: string; id?: string }; create: any; update: any }) {
      let existing: any = null;
      if (where.slug) {
        for (const c of memoryStore.blogCategories.values()) {
          if (c.slug === where.slug) { existing = c; break; }
        }
      } else if (where.id) {
        existing = memoryStore.blogCategories.get(where.id);
      }
      if (existing) {
        return memoryDb.blogCategory.update({ where: { id: existing.id }, data: update });
      } else {
        return memoryDb.blogCategory.create({ data: create });
      }
    },

    async count() {
      return memoryStore.blogCategories.size;
    },
  },

  blogTag: {
    async findUnique({ where, include }: { where: { id?: string; slug?: string }; include?: any }) {
      let tag: any = null;
      if (where.id) {
        tag = memoryStore.blogTags.get(where.id);
      } else if (where.slug) {
        for (const t of memoryStore.blogTags.values()) {
          if (t.slug === where.slug) {
            tag = t;
            break;
          }
        }
      }
      if (!tag) return null;
      const res = { ...tag };
      if (include?._count?.select?.posts) {
        res._count = {
          posts: Array.from(memoryStore.postTags.values()).filter((pt) => pt.tagId === tag.id).length,
        };
      }
      return res;
    },

    async findMany({ where, include, orderBy }: { where?: any; include?: any; orderBy?: any } = {}) {
      const list = Array.from(memoryStore.blogTags.values());
      if (orderBy?.name === 'asc') {
        list.sort((a, b) => a.name.localeCompare(b.name));
      }
      return list.map((tag) => {
        const res = { ...tag };
        if (include?._count?.select?.posts) {
          res._count = {
            posts: Array.from(memoryStore.postTags.values()).filter((pt) => pt.tagId === tag.id).length,
          };
        }
        return res;
      });
    },

    async create({ data }: { data: any }) {
      const id = data.id || `tag-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();
      const tag = { id, createdAt: now, updatedAt: now, ...data };
      memoryStore.blogTags.set(id, tag);
      return { ...tag };
    },

    async update({ where, data }: { where: { id: string }; data: any }) {
      const existing = memoryStore.blogTags.get(where.id);
      if (!existing) throw new Error(`BlogTag not found: ${where.id}`);
      const updated = { ...existing, ...data, updatedAt: new Date() };
      memoryStore.blogTags.set(where.id, updated);
      return { ...updated };
    },

    async delete({ where }: { where: { id: string } }) {
      const existing = memoryStore.blogTags.get(where.id);
      if (!existing) throw new Error(`BlogTag not found: ${where.id}`);
      memoryStore.blogTags.delete(where.id);
      for (const [key, pt] of Array.from(memoryStore.postTags.entries())) {
        if (pt.tagId === where.id) {
          memoryStore.postTags.delete(key);
        }
      }
      return existing;
    },

    async upsert({ where, create, update }: { where: { slug?: string; id?: string }; create: any; update: any }) {
      let existing: any = null;
      if (where.slug) {
        for (const t of memoryStore.blogTags.values()) {
          if (t.slug === where.slug) { existing = t; break; }
        }
      } else if (where.id) {
        existing = memoryStore.blogTags.get(where.id);
      }
      if (existing) {
        return memoryDb.blogTag.update({ where: { id: existing.id }, data: update });
      } else {
        return memoryDb.blogTag.create({ data: create });
      }
    },

    async count() {
      return memoryStore.blogTags.size;
    },
  },

  postTag: {
    async findMany({ where }: { where?: any } = {}) {
      let list = Array.from(memoryStore.postTags.values());
      if (where?.postId) list = list.filter((pt) => pt.postId === where.postId);
      if (where?.tagId) list = list.filter((pt) => pt.tagId === where.tagId);
      return list.map((pt) => ({
        ...pt,
        tag: memoryStore.blogTags.get(pt.tagId) || null,
      }));
    },
    async create({ data }: { data: any }) {
      const key = `${data.postId}_${data.tagId}`;
      memoryStore.postTags.set(key, { ...data });
      return { ...data };
    },
    async deleteMany({ where }: { where?: any } = {}) {
      let count = 0;
      for (const [key, pt] of Array.from(memoryStore.postTags.entries())) {
        if (where?.postId && pt.postId === where.postId) {
          memoryStore.postTags.delete(key);
          count++;
        }
      }
      return { count };
    },
  },

  postSeo: {
    async findUnique({ where }: { where: { postId: string } }) {
      const seo = memoryStore.postSeos.get(where.postId);
      return seo ? { ...seo } : null;
    },
    async create({ data }: { data: any }) {
      const id = data.id || `pseo-${Date.now()}`;
      const now = new Date();
      const seo = { id, createdAt: now, updatedAt: now, robotsIndex: true, robotsFollow: true, schemaType: 'Article', ...data };
      memoryStore.postSeos.set(data.postId, seo);
      return { ...seo };
    },
    async update({ where, data }: { where: { postId: string }; data: any }) {
      const existing = memoryStore.postSeos.get(where.postId);
      const updated = { ...existing, ...data, updatedAt: new Date() };
      memoryStore.postSeos.set(where.postId, updated);
      return { ...updated };
    },
    async upsert({ where, create, update }: { where: { postId: string }; create: any; update: any }) {
      const existing = memoryStore.postSeos.get(where.postId);
      const now = new Date();
      const result = existing
        ? { ...existing, ...update, updatedAt: now }
        : { id: `pseo-${Date.now()}`, postId: where.postId, createdAt: now, updatedAt: now, robotsIndex: true, robotsFollow: true, schemaType: 'Article', ...create };
      memoryStore.postSeos.set(where.postId, result);
      return { ...result };
    },
    async delete({ where }: { where: { postId: string } }) {
      const existing = memoryStore.postSeos.get(where.postId);
      memoryStore.postSeos.delete(where.postId);
      return existing;
    },
  },

  postRevision: {
    async create({ data }: { data: any }) {
      const rev = {
        id: `prev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...data,
        createdAt: new Date(),
      };
      memoryStore.postRevisions.push(rev);
      return { ...rev };
    },
    async findMany({ where, orderBy, take }: { where?: any; orderBy?: any; take?: number } = {}) {
      let list = [...memoryStore.postRevisions];
      if (where?.postId) list = list.filter((r) => r.postId === where.postId);
      if (orderBy?.createdAt === 'desc') {
        list.reverse();
      }
      if (take) {
        list = list.slice(0, take);
      }
      return list.map((r) => {
        const author = r.authorId ? memoryStore.adminUsers.get(r.authorId) : null;
        return {
          ...r,
          author: author ? { id: author.id, name: author.name, email: author.email } : null,
        };
      });
    },
    async findUnique({ where }: { where: { id: string } }) {
      for (const r of memoryStore.postRevisions) {
        if (r.id === where.id) {
          const author = r.authorId ? memoryStore.adminUsers.get(r.authorId) : null;
          return {
            ...r,
            author: author ? { id: author.id, name: author.name, email: author.email } : null,
          };
        }
      }
      return null;
    },
  },
  mediaAsset: {
    async findMany({ where, orderBy, take, skip }: any = {}) {
      let list = Array.from(memoryStore.mediaAssets.values());
      if (where) {
        if (where.mimeType) {
          if (typeof where.mimeType === 'string') {
            list = list.filter((m) => m.mimeType === where.mimeType);
          } else if (where.mimeType.startsWith) {
            list = list.filter((m) => m.mimeType.startsWith(where.mimeType.startsWith));
          }
        }
        if (where.OR) {
          list = list.filter((m) =>
            where.OR.some((cond: any) => {
              if (cond.filename?.contains) return m.filename.toLowerCase().includes(cond.filename.contains.toLowerCase());
              if (cond.originalFilename?.contains) return m.originalFilename.toLowerCase().includes(cond.originalFilename.contains.toLowerCase());
              if (cond.title?.contains) return m.title && m.title.toLowerCase().includes(cond.title.contains.toLowerCase());
              if (cond.alt?.contains) return m.alt && m.alt.toLowerCase().includes(cond.alt.contains.toLowerCase());
              return false;
            })
          );
        }
      }
      if (orderBy) {
        if (orderBy.createdAt === 'desc') {
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else if (orderBy.createdAt === 'asc') {
          list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        } else if (orderBy.size === 'desc') {
          list.sort((a, b) => b.size - a.size);
        } else if (orderBy.size === 'asc') {
          list.sort((a, b) => a.size - b.size);
        } else if (orderBy.filename === 'asc') {
          list.sort((a, b) => a.filename.localeCompare(b.filename));
        } else if (orderBy.filename === 'desc') {
          list.sort((a, b) => b.filename.localeCompare(a.filename));
        }
      } else {
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      if (skip) {
        list = list.slice(skip);
      }
      if (take) {
        list = list.slice(0, take);
      }
      return list.map((m) => {
        const uploader = m.uploadedById ? memoryStore.adminUsers.get(m.uploadedById) : null;
        return {
          ...m,
          uploadedBy: uploader ? { id: uploader.id, name: uploader.name, email: uploader.email } : null,
        };
      });
    },
    async count({ where }: any = {}) {
      let list = Array.from(memoryStore.mediaAssets.values());
      if (where) {
        if (where.mimeType) {
          if (typeof where.mimeType === 'string') {
            list = list.filter((m) => m.mimeType === where.mimeType);
          } else if (where.mimeType.startsWith) {
            list = list.filter((m) => m.mimeType.startsWith(where.mimeType.startsWith));
          }
        }
        if (where.OR) {
          list = list.filter((m) =>
            where.OR.some((cond: any) => {
              if (cond.filename?.contains) return m.filename.toLowerCase().includes(cond.filename.contains.toLowerCase());
              if (cond.originalFilename?.contains) return m.originalFilename.toLowerCase().includes(cond.originalFilename.contains.toLowerCase());
              if (cond.title?.contains) return m.title && m.title.toLowerCase().includes(cond.title.contains.toLowerCase());
              if (cond.alt?.contains) return m.alt && m.alt.toLowerCase().includes(cond.alt.contains.toLowerCase());
              return false;
            })
          );
        }
      }
      return list.length;
    },
    async findUnique({ where, include }: any) {
      let found: any = null;
      if (where.id) {
        found = memoryStore.mediaAssets.get(where.id);
      } else if (where.filename) {
        for (const m of memoryStore.mediaAssets.values()) {
          if (m.filename === where.filename) {
            found = m;
            break;
          }
        }
      } else if (where.url) {
        for (const m of memoryStore.mediaAssets.values()) {
          if (m.url === where.url) {
            found = m;
            break;
          }
        }
      }
      if (!found) return null;
      const res = { ...found };
      if (include?.uploadedBy) {
        const uploader = res.uploadedById ? memoryStore.adminUsers.get(res.uploadedById) : null;
        res.uploadedBy = uploader ? { id: uploader.id, name: uploader.name, email: uploader.email } : null;
      }
      return res;
    },
    async findFirst({ where, include }: any = {}) {
      for (const m of memoryStore.mediaAssets.values()) {
        if (where?.filename && m.filename !== where.filename) continue;
        if (where?.url && m.url !== where.url) continue;
        const res = { ...m };
        if (include?.uploadedBy) {
          const uploader = res.uploadedById ? memoryStore.adminUsers.get(res.uploadedById) : null;
          res.uploadedBy = uploader ? { id: uploader.id, name: uploader.name, email: uploader.email } : null;
        }
        return res;
      }
      return null;
    },
    async create({ data, include }: any) {
      const id = data.id || `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date();
      const record = {
        id,
        filename: data.filename,
        originalFilename: data.originalFilename || data.filename,
        mimeType: data.mimeType,
        size: data.size || 0,
        width: data.width || null,
        height: data.height || null,
        url: data.url,
        storagePath: data.storagePath,
        alt: data.alt || null,
        title: data.title || null,
        caption: data.caption || null,
        description: data.description || null,
        uploadedById: data.uploadedById || null,
        createdAt: data.createdAt || now,
        updatedAt: data.updatedAt || now,
      };
      memoryStore.mediaAssets.set(id, record);
      const res: any = { ...record };
      if (include?.uploadedBy) {
        const uploader = res.uploadedById ? memoryStore.adminUsers.get(res.uploadedById) : null;
        res.uploadedBy = uploader ? { id: uploader.id, name: uploader.name, email: uploader.email } : null;
      }
      return res;
    },
    async update({ where, data, include }: any) {
      const existing = memoryStore.mediaAssets.get(where.id);
      if (!existing) throw new Error(`MediaAsset not found: ${where.id}`);
      const updated = {
        ...existing,
        alt: data.alt !== undefined ? data.alt : existing.alt,
        title: data.title !== undefined ? data.title : existing.title,
        caption: data.caption !== undefined ? data.caption : existing.caption,
        description: data.description !== undefined ? data.description : existing.description,
        updatedAt: new Date(),
      };
      memoryStore.mediaAssets.set(where.id, updated);
      const res: any = { ...updated };
      if (include?.uploadedBy) {
        const uploader = res.uploadedById ? memoryStore.adminUsers.get(res.uploadedById) : null;
        res.uploadedBy = uploader ? { id: uploader.id, name: uploader.name, email: uploader.email } : null;
      }
      return res;
    },
    async delete({ where }: any) {
      const existing = memoryStore.mediaAssets.get(where.id);
      if (existing) {
        memoryStore.mediaAssets.delete(where.id);
      }
      return existing;
    },
    async upsert({ where, create, update, include }: any) {
      let existing: any = null;
      if (where.filename) {
        for (const m of memoryStore.mediaAssets.values()) {
          if (m.filename === where.filename) { existing = m; break; }
        }
      } else if (where.id) {
        existing = memoryStore.mediaAssets.get(where.id);
      }
      if (existing) {
        return memoryDb.mediaAsset.update({ where: { id: existing.id }, data: update, include });
      } else {
        return memoryDb.mediaAsset.create({ data: create, include });
      }
    },
  },
  formatContent: {
    async findUnique({ where }: any) {
      if (where.formatSlug) {
        for (const record of memoryStore.formatContents.values()) {
          if (record.formatSlug === where.formatSlug) return { ...record };
        }
      }
      if (where.id) {
        const record = memoryStore.formatContents.get(where.id);
        return record ? { ...record } : null;
      }
      return null;
    },
    async findMany({ where }: any = {}) {
      const list = Array.from(memoryStore.formatContents.values());
      return list.map((r) => ({ ...r }));
    },
    async upsert({ where, update, create }: any) {
      let existing: any = null;
      if (where.formatSlug) {
        for (const record of memoryStore.formatContents.values()) {
          if (record.formatSlug === where.formatSlug) {
            existing = record;
            break;
          }
        }
      } else if (where.id) {
        existing = memoryStore.formatContents.get(where.id);
      }
      if (existing) {
        const updated = {
          ...existing,
          ...update,
          updatedAt: new Date(),
        };
        memoryStore.formatContents.set(existing.id, updated);
        return { ...updated };
      } else {
        const id = create.id || `fmt-${Date.now()}`;
        const record = {
          id,
          formatSlug: create.formatSlug,
          customTitle: create.customTitle || null,
          customDescription: create.customDescription || null,
          customDetails: create.customDetails || null,
          customBestFor: create.customBestFor || null,
          customPros: create.customPros || null,
          customCons: create.customCons || null,
          updatedAt: new Date(),
        };
        memoryStore.formatContents.set(id, record);
        return { ...record };
      }
    },
  },
};

let prismaUnreachable = false;
let prismaSchemaDrift = false;
let lastFailureTime = 0;
const RETRY_INTERVAL_MS = 30000;

export function isPrismaHealthy(): boolean {
  return shouldUsePrisma() && !prismaUnreachable && !prismaSchemaDrift;
}

export function isPrismaSchemaDrift(): boolean {
  return prismaSchemaDrift;
}

export function isPrismaUnreachable(): boolean {
  return prismaUnreachable;
}

/**
 * Identifies genuine network/connection failures where the database server cannot be reached.
 * NOTE: Schema errors (e.g. missing tables/columns P2021/P2022) are intentionally NOT classified as connection errors.
 */
export function isConnectionError(err: any): boolean {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : err.message || '';
  const code = err.code || '';
  return (
    err.name === 'PrismaClientInitializationError' ||
    err.name === 'PrismaClientRustPanicError' ||
    (err.name === 'PrismaClientKnownRequestError' && (
      code === 'P1000' ||
      code === 'P1001' ||
      code === 'P1002' ||
      code === 'P1003' ||
      code === 'P1008' ||
      code === 'P1011' ||
      code === 'P1017' ||
      code === 'P2024'
    )) ||
    code === 'P1000' ||
    code === 'P1001' ||
    code === 'P1002' ||
    code === 'P1003' ||
    code === 'P1008' ||
    code === 'P1011' ||
    code === 'P1017' ||
    code === 'P2024' ||
    msg.includes("Can't reach database server") ||
    msg.includes('connection refused') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('EHOSTUNREACH') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('EAI_AGAIN') ||
    msg.includes('Connection terminated') ||
    msg.includes('Connection lost') ||
    msg.includes('Connection closed') ||
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('SSL SYSCALL') ||
    msg.includes('ConnectionPoolTimeout') ||
    msg.includes('database server is not reachable')
  );
}

/**
 * Identifies schema drift errors (e.g. unmigrated tables or columns in PostgreSQL).
 */
export function isSchemaError(err: any): boolean {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : err.message || '';
  const code = err.code || '';
  return (
    code === 'P2021' || // The table `...` does not exist in the current database.
    code === 'P2022' || // The column `...` does not exist in the current database.
    (err.name === 'PrismaClientKnownRequestError' && (code === 'P2021' || code === 'P2022')) ||
    msg.includes('does not exist in the current database') ||
    (msg.includes('relation') && msg.includes('does not exist')) ||
    (msg.includes('column') && msg.includes('does not exist'))
  );
}

const WRITE_METHODS = new Set(['create', 'update', 'upsert', 'delete', 'deleteMany', 'updateMany', 'createMany']);

export class DatabasePersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabasePersistenceError';
  }
}

function createResilientDb(): typeof memoryDb | typeof prisma {
  return new Proxy(memoryDb as any, {
    get(_target, modelProp: string) {
      if (modelProp === '$disconnect' || modelProp === '$connect') {
        return async () => {};
      }

      if (modelProp === '$transaction') {
        const isProd = process.env.NODE_ENV === 'production';
        const isDbConfigured = shouldUsePrisma();
        const now = Date.now();
        const shouldAttemptPrisma =
          isDbConfigured &&
          (!prismaUnreachable || now - lastFailureTime > RETRY_INTERVAL_MS);

        if (!shouldAttemptPrisma) {
          if (isProd) {
            return async function () {
              const reason = !isDbConfigured
                ? 'DATABASE_URL environment variable is missing or invalid in production'
                : 'PostgreSQL database server is unreachable';
              throw new DatabasePersistenceError(`Database persistence unavailable: ${reason}. Write operation aborted to prevent silent data loss.`);
            };
          }
          return (fnOrArray: any) => memoryDb.$transaction(fnOrArray);
        }

        return async (...args: any[]) => {
          try {
            const result = await (prisma as any).$transaction(...args);
            if (prismaUnreachable) {
              console.info('[DB Connection] PostgreSQL connection re-established successfully.');
              prismaUnreachable = false;
            }
            return result;
          } catch (err: any) {
            if (isConnectionError(err) || isSchemaError(err)) {
              if (isConnectionError(err)) {
                prismaUnreachable = true;
                lastFailureTime = Date.now();
              }
              if (isProd) {
                throw new DatabasePersistenceError(`Database persistence unavailable: PostgreSQL error during transaction.`);
              }
              return memoryDb.$transaction(args[0]);
            }
            throw err;
          }
        };
      }

      const now = Date.now();
      const isProd = process.env.NODE_ENV === 'production';
      const isDbConfigured = shouldUsePrisma();
      const shouldAttemptPrisma =
        isDbConfigured &&
        (!prismaUnreachable || now - lastFailureTime > RETRY_INTERVAL_MS);

      const memoryModel = (memoryDb as any)[modelProp];

      if (!shouldAttemptPrisma) {
        return new Proxy(memoryModel || {}, {
          get(_memTarget, methodProp: string) {
            const memoryMethod = memoryModel ? memoryModel[methodProp] : undefined;
            if (isProd && WRITE_METHODS.has(methodProp)) {
              return async function () {
                const reason = !isDbConfigured
                  ? 'DATABASE_URL environment variable is missing or invalid in production'
                  : 'PostgreSQL database server is unreachable';
                throw new DatabasePersistenceError(`Database persistence unavailable: ${reason}. Write operation aborted to prevent silent data loss.`);
              };
            }
            return memoryMethod;
          },
        });
      }

      let prismaModel: any;
      try {
        prismaModel = (prisma as any)?.[modelProp];
      } catch (err: any) {
        if (isConnectionError(err) || String(err).includes('DATABASE_URL is not configured')) {
          if (!prismaUnreachable) {
            console.warn(`[DB Connection] Database server unreachable (${err.message || 'connection failed'}).`);
          }
          prismaUnreachable = true;
          lastFailureTime = Date.now();
          if (isProd) {
            return new Proxy(memoryModel || {}, {
              get(_memTarget, methodProp: string) {
                const memoryMethod = memoryModel ? memoryModel[methodProp] : undefined;
                if (WRITE_METHODS.has(methodProp)) {
                  return async function () {
                    throw new DatabasePersistenceError(`Database persistence unavailable: PostgreSQL connection failed (${err.message || 'unreachable'}). Write operation aborted to prevent silent data loss.`);
                  };
                }
                return memoryMethod;
              },
            });
          }
        }
        throw err;
      }

      if (!prismaModel) {
        return memoryModel;
      }

      return new Proxy(prismaModel, {
        get(_modelTarget, methodProp: string) {
          const prismaMethod = prismaModel[methodProp];
          const memoryMethod = memoryModel ? memoryModel[methodProp] : undefined;

          if (typeof prismaMethod !== 'function') {
            return memoryMethod ?? prismaMethod;
          }

          return async function (...args: any[]) {
            const currentNow = Date.now();
            const attempt =
              shouldUsePrisma() &&
              (!prismaUnreachable || currentNow - lastFailureTime > RETRY_INTERVAL_MS);

            if (!attempt) {
              if (isProd && WRITE_METHODS.has(methodProp)) {
                const reason = !isDbConfigured
                  ? 'DATABASE_URL environment variable is missing or invalid in production'
                  : 'PostgreSQL database server is unreachable';
                throw new DatabasePersistenceError(`Database persistence unavailable: ${reason}. Write operation aborted to prevent silent data loss.`);
              }
              if (typeof memoryMethod === 'function') {
                return memoryMethod.apply(memoryModel, args);
              }
              throw new Error(`Method ${modelProp}.${methodProp} not supported in fallback repository.`);
            }

            try {
              const result = await prismaMethod.apply(prismaModel, args);
              if (prismaUnreachable) {
                console.info('[DB Connection] PostgreSQL connection re-established successfully.');
                prismaUnreachable = false;
              }
              return result;
            } catch (err: any) {
              if (isConnectionError(err)) {
                if (!prismaUnreachable) {
                  console.warn(`[DB Connection] Database server unreachable (${err.message || 'connection failed'}).`);
                }
                prismaUnreachable = true;
                lastFailureTime = Date.now();

                if (isProd && WRITE_METHODS.has(methodProp)) {
                  throw new DatabasePersistenceError(`Database persistence unavailable: PostgreSQL connection failed (${err.message || 'unreachable'}). Write operation aborted to prevent silent data loss.`);
                }

                if (typeof memoryMethod === 'function') {
                  return memoryMethod.apply(memoryModel, args);
                }
              }

              if (isSchemaError(err)) {
                if (!prismaSchemaDrift) {
                  console.error(`[DB Schema Drift] PostgreSQL schema mismatch detected (code: ${err.code || 'unknown'}). Migration required: ${err.message || ''}.`);
                }
                prismaSchemaDrift = true;

                if (isProd && WRITE_METHODS.has(methodProp)) {
                  throw new DatabasePersistenceError(`Database persistence unavailable: PostgreSQL schema drift detected.`);
                }

                if (typeof memoryMethod === 'function') {
                  return memoryMethod.apply(memoryModel, args);
                }
              }

              throw err;
            }
          };
        },
      });
    },
  });
}

const resilientDb = createResilientDb();

/**
 * Returns the active database client:
 * Uses Prisma when PostgreSQL is reachable, and automatically falls back to the in-memory repository.
 */
export function getDb(): typeof memoryDb | typeof prisma {
  if (!shouldUsePrisma() && process.env.NODE_ENV !== 'production') {
    return memoryDb;
  }
  return resilientDb;
}

/**
 * Resets the in-memory database to default state (useful for test isolation).
 */
export function resetMemoryDb() {
  memoryStore.adminUsers.clear();
  memoryStore.adminUsers.set(DEFAULT_ADMIN.id, { ...DEFAULT_ADMIN });
  memoryStore.pages.clear();
  memoryStore.pageContents.clear();
  memoryStore.pageSeos.clear();
  memoryStore.toolContents.clear();
  memoryStore.toolSeos.clear();
  memoryStore.pageRevisions = [];
  memoryStore.toolRevisions = [];
  memoryStore.blogPosts.clear();
  memoryStore.blogCategories.clear();
  memoryStore.blogTags.clear();
  memoryStore.postTags.clear();
  memoryStore.postSeos.clear();
  memoryStore.postRevisions = [];
  memoryStore.mediaAssets.clear();
  memoryStore.auditLogs = [];
  memoryStore.navigationItems.clear();
  memoryStore.footerSettings.clear();
  memoryStore.formatContents.clear();
  prismaUnreachable = false;
  prismaSchemaDrift = false;
  lastFailureTime = 0;
  seedDefaultData();
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Calendar,
  Search,
  RefreshCw,
  Wrench,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Activity,
  History,
  Tag,
  ExternalLink,
  FileCode2,
  Globe2,
} from 'lucide-react';
import { AuditLogItem } from '@/lib/admin/types';

export type TimeFormatMode = 'dual' | 'utc' | 'local';

export interface ChangeItem {
  id: string;
  version: string;
  type: 'security' | 'feature' | 'fix' | 'performance';
  category: 'Security' | 'CMS & Features' | 'Responsive & UI' | 'Core Engines';
  title: string;
  text: string;
  date: string;
  timeUtc: string;
  timeLocal: string;
  isoTimestamp: string;
  affectedComponents: string[];
}

export interface ReleaseVersion {
  version: string;
  codename: string;
  date: string;
  timeUtc: string;
  timeLocal: string;
  isoTimestamp: string;
  status: 'Latest' | 'Stable' | 'LTS';
  category: 'Security' | 'CMS & Features' | 'Responsive & UI' | 'Core Engines';
  summary: string;
  badges: string[];
  highlights: ChangeItem[];
  affectedComponents: string[];
  docsLink?: string;
}

export const RECENT_UPDATES: ChangeItem[] = [
  // v2.4.0 Updates
  {
    id: 'upd-240-01',
    version: 'v2.4.0',
    type: 'security',
    category: 'Security',
    title: 'HTML5-Compliant Tokenizer & Solidus Bypass Elimination',
    text: 'Replaced regex parsing with a deterministic attribute tokenizer (parseAttributes) neutralizing solidus delimiters (<a/href=...>, <img/onerror=...>), mixed quotes, and unquoted vectors.',
    date: 'November 14, 2026',
    timeUtc: '18:05:59 UTC',
    timeLocal: '21:35:59 +03:30',
    isoTimestamp: '2026-11-14T18:05:59Z',
    affectedComponents: ['lib/admin/validation.ts', 'tests/admin/security-sec05.test.ts'],
  },
  {
    id: 'upd-240-02',
    version: 'v2.4.0',
    type: 'security',
    category: 'Security',
    title: 'Strict Base64 Raster Image Validation',
    text: 'Rigorously verifies raster MIME types (PNG, JPEG, WebP, GIF), validates Base64 length (% 4 !== 1) and valid base64 character sets, while strictly blocking SVG, HTML, and JS schemes.',
    date: 'November 14, 2026',
    timeUtc: '17:42:10 UTC',
    timeLocal: '21:12:10 +03:30',
    isoTimestamp: '2026-11-14T17:42:10Z',
    affectedComponents: ['lib/admin/validation.ts', 'tests/admin/security-sec05.test.ts'],
  },
  {
    id: 'upd-240-03',
    version: 'v2.4.0',
    type: 'security',
    category: 'Security',
    title: 'Open Redirect & Backslash Mitigation',
    text: 'Implemented recursive 5-pass URI decoding and WHATWG URL origin isolation against https://guard.convert24.internal/, blocking /\\evil.com and %255c protocol bypasses.',
    date: 'November 14, 2026',
    timeUtc: '16:58:23 UTC',
    timeLocal: '20:28:23 +03:30',
    isoTimestamp: '2026-11-14T16:58:23Z',
    affectedComponents: ['lib/admin/validation.ts', 'tests/admin/security-sec05.test.ts'],
  },
  {
    id: 'upd-240-04',
    version: 'v2.4.0',
    type: 'security',
    category: 'Security',
    title: 'Dual-Layer Server-Side Publication RBAC',
    text: 'Strictly asserts PUBLISH_CONTENT permissions at both API route boundaries and service methods prior to any database mutation, stopping unauthorized publishing and race conditions.',
    date: 'November 14, 2026',
    timeUtc: '15:30:00 UTC',
    timeLocal: '19:00:00 +03:30',
    isoTimestamp: '2026-11-14T15:30:00Z',
    affectedComponents: [
      'lib/admin/services/page.service.ts',
      'lib/admin/services/blog.service.ts',
      'app/api/admin/blog/[id]/publish/route.ts',
    ],
  },
  {
    id: 'upd-240-05',
    version: 'v2.4.0',
    type: 'security',
    category: 'Security',
    title: 'Two-Phase Tag Sanitization & CSS Rule Stripping',
    text: 'Recursively removes nested dangerous tags (<scr<script></script>ipt>) and strips unclosed CSS style expressions without semicolons.',
    date: 'November 14, 2026',
    timeUtc: '14:15:40 UTC',
    timeLocal: '17:45:40 +03:30',
    isoTimestamp: '2026-11-14T14:15:40Z',
    affectedComponents: ['lib/admin/validation.ts'],
  },
  {
    id: 'upd-240-06',
    version: 'v2.4.0',
    type: 'fix',
    category: 'Security',
    title: 'Safe Relative Image Path Resolution',
    text: 'Allowed relative image targets without leading slashes (e.g. safe.png, images/logo.png) provided they contain no colons or backslashes.',
    date: 'November 14, 2026',
    timeUtc: '13:20:15 UTC',
    timeLocal: '16:50:15 +03:30',
    isoTimestamp: '2026-11-14T13:20:15Z',
    affectedComponents: ['lib/admin/validation.ts'],
  },

  // v2.3.5 Updates
  {
    id: 'upd-235-01',
    version: 'v2.3.5',
    type: 'security',
    category: 'Security',
    title: 'Global HTTP Security Headers Enforcement',
    text: "Enforced Content Security Policy (default-src 'self'), X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN, and Referrer-Policy: strict-origin-when-cross-origin across all application routes.",
    date: 'November 13, 2026',
    timeUtc: '23:30:00 UTC',
    timeLocal: '03:00:00 +03:30',
    isoTimestamp: '2026-11-13T23:30:00Z',
    affectedComponents: ['next.config.ts', 'tests/security/sec01-sec02-remediation.test.ts'],
  },
  {
    id: 'upd-235-02',
    version: 'v2.3.5',
    type: 'security',
    category: 'Security',
    title: 'Self-Hosted PDF.js Worker Migration',
    text: 'Migrated from external unpkg.com CDN to local /vendor/pdfjs/pdf.worker.min.mjs verified by a SHA-256 integrity build script.',
    date: 'November 13, 2026',
    timeUtc: '22:15:00 UTC',
    timeLocal: '01:45:00 +03:30',
    isoTimestamp: '2026-11-13T22:15:00Z',
    affectedComponents: ['engines/pdf/loader.ts', 'scripts/copy-pdf-worker.cjs'],
  },
  {
    id: 'upd-235-03',
    version: 'v2.3.5',
    type: 'fix',
    category: 'Core Engines',
    title: 'Node.js 20 Iterator Polyfill',
    text: 'Polyfilled globalThis.Iterator to allow pdfjs-dist@6.3.289 to run reliably in server-side Next.js Node 20 environments without ReferenceErrors.',
    date: 'November 13, 2026',
    timeUtc: '20:45:00 UTC',
    timeLocal: '00:15:00 +03:30',
    isoTimestamp: '2026-11-13T20:45:00Z',
    affectedComponents: ['engines/pdf/loader.ts', 'engines/pdf/polyfills.ts'],
  },
  {
    id: 'upd-235-04',
    version: 'v2.3.5',
    type: 'performance',
    category: 'Core Engines',
    title: 'Zero External Requests Guarantee',
    text: 'PDF conversion operations now execute completely locally with zero outbound telemetry or unpkg.com network calls.',
    date: 'November 13, 2026',
    timeUtc: '19:10:00 UTC',
    timeLocal: '22:40:00 +03:30',
    isoTimestamp: '2026-11-13T19:10:00Z',
    affectedComponents: ['engines/pdf/loader.ts'],
  },

  // v2.3.0 Updates
  {
    id: 'upd-230-01',
    version: 'v2.3.0',
    type: 'fix',
    category: 'Responsive & UI',
    title: 'Global Header Tablet Layout Remediation',
    text: 'Resolved tablet breakpoint overflow at 768px-1023px by dynamically collapsing navigation items and preserving search and CTA access.',
    date: 'November 12, 2026',
    timeUtc: '14:15:00 UTC',
    timeLocal: '17:45:00 +03:30',
    isoTimestamp: '2026-11-12T14:15:00Z',
    affectedComponents: ['components/layout/Header.tsx'],
  },
  {
    id: 'upd-230-02',
    version: 'v2.3.0',
    type: 'fix',
    category: 'Responsive & UI',
    title: 'Blog Detail Breadcrumbs Truncation Constraint',
    text: 'Fixed flex shrinking and multi-level text truncation constraints on small mobile viewports (320px-430px).',
    date: 'November 12, 2026',
    timeUtc: '13:00:00 UTC',
    timeLocal: '16:30:00 +03:30',
    isoTimestamp: '2026-11-12T13:00:00Z',
    affectedComponents: ['components/blog/BlogBreadcrumbs.tsx'],
  },
  {
    id: 'upd-230-03',
    version: 'v2.3.0',
    type: 'fix',
    category: 'Responsive & UI',
    title: 'Homepage Hero Decorative Elements Containment',
    text: 'Fixed overflowing SVG background graphics on mobile viewports causing unintended horizontal scrollbars.',
    date: 'November 12, 2026',
    timeUtc: '11:30:00 UTC',
    timeLocal: '15:00:00 +03:30',
    isoTimestamp: '2026-11-12T11:30:00Z',
    affectedComponents: ['components/home/Hero.tsx'],
  },
  {
    id: 'upd-230-04',
    version: 'v2.3.0',
    type: 'feature',
    category: 'Responsive & UI',
    title: 'Public/Admin Layout Route Isolation',
    text: 'Header and Footer now suppress public navigation on /admin/* paths using usePathname().',
    date: 'November 12, 2026',
    timeUtc: '09:45:00 UTC',
    timeLocal: '13:15:00 +03:30',
    isoTimestamp: '2026-11-12T09:45:00Z',
    affectedComponents: ['components/layout/Header.tsx', 'components/layout/Footer.tsx'],
  },

  // v2.2.0 Updates
  {
    id: 'upd-220-01',
    version: 'v2.2.0',
    type: 'feature',
    category: 'CMS & Features',
    title: 'Custom HTML Block with Scoped CSS',
    text: 'Enables editors to paste custom HTML and CSS with deterministic scope prefixing (#custom-html-{id}) and zero hydration mismatches.',
    date: 'November 08, 2026',
    timeUtc: '19:45:00 UTC',
    timeLocal: '23:15:00 +03:30',
    isoTimestamp: '2026-11-08T19:45:00Z',
    affectedComponents: ['components/admin/CustomHtmlBlock.tsx'],
  },
  {
    id: 'upd-220-02',
    version: 'v2.2.0',
    type: 'feature',
    category: 'CMS & Features',
    title: 'Recursive Container Blocks Architecture',
    text: 'Support for nested multi-column layouts, flex containers, and custom paddings/alignments up to 3 nesting levels.',
    date: 'November 08, 2026',
    timeUtc: '17:20:00 UTC',
    timeLocal: '20:50:00 +03:30',
    isoTimestamp: '2026-11-08T17:20:00Z',
    affectedComponents: ['lib/cms/page-resolver.tsx'],
  },
  {
    id: 'upd-220-03',
    version: 'v2.2.0',
    type: 'feature',
    category: 'CMS & Features',
    title: 'Universal Inline Visual Editor',
    text: 'Live WYSIWYG editing directly on public-facing page routes with instant draft saving, sidebar drawers, and revision rollbacks.',
    date: 'November 08, 2026',
    timeUtc: '15:10:00 UTC',
    timeLocal: '18:40:00 +03:30',
    isoTimestamp: '2026-11-08T15:10:00Z',
    affectedComponents: ['components/admin/inline/*'],
  },
  {
    id: 'upd-220-04',
    version: 'v2.2.0',
    type: 'feature',
    category: 'CMS & Features',
    title: 'Header & Footer CMS Customizers',
    text: 'Direct administrative control over navigation links, social links, copyright notices, and CTA destinations.',
    date: 'November 08, 2026',
    timeUtc: '12:00:00 UTC',
    timeLocal: '15:30:00 +03:30',
    isoTimestamp: '2026-11-08T12:00:00Z',
    affectedComponents: ['app/admin/navigation/page.tsx'],
  },

  // v2.1.0 Updates
  {
    id: 'upd-210-01',
    version: 'v2.1.0',
    type: 'security',
    category: 'Security',
    title: '5-Tier Role-Based Access Control',
    text: 'Granular permissions matrix for SUPER_ADMIN, ADMIN, CONTENT_MANAGER, EDITOR, and VIEWER roles.',
    date: 'November 03, 2026',
    timeUtc: '11:20:00 UTC',
    timeLocal: '14:50:00 +03:30',
    isoTimestamp: '2026-11-03T11:20:00Z',
    affectedComponents: ['lib/admin/permissions.ts'],
  },
  {
    id: 'upd-210-02',
    version: 'v2.1.0',
    type: 'security',
    category: 'Security',
    title: 'Login Rate-Limiting & Lockout Protection',
    text: 'Automatically locks administrative accounts for 15 minutes after 5 consecutive failed login attempts.',
    date: 'November 03, 2026',
    timeUtc: '10:05:00 UTC',
    timeLocal: '13:35:00 +03:30',
    isoTimestamp: '2026-11-03T10:05:00Z',
    affectedComponents: ['lib/admin/services/user.service.ts'],
  },
  {
    id: 'upd-210-03',
    version: 'v2.1.0',
    type: 'security',
    category: 'Security',
    title: 'Single-Use Password Reset Tokens',
    text: 'Reset tokens hashed with SHA-256 and invalidated immediately upon first use or 60-minute expiration.',
    date: 'November 03, 2026',
    timeUtc: '08:45:00 UTC',
    timeLocal: '12:15:00 +03:30',
    isoTimestamp: '2026-11-03T08:45:00Z',
    affectedComponents: ['lib/admin/services/user.service.ts'],
  },
  {
    id: 'upd-210-04',
    version: 'v2.1.0',
    type: 'feature',
    category: 'CMS & Features',
    title: 'Administrative Audit Trail Architecture',
    text: 'Immutable logging of administrative actions, entity mutations, and authentication attempts.',
    date: 'November 03, 2026',
    timeUtc: '07:15:00 UTC',
    timeLocal: '10:45:00 +03:30',
    isoTimestamp: '2026-11-03T07:15:00Z',
    affectedComponents: ['lib/admin/services/audit.service.ts', 'app/admin/audit/page.tsx'],
  },

  // v2.0.0 Updates
  {
    id: 'upd-200-01',
    version: 'v2.0.0',
    type: 'feature',
    category: 'Core Engines',
    title: 'PDF Conversion & Manipulation Engine Suite',
    text: 'High-performance tools for PDF to JPG/PNG, Merge PDF, Split PDF, Compress PDF, Rotate PDF, Delete Pages, and Reorder Pages.',
    date: 'October 28, 2026',
    timeUtc: '09:00:00 UTC',
    timeLocal: '12:30:00 +03:30',
    isoTimestamp: '2026-10-28T09:00:00Z',
    affectedComponents: ['engines/pdf/*'],
  },
  {
    id: 'upd-200-02',
    version: 'v2.0.0',
    type: 'feature',
    category: 'Core Engines',
    title: 'Raster & Vector Image Engine Suite',
    text: 'Complete bidirectional conversion between JPG, PNG, WebP, GIF, BMP, and HEIC, with client-side cropping and resizing.',
    date: 'October 28, 2026',
    timeUtc: '08:30:00 UTC',
    timeLocal: '12:00:00 +03:30',
    isoTimestamp: '2026-10-28T08:30:00Z',
    affectedComponents: ['engines/image/*'],
  },
  {
    id: 'upd-200-03',
    version: 'v2.0.0',
    type: 'performance',
    category: 'Core Engines',
    title: 'Client-Side Privacy & Zero-Upload Guarantee',
    text: 'All document operations execute locally inside Web Workers; user files never touch external servers.',
    date: 'October 28, 2026',
    timeUtc: '07:00:00 UTC',
    timeLocal: '10:30:00 +03:30',
    isoTimestamp: '2026-10-28T07:00:00Z',
    affectedComponents: ['lib/tools.ts'],
  },
];

export const RELEASE_HISTORY: ReleaseVersion[] = [
  {
    version: 'v2.4.0',
    codename: 'SEC-04 & SEC-05: Comprehensive Security Hardening & Independent Verification',
    date: 'November 14, 2026',
    timeUtc: '18:05:59 UTC',
    timeLocal: '21:35:59 +03:30',
    isoTimestamp: '2026-11-14T18:05:59Z',
    status: 'Latest',
    category: 'Security',
    summary:
      'Completed independent security verification across the entire attack surface. Remediated HTML sanitizer solidus delimiter bypasses, hardened raster Base64 URL validation, eliminated backslash open redirects, and established dual-layer publication authorization boundaries.',
    badges: ['Security: 100% Verified', 'SEC-05 PASS', 'Dual-Layer RBAC'],
    highlights: RECENT_UPDATES.filter((u) => u.version === 'v2.4.0'),
    affectedComponents: [
      'lib/admin/validation.ts',
      'lib/admin/services/page.service.ts',
      'lib/admin/services/blog.service.ts',
      'app/api/admin/blog/[id]/publish/route.ts',
      'tests/admin/security-sec05.test.ts',
      'tests/e2e/sec05-sanitizer-browser.spec.ts',
    ],
    docsLink: '/SEC-05-FINAL-SECURITY-VERIFICATION-REPORT.md',
  },
  {
    version: 'v2.3.5',
    codename: 'SEC-01 & SEC-02: Global Security Headers & Self-Hosted Worker Migration',
    date: 'November 13, 2026',
    timeUtc: '23:30:00 UTC',
    timeLocal: '03:00:00 +03:30',
    isoTimestamp: '2026-11-13T23:30:00Z',
    status: 'Stable',
    category: 'Security',
    summary:
      'Eliminated external third-party CDN attack vectors by self-hosting the PDF.js worker, resolved Node 20 runtime iterator compatibility, and applied global HTTP security headers across all routes.',
    badges: ['CSP Hardening', 'Zero CDN Dependencies', 'Node 20 Polyfill'],
    highlights: RECENT_UPDATES.filter((u) => u.version === 'v2.3.5'),
    affectedComponents: [
      'next.config.ts',
      'engines/pdf/loader.ts',
      'scripts/copy-pdf-worker.cjs',
      'tests/security/sec01-sec02-remediation.test.ts',
      'tests/e2e/sec01-sec02-browser.spec.ts',
    ],
  },
  {
    version: 'v2.3.0',
    codename: 'RESP-01: Responsive Design Remediation & Header Navigation',
    date: 'November 12, 2026',
    timeUtc: '14:15:00 UTC',
    timeLocal: '17:45:00 +03:30',
    isoTimestamp: '2026-11-12T14:15:00Z',
    status: 'Stable',
    category: 'Responsive & UI',
    summary:
      'Remediated responsive defects across all 53 application routes and canonical viewports (320px to 1920px). Fixed header overflow at 768px-1023px, breadcrumb truncation, and suppressed public layout on admin routes.',
    badges: ['10 Canonical Viewports', 'Zero Horizontal Overflow', 'Mobile First'],
    highlights: RECENT_UPDATES.filter((u) => u.version === 'v2.3.0'),
    affectedComponents: [
      'components/layout/Header.tsx',
      'components/layout/Footer.tsx',
      'components/home/Hero.tsx',
      'components/blog/BlogBreadcrumbs.tsx',
    ],
  },
  {
    version: 'v2.2.0',
    codename: 'Phase 10-12: Advanced CMS Architecture & Universal Inline Editing',
    date: 'November 08, 2026',
    timeUtc: '19:45:00 UTC',
    timeLocal: '23:15:00 +03:30',
    isoTimestamp: '2026-11-08T19:45:00Z',
    status: 'Stable',
    category: 'CMS & Features',
    summary:
      'Introduced full universal visual editing across all CMS pages, blog articles, and tool landing pages. Added Custom HTML blocks with scoped CSS, Header/Footer navigation managers, and recursive container nesting.',
    badges: ['Universal Inline Editor', 'Scoped CSS', 'Block Architecture'],
    highlights: RECENT_UPDATES.filter((u) => u.version === 'v2.2.0'),
    affectedComponents: [
      'components/admin/inline/*',
      'components/admin/CustomHtmlBlock.tsx',
      'lib/cms/page-resolver.tsx',
      'app/admin/navigation/page.tsx',
    ],
  },
  {
    version: 'v2.1.0',
    codename: 'Phase 06A: User Management, RBAC & Security Hardening',
    date: 'November 03, 2026',
    timeUtc: '11:20:00 UTC',
    timeLocal: '14:50:00 +03:30',
    isoTimestamp: '2026-11-03T11:20:00Z',
    status: 'Stable',
    category: 'Security',
    summary:
      'Established granular 5-tier Role-Based Access Control, automated audit trails, account brute-force protection with temporary lockouts, and secure single-use password resets.',
    badges: ['5-Tier RBAC', 'Brute Force Lockout', 'Audit Logging'],
    highlights: RECENT_UPDATES.filter((u) => u.version === 'v2.1.0'),
    affectedComponents: [
      'lib/admin/permissions.ts',
      'lib/admin/services/user.service.ts',
      'lib/admin/services/audit.service.ts',
      'app/admin/users/page.tsx',
      'app/admin/audit/page.tsx',
    ],
  },
  {
    version: 'v2.0.0',
    codename: 'Phase 01: Core 25 Canonical Conversion Engines Foundation',
    date: 'October 28, 2026',
    timeUtc: '09:00:00 UTC',
    timeLocal: '12:30:00 +03:30',
    isoTimestamp: '2026-10-28T09:00:00Z',
    status: 'LTS',
    category: 'Core Engines',
    summary:
      'Launched the full suite of 25 client-side conversion tools covering PDF manipulation, image format switching, compression, merging, splitting, and rotating with zero server storage.',
    badges: ['25 Tools', '100% Client-Side', 'Zero Server Uploads'],
    highlights: RECENT_UPDATES.filter((u) => u.version === 'v2.0.0'),
    affectedComponents: [
      'lib/tools.ts',
      'engines/pdf/*',
      'engines/image/*',
      'components/tool/*',
    ],
  },
];

export function LatestUpdatesClient() {
  const [activeTab, setActiveTab] = useState<'timeline' | 'releases' | 'live-feed'>('timeline');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [timeMode, setTimeMode] = useState<TimeFormatMode>('dual');
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({
    'v2.4.0': true,
  });

  // Live Audit Stream State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const fetchLiveAudit = async () => {
    setIsLoadingAudit(true);
    setAuditError(null);
    try {
      const res = await fetch('/api/admin/audit?limit=20');
      if (!res.ok) {
        throw new Error(`Failed to load live audit logs (HTTP ${res.status})`);
      }
      const data = await res.json();
      setAuditLogs(data.logs || []);
    } catch (err: unknown) {
      setAuditError(err instanceof Error ? err.message : 'Failed to retrieve operational logs');
    } finally {
      setIsLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'live-feed' && auditLogs.length === 0) {
      fetchLiveAudit();
    }
  }, [activeTab, auditLogs.length]);

  const toggleVersion = (version: string) => {
    setExpandedVersions((prev) => ({
      ...prev,
      [version]: !prev[version],
    }));
  };

  const formatTime = (timeUtc: string, timeLocal: string) => {
    if (timeMode === 'utc') return timeUtc;
    if (timeMode === 'local') return timeLocal;
    return `${timeUtc} (${timeLocal})`;
  };

  // Filtered timeline updates
  const filteredTimelineUpdates = useMemo(() => {
    return RECENT_UPDATES.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        item.version.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.text.toLowerCase().includes(q) ||
        item.date.toLowerCase().includes(q) ||
        item.timeUtc.toLowerCase().includes(q) ||
        item.timeLocal.toLowerCase().includes(q) ||
        item.affectedComponents.some((c) => c.toLowerCase().includes(q));

      return matchesCategory && matchesQuery;
    });
  }, [selectedCategory, searchQuery]);

  // Filtered grouped releases
  const filteredReleases = useMemo(() => {
    return RELEASE_HISTORY.filter((release) => {
      const matchesCategory =
        selectedCategory === 'All' || release.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        release.version.toLowerCase().includes(q) ||
        release.codename.toLowerCase().includes(q) ||
        release.summary.toLowerCase().includes(q) ||
        release.date.toLowerCase().includes(q) ||
        release.timeUtc.toLowerCase().includes(q) ||
        release.timeLocal.toLowerCase().includes(q) ||
        release.badges.some((b) => b.toLowerCase().includes(q)) ||
        release.highlights.some((h) => h.text.toLowerCase().includes(q) || h.title.toLowerCase().includes(q));

      return matchesCategory && matchesQuery;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#7C3AED]/10 text-[#7C3AED] border border-[#7C3AED]/20">
              <Sparkles className="w-3 h-3" />
              <span>Latest Updates & Update Changes</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Production Stable v2.4.0</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              <Clock className="w-3 h-3 text-purple-600" />
              <span>Updated Nov 14, 2026 at 18:05:59 UTC</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F112E]">
            Latest Updates
          </h1>
          <p className="text-xs sm:text-sm text-[#5E6488] mt-0.5">
            All recent platform updates, security remediations, and releases displayed with their exact date and time.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {activeTab === 'live-feed' && (
            <button
              onClick={fetchLiveAudit}
              disabled={isLoadingAudit}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#475467] bg-white border border-[#E4E2F0] rounded-lg hover:bg-[#F4F3FA] transition-colors disabled:opacity-50 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAudit ? 'animate-spin text-[#7C3AED]' : ''}`} />
              <span>Refresh Feed</span>
            </button>
          )}

          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#7C3AED] to-[#6366F1] rounded-lg hover:opacity-95 shadow-xs transition-opacity"
          >
            <span>Admin Overview</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Metric Overview Cards with Date & Time Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="p-4 bg-white rounded-xl border border-[#E4E2F0] shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-[#7C3AED]" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[#5E6488] uppercase tracking-wider">Current Version</div>
            <div className="text-lg font-bold text-[#0F112E] truncate">v2.4.0 (Latest)</div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="p-4 bg-white rounded-xl border border-[#E4E2F0] shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[#5E6488] uppercase tracking-wider">Security Status</div>
            <div className="text-lg font-bold text-[#0F112E] truncate">SEC-05 Passed</div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="p-4 bg-white rounded-xl border border-[#E4E2F0] shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[#5E6488] uppercase tracking-wider">Active Engines</div>
            <div className="text-lg font-bold text-[#0F112E] truncate">25 Tools Online</div>
          </div>
        </div>

        {/* Card 4: Date & Time Highlight */}
        <div className="p-4 bg-white rounded-xl border border-[#E4E2F0] shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[#5E6488] uppercase tracking-wider">Last Release Date & Time</div>
            <div className="text-xs font-bold text-[#0F112E] truncate">Nov 14, 2026 • 18:05:59 UTC</div>
            <div className="text-[10px] text-[#5E6488]">Local: 21:35:59 (+03:30)</div>
          </div>
        </div>
      </div>

      {/* Main Tabs, Filters & Timezone Preference */}
      <div className="bg-white rounded-xl border border-[#E4E2F0] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E4E2F0] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Main View Tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-[#F4F3FA] p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'timeline'
                  ? 'bg-white text-[#0F112E] shadow-xs'
                  : 'text-[#5E6488] hover:text-[#0F112E]'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span>All Recent Updates ({RECENT_UPDATES.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('releases')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'releases'
                  ? 'bg-white text-[#0F112E] shadow-xs'
                  : 'text-[#5E6488] hover:text-[#0F112E]'
              }`}
            >
              <Tag className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span>Release Changelog ({RELEASE_HISTORY.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('live-feed')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'live-feed'
                  ? 'bg-white text-[#0F112E] shadow-xs'
                  : 'text-[#5E6488] hover:text-[#0F112E]'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span>Live System Feed</span>
            </button>
          </div>

          {/* Timezone Preference Switcher */}
          <div className="flex items-center gap-1.5 bg-[#F4F3FA] p-1 rounded-lg self-start lg:self-auto">
            <span className="text-[11px] font-semibold text-[#5E6488] px-2 flex items-center gap-1">
              <Globe2 className="w-3 h-3 text-[#7C3AED]" />
              <span className="hidden sm:inline">Time Display:</span>
            </span>
            <button
              onClick={() => setTimeMode('dual')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                timeMode === 'dual'
                  ? 'bg-white text-[#0F112E] shadow-2xs font-bold'
                  : 'text-[#5E6488] hover:text-[#0F112E]'
              }`}
            >
              Dual (UTC + Local)
            </button>
            <button
              onClick={() => setTimeMode('utc')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                timeMode === 'utc'
                  ? 'bg-white text-[#0F112E] shadow-2xs font-bold'
                  : 'text-[#5E6488] hover:text-[#0F112E]'
              }`}
            >
              UTC
            </button>
            <button
              onClick={() => setTimeMode('local')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                timeMode === 'local'
                  ? 'bg-white text-[#0F112E] shadow-2xs font-bold'
                  : 'text-[#5E6488] hover:text-[#0F112E]'
              }`}
            >
              Local (+03:30)
            </button>
          </div>
        </div>

        {/* Secondary Filters: Categories & Real-time Search */}
        {(activeTab === 'timeline' || activeTab === 'releases') && (
          <div className="p-4 bg-[#FAF9FF]/60 border-b border-[#E4E2F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {['All', 'Security', 'CMS & Features', 'Responsive & UI', 'Core Engines'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#7C3AED] text-white font-semibold shadow-2xs'
                      : 'bg-white text-[#5E6488] border border-[#E4E2F0] hover:bg-[#F4F3FA]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Keyword Search */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-[#8C92B2] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search updates by date, time, title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E4E2F0] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#7C3AED]"
              />
            </div>
          </div>
        )}

        {/* Tab 1: All Recent Updates (Chronological Timeline View) */}
        {activeTab === 'timeline' && (
          <div className="divide-y divide-[#E4E2F0]">
            {filteredTimelineUpdates.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#5E6488]">
                <Search className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-sm text-[#0F112E]">No updates matched your search</p>
                <p className="mt-1">Try resetting the category filter or searching for a different keyword or date.</p>
              </div>
            ) : (
              filteredTimelineUpdates.map((item) => (
                <div
                  key={item.id}
                  className="p-5 sm:p-6 hover:bg-[#FAF9FF]/40 transition-colors space-y-2.5"
                >
                  {/* Item Header with Date and Time Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Version Pill */}
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#7C3AED]/10 text-[#7C3AED] border border-[#7C3AED]/20">
                        {item.version}
                      </span>

                      {/* Type Badge */}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.type === 'security'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : item.type === 'fix'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : item.type === 'performance'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {item.type}
                      </span>

                      {/* Category */}
                      <span className="text-xs text-[#5E6488] font-medium bg-[#F4F3FA] px-2 py-0.5 rounded border border-[#E4E2F0]">
                        {item.category}
                      </span>
                    </div>

                    {/* Date and Time Badge - Prominently Displayed */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-[#F4F0FD] text-[#7C3AED] border border-[#7C3AED]/20 self-start sm:self-auto">
                      <Calendar className="w-3.5 h-3.5 text-[#7C3AED]" />
                      <span>{item.date}</span>
                      <span className="text-[#8C92B2]">•</span>
                      <Clock className="w-3.5 h-3.5 text-[#7C3AED]" />
                      <span className="font-bold">
                        {formatTime(item.timeUtc, item.timeLocal)}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-[#0F112E]">
                      {item.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#475467] mt-1 leading-relaxed max-w-4xl">
                      {item.text}
                    </p>
                  </div>

                  {/* Affected Components */}
                  {item.affectedComponents.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] uppercase font-bold text-[#8C92B2] flex items-center gap-1">
                        <FileCode2 className="w-3 h-3" />
                        <span>Components:</span>
                      </span>
                      {item.affectedComponents.map((comp, cIdx) => (
                        <span
                          key={cIdx}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#F4F3FA] text-[#333860] border border-[#E4E2F0]"
                        >
                          {comp}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Grouped Release Changelog */}
        {activeTab === 'releases' && (
          <div className="divide-y divide-[#E4E2F0]">
            {filteredReleases.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#5E6488]">
                <Search className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-sm text-[#0F112E]">No releases matched your search</p>
                <p className="mt-1">Try resetting the category filter or searching for a different keyword or date.</p>
              </div>
            ) : (
              filteredReleases.map((release) => {
                const isExpanded = Boolean(expandedVersions[release.version]);
                return (
                  <div key={release.version} className="p-5 sm:p-6 hover:bg-[#FAF9FF]/40 transition-colors">
                    {/* Release Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-base sm:text-lg font-bold text-[#0F112E] tracking-tight">
                            {release.version}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              release.status === 'Latest'
                                ? 'bg-purple-100 text-[#7C3AED]'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {release.status}
                          </span>

                          {/* Release Date and Time Badge */}
                          <span className="text-xs font-mono font-medium text-[#7C3AED] bg-[#F4F0FD] px-2.5 py-1 rounded-md border border-[#7C3AED]/20 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#7C3AED]" />
                            <span>{release.date}</span>
                            <span className="text-[#8C92B2]">•</span>
                            <Clock className="w-3.5 h-3.5 text-[#7C3AED]" />
                            <span className="font-bold">
                              {formatTime(release.timeUtc, release.timeLocal)}
                            </span>
                          </span>

                          <span className="text-xs text-[#5E6488] font-semibold bg-[#F4F3FA] px-2 py-0.5 rounded border border-[#E4E2F0]">
                            {release.category}
                          </span>
                        </div>

                        <h2 className="text-sm sm:text-base font-semibold text-[#1F2248]">
                          {release.codename}
                        </h2>
                        <p className="text-xs sm:text-sm text-[#5E6488] mt-1 leading-relaxed max-w-4xl">
                          {release.summary}
                        </p>
                      </div>

                      <button
                        onClick={() => toggleVersion(release.version)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#7C3AED] hover:underline self-start shrink-0"
                      >
                        <span>{isExpanded ? 'Collapse Details' : 'View Full Changes'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Badges list */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      {release.badges.map((badge, bIdx) => (
                        <span
                          key={bIdx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F4F3FA] text-[#475467] border border-[#E4E2F0]"
                        >
                          <Tag className="w-2.5 h-2.5 text-[#7C3AED]" />
                          <span>{badge}</span>
                        </span>
                      ))}
                    </div>

                    {/* Expanded Detailed Highlights */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-[#F0EEFA] space-y-4 animate-fadeIn">
                        <div>
                          <div className="text-xs font-bold text-[#0F112E] uppercase tracking-wider mb-2.5 flex items-center justify-between">
                            <span>Key Changes & Updates</span>
                            <span className="text-[11px] font-normal text-[#5E6488]">
                              {release.highlights.length} updates logged with date & time
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            {release.highlights.map((item, hIdx) => (
                              <div
                                key={hIdx}
                                className="p-3 bg-white rounded-lg border border-[#E4E2F0] hover:border-[#7C3AED]/30 transition-colors shadow-2xs space-y-1.5"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                                        item.type === 'security'
                                          ? 'bg-red-50 text-red-700 border border-red-200'
                                          : item.type === 'fix'
                                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                          : item.type === 'performance'
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      }`}
                                    >
                                      {item.type}
                                    </span>
                                    <span className="text-xs font-bold text-[#0F112E]">
                                      {item.title}
                                    </span>
                                  </div>

                                  {/* Update Item Date & Time */}
                                  <span className="text-[11px] font-mono text-[#5E6488] flex items-center gap-1.5 bg-[#F4F3FA] px-2 py-0.5 rounded border border-[#E4E2F0] self-start sm:self-auto">
                                    <Calendar className="w-3 h-3 text-[#7C3AED]" />
                                    <span>{item.date}</span>
                                    <span className="text-slate-300">•</span>
                                    <Clock className="w-3 h-3 text-[#7C3AED]" />
                                    <span className="font-semibold text-[#0F112E]">
                                      {formatTime(item.timeUtc, item.timeLocal)}
                                    </span>
                                  </span>
                                </div>

                                <p className="text-xs text-[#333860] leading-relaxed">
                                  {item.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Affected Components */}
                        <div>
                          <div className="text-[11px] font-bold text-[#5E6488] uppercase tracking-wider mb-1.5">
                            Affected Components & Modules
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {release.affectedComponents.map((comp, cIdx) => (
                              <span
                                key={cIdx}
                                className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#F4F3FA] text-[#333860] border border-[#E4E2F0]"
                              >
                                {comp}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Verification Report Link */}
                        {release.docsLink && (
                          <div className="pt-2">
                            <span className="text-xs font-semibold text-[#7C3AED] inline-flex items-center gap-1">
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Independent verification report available: {release.docsLink}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 3: Live System & Operational Feed */}
        {activeTab === 'live-feed' && (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#0F112E] flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span>Real-Time Administrative Activity Stream</span>
                </h2>
                <p className="text-xs text-[#5E6488] mt-0.5">
                  Recent content edits, publication status updates, and administrative events from database audit records with timestamp logging.
                </p>
              </div>

              <Link
                href="/admin/audit"
                className="text-xs font-semibold text-[#7C3AED] hover:underline flex items-center gap-1"
              >
                <span>Full Audit Explorer</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            {isLoadingAudit ? (
              <div className="py-16 text-center text-xs text-[#5E6488]">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#7C3AED]" />
                <span>Streaming live updates with date & time...</span>
              </div>
            ) : auditError ? (
              <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs">
                {auditError}
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#5E6488]">
                <History className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-sm text-[#0F112E]">No recent activity logged yet</p>
                <p className="mt-1">Administrative actions such as saving drafts or publishing pages will stream here live with date and time.</p>
              </div>
            ) : (
              <div className="border border-[#E4E2F0] rounded-lg divide-y divide-[#E4E2F0] overflow-hidden">
                {auditLogs.map((log) => {
                  const logDate = new Date(log.createdAt);
                  const formattedDate = logDate.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });
                  const formattedTime = logDate.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <div
                      key={log.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#FAF9FF] transition-colors text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <div>
                          <div className="font-semibold text-[#0F112E]">
                            {log.action.replace(/_/g, ' ')}
                          </div>
                          <div className="text-[11px] text-[#5E6488]">
                            Target: <span className="font-mono text-[#0F112E]">{log.entityType}</span>{' '}
                            {log.entityId ? `(#${log.entityId.slice(0, 8)})` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] text-[#8C92B2] shrink-0 sm:text-right space-y-0.5">
                        <div className="font-medium text-[#475467]">
                          {log.userName || log.userEmail || 'System'}
                        </div>
                        <div className="inline-flex items-center gap-1.5 font-mono text-[#7C3AED] bg-[#F4F0FD] px-2 py-0.5 rounded border border-[#7C3AED]/20">
                          <Calendar className="w-3 h-3 text-[#7C3AED]" />
                          <span>{formattedDate}</span>
                          <span className="text-[#8C92B2]">•</span>
                          <Clock className="w-3 h-3 text-[#7C3AED]" />
                          <span className="font-bold">{formattedTime}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default LatestUpdatesClient;

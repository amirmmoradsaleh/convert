import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import {
  UpdateSettingsInput,
  SiteSettingsData,
  HeaderNavItem,
  FooterGroupItem,
  AdminUserSession,
  DEFAULT_HEADER_NAV,
  DEFAULT_FOOTER_GROUPS,
} from '../types';
import { validateSettingsPayload } from '../validation';
import { createAuditLog } from './audit.service';

export { DEFAULT_HEADER_NAV, DEFAULT_FOOTER_GROUPS };

export const DEFAULT_SETTINGS: SiteSettingsData = {
  id: 'default',
  siteName: 'Convert24',
  siteUrl: 'https://convert24.local',
  siteLogo: '',
  headerTagline: 'Fast, Free & Private Online File Tools',
  headerCtaLabel: 'Explore All',
  headerCtaLink: '/#explore-hubs',
  headerCtaVisible: true,
  headerNav: DEFAULT_HEADER_NAV,
  footerDescription:
    'Fast, privacy-focused image and PDF utility tools. Process files safely in your browser without registration, subscriptions, or remote cloud uploads.',
  copyrightText: '© {year} Convert24. Free online file utility service. All rights reserved.',
  trustText: 'Client-side processing • 100% Free • No registration',
  footerGroups: DEFAULT_FOOTER_GROUPS,
  socialLinks: {},
  defaultSeoTitle: 'Convert24 – Free Online File Tools',
  defaultMetaDescription:
    'Fast, secure, 100% free image and PDF conversion utilities entirely in your browser.',
  defaultOgImage: '/images/og-image.png',
  defaultTwitterImage: '/images/og-image.png',
  googleAnalyticsId: null,
  googleAdSenseId: null,
};

export async function getGlobalSettings(): Promise<SiteSettingsData> {
  const db = getDb();

  let rawSettings: any = null;
  try {
    rawSettings = await db.globalSettings.findUnique({
      where: { id: 'default' },
    });
  } catch (err) {
    console.warn('[Settings Service] Could not fetch globalSettings from database, using defaults:', err);
  }

  // Extract structured header & footer metadata stored in socialLinks JSONB
  const rawSocial = (rawSettings?.socialLinks || {}) as Record<string, any>;
  const storedHeader = rawSocial.__header || {};
  const storedFooter = rawSocial.__footer || {};

  // Extract pure social links without internal storage keys
  const pureSocialLinks: Record<string, string> = {};
  for (const [key, val] of Object.entries(rawSocial)) {
    if (!key.startsWith('__') && typeof val === 'string') {
      pureSocialLinks[key] = val;
    }
  }

  // Try fetching navigation items from navigationItem table if available
  let headerNav: HeaderNavItem[] = storedHeader.headerNav || DEFAULT_HEADER_NAV;
  try {
    if (db.navigationItem?.findMany) {
      const dbNavs = await db.navigationItem.findMany({
        where: { menu: 'header' },
        orderBy: { order: 'asc' },
      });
      if (dbNavs && dbNavs.length > 0) {
        headerNav = dbNavs.map((n: any) => ({
          id: n.id,
          label: n.label,
          href: n.destination,
          order: n.order,
          visible: n.visible,
          openNewTab: n.openNewTab,
          isExternal: n.isExternal,
        }));
      }
    }
  } catch {
    // Graceful fallback to storedHeader / default
  }

  // Try fetching footer settings from footerSettings table if available
  let footerDescription = storedFooter.brandDescription || DEFAULT_SETTINGS.footerDescription;
  let copyrightText = storedFooter.copyrightText || DEFAULT_SETTINGS.copyrightText;
  let trustText = storedFooter.trustText || DEFAULT_SETTINGS.trustText;
  let footerGroups: FooterGroupItem[] = storedFooter.groups || DEFAULT_FOOTER_GROUPS;

  try {
    if (db.footerSettings?.findUnique) {
      const dbFooter = await db.footerSettings.findUnique({ where: { id: 'default' } });
      if (dbFooter) {
        if (dbFooter.brandDescription) footerDescription = dbFooter.brandDescription;
        if (dbFooter.copyrightText) copyrightText = dbFooter.copyrightText;
        if (dbFooter.trustText) trustText = dbFooter.trustText;
        if (Array.isArray(dbFooter.linksJson) && dbFooter.linksJson.length > 0) {
          footerGroups = dbFooter.linksJson;
        }
      }
    }
  } catch {
    // Graceful fallback
  }

  return {
    id: 'default',
    siteName: rawSettings?.siteName || DEFAULT_SETTINGS.siteName,
    siteUrl: rawSettings?.siteUrl || DEFAULT_SETTINGS.siteUrl,
    siteLogo: storedHeader.siteLogo !== undefined ? storedHeader.siteLogo : DEFAULT_SETTINGS.siteLogo,
    headerTagline:
      storedHeader.headerTagline !== undefined ? storedHeader.headerTagline : DEFAULT_SETTINGS.headerTagline,
    headerCtaLabel:
      storedHeader.headerCtaLabel !== undefined ? storedHeader.headerCtaLabel : DEFAULT_SETTINGS.headerCtaLabel,
    headerCtaLink:
      storedHeader.headerCtaLink !== undefined ? storedHeader.headerCtaLink : DEFAULT_SETTINGS.headerCtaLink,
    headerCtaVisible:
      storedHeader.headerCtaVisible !== undefined ? storedHeader.headerCtaVisible : DEFAULT_SETTINGS.headerCtaVisible,
    headerNav,
    footerDescription,
    copyrightText,
    trustText,
    footerGroups,
    socialLinks: pureSocialLinks,
    defaultSeoTitle: rawSettings?.defaultSeoTitle ?? DEFAULT_SETTINGS.defaultSeoTitle,
    defaultMetaDescription: rawSettings?.defaultMetaDescription ?? DEFAULT_SETTINGS.defaultMetaDescription,
    defaultOgImage: rawSettings?.defaultOgImage ?? DEFAULT_SETTINGS.defaultOgImage,
    defaultTwitterImage: rawSettings?.defaultTwitterImage ?? DEFAULT_SETTINGS.defaultTwitterImage,
    googleAnalyticsId: rawSettings?.googleAnalyticsId ?? null,
    googleAdSenseId: rawSettings?.googleAdSenseId ?? null,
    updatedAt: rawSettings?.updatedAt || new Date(),
  };
}

export async function getPublicSiteSettings(): Promise<SiteSettingsData> {
  return getGlobalSettings();
}

export async function updateGlobalSettings(
  input: UpdateSettingsInput,
  author: AdminUserSession
): Promise<SiteSettingsData> {
  const validation = validateSettingsPayload(input);
  if (!validation.isValid) {
    const errorDetails = validation.report.errors.map((e) => `${e.field}: ${e.message}`).join(', ');
    throw new Error(`Validation failed: ${errorDetails}`);
  }

  const sanitized = validation.sanitized;
  const existing = await getGlobalSettings();

  // Merge existing settings to safely preserve partial updates
  const siteName = sanitized.siteName !== undefined ? sanitized.siteName : existing.siteName;
  const siteUrl = sanitized.siteUrl !== undefined ? sanitized.siteUrl : existing.siteUrl;
  const siteLogo = sanitized.siteLogo !== undefined ? sanitized.siteLogo : existing.siteLogo;
  const headerTagline = sanitized.headerTagline !== undefined ? sanitized.headerTagline : existing.headerTagline;
  const headerCtaLabel = sanitized.headerCtaLabel !== undefined ? sanitized.headerCtaLabel : existing.headerCtaLabel;
  const headerCtaLink = sanitized.headerCtaLink !== undefined ? sanitized.headerCtaLink : existing.headerCtaLink;
  const headerCtaVisible =
    sanitized.headerCtaVisible !== undefined ? sanitized.headerCtaVisible : existing.headerCtaVisible;
  const headerNav = sanitized.headerNav !== undefined ? sanitized.headerNav : existing.headerNav;

  const footerDescription =
    sanitized.footerDescription !== undefined ? sanitized.footerDescription : existing.footerDescription;
  const copyrightText = sanitized.copyrightText !== undefined ? sanitized.copyrightText : existing.copyrightText;
  const trustText = sanitized.trustText !== undefined ? sanitized.trustText : existing.trustText;
  const footerGroups = sanitized.footerGroups !== undefined ? sanitized.footerGroups : existing.footerGroups;

  const socialLinks =
    sanitized.socialLinks !== undefined ? sanitized.socialLinks : existing.socialLinks || {};

  const defaultSeoTitle =
    sanitized.defaultSeoTitle !== undefined ? sanitized.defaultSeoTitle : existing.defaultSeoTitle;
  const defaultMetaDescription =
    sanitized.defaultMetaDescription !== undefined
      ? sanitized.defaultMetaDescription
      : existing.defaultMetaDescription;
  const defaultOgImage =
    sanitized.defaultOgImage !== undefined ? sanitized.defaultOgImage : existing.defaultOgImage;
  const defaultTwitterImage =
    sanitized.defaultTwitterImage !== undefined ? sanitized.defaultTwitterImage : existing.defaultTwitterImage;
  const googleAnalyticsId =
    sanitized.googleAnalyticsId !== undefined ? sanitized.googleAnalyticsId : existing.googleAnalyticsId;
  const googleAdSenseId =
    sanitized.googleAdSenseId !== undefined ? sanitized.googleAdSenseId : existing.googleAdSenseId;

  // Bundle header & footer metadata into socialLinks JSONB for universal persistence
  const socialLinksData: Record<string, any> = {
    ...socialLinks,
    __header: {
      siteLogo,
      headerTagline,
      headerCtaLabel,
      headerCtaLink,
      headerCtaVisible,
      headerNav,
    },
    __footer: {
      brandDescription: footerDescription,
      copyrightText,
      trustText,
      groups: footerGroups,
    },
  };

  const db = getDb();

  // Persist to globalSettings table
  await db.globalSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      siteName: siteName || DEFAULT_SETTINGS.siteName,
      siteUrl: siteUrl || DEFAULT_SETTINGS.siteUrl,
      defaultSeoTitle,
      defaultMetaDescription,
      defaultOgImage,
      defaultTwitterImage,
      googleAnalyticsId,
      googleAdSenseId,
      socialLinks: socialLinksData as any,
    },
    update: {
      siteName,
      siteUrl,
      defaultSeoTitle,
      defaultMetaDescription,
      defaultOgImage,
      defaultTwitterImage,
      googleAnalyticsId,
      googleAdSenseId,
      socialLinks: socialLinksData as any,
    },
  });

  // Gracefully synchronize footerSettings table if supported
  try {
    if (db.footerSettings?.upsert) {
      await db.footerSettings.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          brandDescription: footerDescription || DEFAULT_SETTINGS.footerDescription,
          copyrightText: copyrightText || DEFAULT_SETTINGS.copyrightText,
          trustText: trustText || DEFAULT_SETTINGS.trustText,
          linksJson: footerGroups as any,
        },
        update: {
          brandDescription: footerDescription,
          copyrightText,
          trustText,
          linksJson: footerGroups as any,
        },
      });
    }
  } catch (err) {
    console.warn('[Settings Service] footerSettings sync skipped:', err);
  }

  // Gracefully synchronize navigationItem table if supported
  try {
    if (sanitized.headerNav && db.navigationItem?.findMany && db.navigationItem?.create && db.navigationItem?.delete) {
      const existingNavs = await db.navigationItem.findMany({ where: { menu: 'header' } });
      for (const nav of existingNavs) {
        await db.navigationItem.delete({ where: { id: nav.id } });
      }
      for (let idx = 0; idx < sanitized.headerNav.length; idx++) {
        const item = sanitized.headerNav[idx];
        await db.navigationItem.create({
          data: {
            menu: 'header',
            label: item.label,
            destination: item.href,
            order: typeof item.order === 'number' ? item.order : idx,
            visible: item.visible !== false,
            openNewTab: Boolean(item.openNewTab),
            isExternal: Boolean(item.isExternal || item.openNewTab),
          },
        });
      }
    }
  } catch (err) {
    console.warn('[Settings Service] navigationItem sync skipped:', err);
  }

  await createAuditLog({
    userId: author.id,
    action: 'UPDATE_SETTINGS',
    entityType: 'SETTINGS',
    entityId: 'default',
    metadata: {
      siteName,
      siteUrl,
      hasHeaderNavUpdate: sanitized.headerNav !== undefined,
      hasFooterUpdate: sanitized.footerGroups !== undefined || sanitized.footerDescription !== undefined,
    },
  });

  // Invalidate Next.js layout cache so public pages render the new header/footer immediately
  try {
    revalidatePath('/', 'layout');
  } catch {
    // Safe no-op outside Next.js request context (e.g. CLI or unit test)
  }

  return getGlobalSettings();
}

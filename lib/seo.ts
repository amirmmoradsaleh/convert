import type { Metadata } from 'next';

function getValidSiteUrl(rawUrl?: string): string {
  if (!rawUrl) return 'https://example.com';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  return `https://${rawUrl}`;
}

const resolvedSiteUrl = getValidSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export const siteConfig = {
  name: 'Free Online File Tools',
  shortName: 'FileTools',
  description: 'Convert, compress and manage your files quickly and easily. Free online image and PDF utility website with client-side processing.',
  url: resolvedSiteUrl,
  ogImage: '/images/og-image.png',
};

export const defaultMetadata: Metadata = {
  metadataBase: new URL(resolvedSiteUrl),
  title: {
    default: `${siteConfig.name} – Convert, Compress & Edit Files Free`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    'file converter',
    'image converter',
    'pdf converter',
    'jpg to png',
    'png to jpg',
    'compress image',
    'merge pdf',
    'split pdf',
    'free online tools',
    'client-side conversion',
  ],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.name,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export function createWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteConfig.url}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function createWebApplicationSchema(toolName: string, toolDescription: string, toolUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: toolName,
    url: toolUrl,
    description: toolDescription,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'All',
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };
}

export function createBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function createArticleSchema(title: string, description: string, url: string, datePublished: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description,
    url: url,
    datePublished: datePublished,
    author: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: siteConfig.url,
    },
    publisher: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: siteConfig.url,
    },
  };
}

export function createFAQSchema(faqList: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqList.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function createHowToSchema(name: string, description: string, steps: { title: string; description: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    step: steps.map((s, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: s.title,
      text: s.description,
    })),
  };
}

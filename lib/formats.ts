export interface FormatDefinition {
  slug: string;
  name: string;
  extension: string;
  mimeTypes: string[];
  category: 'image' | 'document';
  title: string;
  description: string;
  details: string;
  pros: string[];
  cons: string[];
  bestFor: string;
  compatibleTools: string[];
}

export const FORMATS: FormatDefinition[] = [
  {
    slug: 'jpg',
    name: 'JPG / JPEG',
    extension: '.jpg, .jpeg',
    mimeTypes: ['image/jpeg', 'image/jpg'],
    category: 'image',
    title: 'JPG File Format – Guide & Free Online Conversion Tools',
    description: 'Learn about the JPG/JPEG format, its strengths, limitations, and how to convert JPG to PNG, WEBP, or PDF online for free.',
    details: 'JPG (Joint Photographic Experts Group) is the most widely recognized and compatible image format in computing. It utilizes lossy compression algorithms specifically engineered for photographic content, discarding fine color variations invisible to the human eye to achieve remarkable compression ratios.',
    pros: ['Universally compatible across all devices and platforms', 'Small file sizes ideal for web and email', 'Standard camera capture output'],
    cons: ['Lossy compression causes generational quality loss upon repeated saves', 'No transparency (alpha channel) support', 'Artifacts around sharp lines and text'],
    bestFor: 'Digital photography, complex real-world imagery, and social media sharing.',
    compatibleTools: ['jpg-to-png', 'jpg-to-webp', 'jpg-to-pdf', 'compress-image', 'resize-image', 'crop-image', 'rotate-image'],
  },
  {
    slug: 'png',
    name: 'PNG',
    extension: '.png',
    mimeTypes: ['image/png'],
    category: 'image',
    title: 'PNG File Format – Lossless Transparent Images & Tools',
    description: 'Understand PNG image capabilities, alpha transparency, and how to convert, compress, and convert PNG to JPG, WEBP, or PDF.',
    details: 'PNG (Portable Network Graphics) is an open, unpatented raster graphics file format that supports lossless data compression. Designed as an improvement upon GIF, PNG delivers full 24-bit RGB color depth alongside an 8-bit alpha channel for smooth translucent and transparent gradients.',
    pros: ['Lossless compression ensures zero visual fidelity loss', 'Full alpha transparency support', 'Extremely sharp edges for diagrams, icons, and text'],
    cons: ['Significantly larger file sizes for complex photographs compared to JPG or WEBP', 'No native animation support (standard PNG)'],
    bestFor: 'Logos, UI mockups, icons, screenshots, and graphics requiring transparent backgrounds.',
    compatibleTools: ['png-to-jpg', 'png-to-webp', 'png-to-pdf', 'compress-image', 'resize-image', 'crop-image', 'rotate-image'],
  },
  {
    slug: 'webp',
    name: 'WEBP',
    extension: '.webp',
    mimeTypes: ['image/webp'],
    category: 'image',
    title: 'WEBP Image Format – Modern High-Efficiency Web Graphics',
    description: 'Discover the WEBP format developed by Google, offering superior lossy and lossless compression with transparency and animations.',
    details: 'WEBP is a modern image format developed by Google that provides outstanding lossy and lossless compression for web assets. WEBP lossless images are approximately 26% smaller than PNGs, and WEBP lossy images are 25-34% smaller than comparable JPEGs at similar visual quality.',
    pros: ['Up to 35% smaller file sizes than JPG and PNG', 'Supports both transparency and lossy/lossless modes', 'Universal support in modern browsers'],
    cons: ['Limited native support in older legacy desktop software and operating systems', 'Requires conversion for certain offline print workflows'],
    bestFor: 'Modern web development, mobile apps, and bandwidth-sensitive platforms.',
    compatibleTools: ['webp-to-jpg', 'webp-to-png', 'jpg-to-webp', 'png-to-webp', 'compress-image'],
  },
  {
    slug: 'heic',
    name: 'HEIC / HEIF',
    extension: '.heic, .heif',
    mimeTypes: ['image/heic', 'image/heif'],
    category: 'image',
    title: 'HEIC Image Format – High Efficiency Apple Photo Format',
    description: 'Everything about Apple HEIC format, advantages, compatibility challenges, and how to convert iPhone HEIC photos to universal JPG.',
    details: 'HEIC (High Efficiency Image Container) is Apple implementation of the HEIF standard, utilizing HEVC (H.265) video compression algorithms to compress still images. It captures twice as much visual data as JPEG in the same file size, with 16-bit color depth and live photo sequences.',
    pros: ['Superior image quality at half the file size of JPEG', 'Supports wide color gamut and 16-bit color', 'Stores bursts and live photos in a single container'],
    cons: ['Incompatible with many Windows applications, older Androids, and web CMS platforms', 'Requires transcoding before uploading to many websites'],
    bestFor: 'Capturing mobile photography on iOS and iPadOS devices.',
    compatibleTools: ['heic-to-jpg'],
  },
  {
    slug: 'pdf',
    name: 'PDF',
    extension: '.pdf',
    mimeTypes: ['application/pdf'],
    category: 'document',
    title: 'PDF Document Format – Portable Document Standard & Utilities',
    description: 'Comprehensive guide to the PDF document standard. Convert, merge, split, compress, and reorder PDF documents online for free.',
    details: 'PDF (Portable Document Format) is a standardized ISO file format developed by Adobe for presenting documents independently of application software, hardware, and operating systems. Every PDF file encapsulates a complete description of a fixed-layout flat document, including text, fonts, vector graphics, and raster images.',
    pros: ['Guaranteed visual consistency across every printer, screen, and operating system', 'Embeds fonts, vector lines, and metadata', 'Supports security, digital signatures, and pagination'],
    cons: ['Fixed layout makes responsive reflowing difficult on small mobile screens', 'Editing text within a compiled PDF is complex without specialized software'],
    bestFor: 'Contracts, invoices, books, research papers, resumes, and printable publications.',
    compatibleTools: ['merge-pdf', 'split-pdf', 'compress-pdf', 'rotate-pdf', 'delete-pdf-pages', 'reorder-pdf-pages', 'pdf-to-jpg', 'pdf-to-png', 'jpg-to-pdf', 'png-to-pdf', 'image-to-pdf'],
  },
];

export function getFormatBySlug(slug: string): FormatDefinition | undefined {
  return FORMATS.find((format) => format.slug === slug);
}

export function getAllFormats(): FormatDefinition[] {
  return FORMATS;
}

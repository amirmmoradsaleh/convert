# Free Online File Tools

> **A fast, privacy-first, 100% browser-based suite of 25 image and PDF manipulation tools.**  
> Convert, compress, resize, edit, and organize files locally on your device with **zero server uploads**.

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-blue?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-438%20Passed-success?style=flat)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/E2E-98%20Passed-green?style=flat&logo=playwright)](https://playwright.dev/)

---

## 🌟 Overview

**Free Online File Tools** is a modern, client-side web application designed to solve everyday document and media management tasks without compromising privacy or performance.

Unlike traditional online conversion utilities that transmit sensitive files across the internet to third-party cloud servers, **every single transformation in this suite executes 100% in your local web browser session**.

### 🔒 Why Local-First Matters
* **Absolute Privacy**: Financial statements, legal contracts, medical scans, and personal photos never leave your device.
* **Instantaneous Processing**: No uploading delays or waiting in server conversion queues.
* **Offline & Private**: Powered by modern web standards, HTML5 Canvas, Web Workers, and WebAssembly.
* **No File Size Compromises**: Supports high-resolution images up to 50 MB and extensive PDF documents up to 100 MB.

---

## 🛠️ The 25-Tool Directory

The application features 25 dedicated utilities spanning Image Conversion, Image Editing, Image-to-PDF compilation, and complete PDF document manipulation.

### 🖼️ Image Converters
1. **[JPG to PNG](/tools/jpg-to-png)**: Convert lossy JPG images to crisp, lossless PNGs with transparency support.
2. **[PNG to JPG](/tools/png-to-jpg)**: Convert PNG graphics to lightweight JPGs with adjustable quality and background matte colors.
3. **[JPG to WebP](/tools/jpg-to-webp)**: Convert JPGs to modern WebP format for superior web compression.
4. **[WebP to JPG](/tools/webp-to-jpg)**: Decode WebP images into universally compatible JPEGs with customizable quality.
5. **[PNG to WebP](/tools/png-to-webp)**: Convert PNGs to WebP with lossy or lossless compression while preserving transparency.
6. **[WebP to PNG](/tools/webp-to-png)**: Decompress WebP files into full-fidelity, lossless PNG images.
7. **[HEIC to JPG](/tools/heic-to-jpg)**: Convert Apple iPhone/iPad HEIC and HEIF photos to standard JPGs directly in your browser.
8. **[SVG to PNG](/tools/svg-to-png)**: Rasterize scalable vector graphics to high-resolution PNGs with customizable scale multipliers.
9. **[GIF to PNG](/tools/gif-to-png)**: Extract high-quality, static PNG frames from animated or single-frame GIFs.
10. **[BMP to PNG](/tools/bmp-to-png)**: Modernize uncompressed Windows bitmap files into lightweight, lossless PNGs.

### ✂️ Image Utilities
11. **[Compress Image](/tools/compress-image)**: Reduce JPG, PNG, and WebP file sizes using adaptive quality presets or custom targets without changing pixel dimensions.
12. **[Resize Image](/tools/resize-image)**: Scale image dimensions by exact pixels or percentage with aspect-ratio locking.
13. **[Crop Image](/tools/crop-image)**: Interactive visual cropping editor supporting Freeform, 1:1 (Square), 4:3, and 16:9 aspect ratios.
14. **[Rotate Image](/tools/rotate-image)**: Rotate images 90°, 180°, or 270° clockwise with zero raster degradation.

### 📄 Image to PDF
15. **[Image to PDF](/tools/image-to-pdf)**: Combine mixed JPG, PNG, and WebP images into a single standardized PDF document with page orientation and margin controls.
16. **[JPG to PDF](/tools/jpg-to-pdf)**: Convert single or batch JPG photos into clean, high-resolution PDF pages.
17. **[PNG to PDF](/tools/png-to-pdf)**: Assemble transparent or crisp PNG graphics into printable, multi-page PDFs.

### 📑 PDF Converters & Utilities
18. **[PDF to JPG](/tools/pdf-to-jpg)**: Extract PDF document pages into high-resolution JPG images (with batch ZIP download).
19. **[PDF to PNG](/tools/pdf-to-png)**: Render PDF pages into lossless PNG images with crisp text rendering.
20. **[Merge PDF](/tools/merge-pdf)**: Concatenate multiple PDF files into a single unified document with visual drag-and-drop reordering.
21. **[Split PDF](/tools/split-pdf)**: Split PDFs via 3 versatile modes: extract selected pages, split every page individually, or define custom page ranges (e.g., `1-3, 5, 8-10`).
22. **[Compress PDF](/tools/compress-pdf)**: Optimize PDF document streams and redundant structures client-side for smaller file sizes.
23. **[Rotate PDF](/tools/rotate-pdf)**: Permanently rotate all pages or selected pages (90°, 180°, 270°) with zero rasterization.
24. **[Delete PDF Pages](/tools/delete-pdf-pages)**: Select and remove unwanted pages with safety checks preventing accidental zero-page documents.
25. **[Reorder PDF Pages](/tools/reorder-pdf-pages)**: Rearrange PDF page sequences using visual drag-and-drop thumbnail cards or accessible Up/Down buttons.

---

## ⚡ Tech Stack & Architecture

* **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack, React Server Components)
* **Frontend**: [React 19](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/), [Tailwind CSS v4](https://tailwindcss.com/)
* **Animations**: [Motion](https://motion.dev/)
* **Icons**: [Lucide React](https://lucide.dev/)
* **PDF Engines**:
  * [pdf-lib](https://pdf-lib.js.org/) — In-memory PDF document creation, merging, splitting, deletion, reordering, and metadata preservation.
  * [pdfjs-dist](https://mozilla.github.io/pdf.js/) — Client-side page rendering and real-time thumbnail previews.
* **Image Engines**:
  * Native HTML5 Canvas 2D API & OffscreenCanvas.
  * Web Workers for background non-blocking conversions.
  * [heic-to](https://github.com/catdad/heic-to) — Client-side HEIC/HEIF decoding.
  * [JSZip](https://stuk.github.io/jszip/) — Client-side ZIP archive creation for batch downloads.
* **Testing**: [Vitest](https://vitest.dev/) (Unit/Integration) & [Playwright](https://playwright.dev/) (End-to-End browser testing).

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) v18.18 or higher (Node 20+ recommended)
* [npm](https://www.npmjs.com/) v9 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/baabzanco/convert.git
cd convert

# Install dependencies
npm install
```

### Development

Start the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

### Production Build

Create an optimized production build:

```bash
# Build the application
npm run build

# Start the production server
npm run start
```

---

## 🧪 Testing & Code Quality

The codebase enforces strict test coverage, linting standards, and type safety across all 25 tools.

```bash
# Run unit & integration tests (Vitest)
npm run test

# Run End-to-End browser tests (Playwright)
npm run test:e2e

# Run linter (ESLint)
npm run lint

# Run TypeScript type check
npx tsc --noEmit
```

### Test Suite Summary
* **Unit Tests**: **438 passed** across 26 test suites.
* **E2E Tests**: **98 passed** across all browser workflows.
* **TypeScript & ESLint**: **0 errors**, **0 warnings**.

---

## 🛡️ Privacy & Security Principles

1. **Zero Data Transmission**: No documents, images, or extracted text are uploaded to any external server.
2. **Client-Side Verification**: Files are validated on device using file signatures (magic bytes) to prevent malformed or malicious uploads.
3. **Automatic Memory Cleanup**: Temporary blob URLs and allocated ArrayBuffers are revoked and discarded immediately after processing or file reset.
4. **No Tracking or Tracking Pixels**: Completely private with no invasive document logging.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

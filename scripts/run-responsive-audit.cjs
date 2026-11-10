const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(process.cwd(), 'tests/fixtures/audit/responsive-screenshots');
const REPORT_DIR = path.join(process.cwd(), 'tests/fixtures/audit/responsive-report');

// 7 Required Viewports + 3 Intermediate Breakpoints
const VIEWPORTS = [
  { name: 'small-mobile', label: 'Small Mobile', width: 320, height: 720, isMobile: true },
  { name: 'standard-mobile', label: 'Standard Mobile', width: 375, height: 812, isMobile: true },
  { name: 'large-mobile', label: 'Large Mobile', width: 430, height: 932, isMobile: true },
  { name: 'intermediate-sm', label: 'Intermediate 640px', width: 640, height: 800, isMobile: false },
  { name: 'intermediate-pre-md', label: 'Intermediate 767px', width: 767, height: 900, isMobile: false },
  { name: 'tablet-portrait', label: 'Tablet Portrait', width: 768, height: 1024, isMobile: false },
  { name: 'tablet-landscape', label: 'Tablet Landscape', width: 1024, height: 768, isMobile: false },
  { name: 'intermediate-pre-lg', label: 'Intermediate 1023px', width: 1023, height: 768, isMobile: false },
  { name: 'desktop', label: 'Desktop', width: 1366, height: 900, isMobile: false },
  { name: 'large-desktop', label: 'Large Desktop', width: 1920, height: 1080, isMobile: false },
];

// All Pages to Audit
const PUBLIC_PAGES = [
  { path: '/', name: 'home', category: 'Public Website' },
  { path: '/about', name: 'about', category: 'Public Website' },
  { path: '/contact', name: 'contact', category: 'Public Website' },
  { path: '/privacy', name: 'privacy', category: 'Public Website' },
  { path: '/terms', name: 'terms', category: 'Public Website' },
  { path: '/blog', name: 'blog-index', category: 'Public Website' },
  { path: '/blog/essential-tips-for-managing-pdf-documents', name: 'blog-post', category: 'Public Website' },
  { path: '/image-tools', name: 'hub-image-tools', category: 'Public Website' },
  { path: '/pdf-tools', name: 'hub-pdf-tools', category: 'Public Website' },
  { path: '/formats/jpg', name: 'format-jpg', category: 'Public Website' },
  { path: '/formats/png', name: 'format-png', category: 'Public Website' },
  { path: '/formats/webp', name: 'format-webp', category: 'Public Website' },
  { path: '/formats/gif', name: 'format-gif', category: 'Public Website' },
  { path: '/formats/pdf', name: 'format-pdf', category: 'Public Website' },
  { path: '/non-existent-audit-404', name: 'not-found-404', category: 'Public Website' },
];

const TOOL_PAGES = [
  // 10 Image Conversion Tools
  { path: '/tools/jpg-to-png', name: 'tool-jpg-to-png', category: 'Image Conversion Tools' },
  { path: '/tools/png-to-jpg', name: 'tool-png-to-jpg', category: 'Image Conversion Tools' },
  { path: '/tools/jpg-to-webp', name: 'tool-jpg-to-webp', category: 'Image Conversion Tools' },
  { path: '/tools/webp-to-jpg', name: 'tool-webp-to-jpg', category: 'Image Conversion Tools' },
  { path: '/tools/png-to-webp', name: 'tool-png-to-webp', category: 'Image Conversion Tools' },
  { path: '/tools/webp-to-png', name: 'tool-webp-to-png', category: 'Image Conversion Tools' },
  { path: '/tools/heic-to-jpg', name: 'tool-heic-to-jpg', category: 'Image Conversion Tools' },
  { path: '/tools/svg-to-png', name: 'tool-svg-to-png', category: 'Image Conversion Tools' },
  { path: '/tools/gif-to-png', name: 'tool-gif-to-png', category: 'Image Conversion Tools' },
  { path: '/tools/bmp-to-png', name: 'tool-bmp-to-png', category: 'Image Conversion Tools' },
  // 5 Image Processing Tools
  { path: '/tools/compress-image', name: 'tool-compress-image', category: 'Image Processing Tools' },
  { path: '/tools/resize-image', name: 'tool-resize-image', category: 'Image Processing Tools' },
  { path: '/tools/crop-image', name: 'tool-crop-image', category: 'Image Processing Tools' },
  { path: '/tools/rotate-image', name: 'tool-rotate-image', category: 'Image Processing Tools' },
  { path: '/tools/image-to-pdf', name: 'tool-image-to-pdf', category: 'Image Processing Tools' },
  // 5 PDF Conversion Tools
  { path: '/tools/jpg-to-pdf', name: 'tool-jpg-to-pdf', category: 'PDF Conversion Tools' },
  { path: '/tools/png-to-pdf', name: 'tool-png-to-pdf', category: 'PDF Conversion Tools' },
  { path: '/tools/pdf-to-jpg', name: 'tool-pdf-to-jpg', category: 'PDF Conversion Tools' },
  { path: '/tools/pdf-to-png', name: 'tool-pdf-to-png', category: 'PDF Conversion Tools' },
  { path: '/tools/merge-pdf', name: 'tool-merge-pdf', category: 'PDF Conversion Tools' },
  // 5 PDF Manipulation Tools
  { path: '/tools/split-pdf', name: 'tool-split-pdf', category: 'PDF Manipulation Tools' },
  { path: '/tools/compress-pdf', name: 'tool-compress-pdf', category: 'PDF Manipulation Tools' },
  { path: '/tools/rotate-pdf', name: 'tool-rotate-pdf', category: 'PDF Manipulation Tools' },
  { path: '/tools/delete-pdf-pages', name: 'tool-delete-pdf-pages', category: 'PDF Manipulation Tools' },
  { path: '/tools/reorder-pdf-pages', name: 'tool-reorder-pdf-pages', category: 'PDF Manipulation Tools' },
];

const ADMIN_PAGES = [
  { path: '/admin/login', name: 'admin-login', category: 'Admin Panel (Unauth)' },
  { path: '/admin/dashboard', name: 'admin-dashboard', category: 'Admin Panel' },
  { path: '/admin/blog', name: 'admin-blog', category: 'Admin Panel' },
  { path: '/admin/blog/new', name: 'admin-blog-new', category: 'Admin Panel' },
  { path: '/admin/navigation', name: 'admin-navigation', category: 'Admin Panel' },
  { path: '/admin/media', name: 'admin-media', category: 'Admin Panel' },
  { path: '/admin/settings', name: 'admin-settings', category: 'Admin Panel' },
  { path: '/admin/tools', name: 'admin-tools', category: 'Admin Panel' },
  { path: '/admin/pages', name: 'admin-pages', category: 'Admin Panel' },
  { path: '/admin/pages/new', name: 'admin-pages-new', category: 'Admin Panel' },
  { path: '/admin/users', name: 'admin-users', category: 'Admin Panel' },
  { path: '/admin/audit', name: 'admin-audit', category: 'Admin Panel' },
  { path: '/admin/backup', name: 'admin-backup', category: 'Admin Panel' },
];

// In-depth DOM evaluator function injected into browser context
async function evaluatePageLayout(page, viewport) {
  return await page.evaluate((vp) => {
    const docEl = document.documentElement;
    const body = document.body;

    const docClientW = docEl.clientWidth;
    const docScrollW = docEl.scrollWidth;
    const bodyScrollW = body ? body.scrollWidth : 0;
    const windowInnerW = window.innerWidth;

    // Viewport-level horizontal overflow
    const hasDocOverflow = docScrollW > docClientW + 1;
    const hasBodyOverflow = bodyScrollW > docClientW + 1;
    const hasWindowOverflow = docScrollW > windowInnerW + 1;
    const overflowAmount = Math.max(0, docScrollW - docClientW, bodyScrollW - docClientW);

    const overflowingElements = [];
    const elementsOutOfBounds = [];

    // Traverse all DOM elements
    const all = document.querySelectorAll('*');
    for (const el of all) {
      // Ignore hidden or 0-dimension elements
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        continue;
      }

      // Check if element is inside an intentional horizontal scroll container (like a table with overflow-x: auto)
      let parent = el.parentElement;
      let inIntentionalScrollContainer = false;
      while (parent && parent !== body && parent !== docEl) {
        const pStyle = window.getComputedStyle(parent);
        if (pStyle.overflowX === 'auto' || pStyle.overflowX === 'scroll') {
          inIntentionalScrollContainer = true;
          break;
        }
        parent = parent.parentElement;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        // Element right edge extends beyond the viewport
        if (rect.right > docClientW + 1.5 && !inIntentionalScrollContainer) {
          let selector = el.tagName.toLowerCase();
          if (el.id) {
            selector += `#${el.id}`;
          } else if (el.className && typeof el.className === 'string') {
            const classes = el.className.trim().split(/\s+/).slice(0, 3).join('.');
            if (classes) selector += `.${classes}`;
          }

          overflowingElements.push({
            selector,
            tagName: el.tagName,
            id: el.id || null,
            className: typeof el.className === 'string' ? el.className.slice(0, 100) : '',
            rect: {
              top: Math.round(rect.top),
              right: Math.round(rect.right),
              bottom: Math.round(rect.bottom),
              left: Math.round(rect.left),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            excessPx: Math.round(rect.right - docClientW),
            text: el.innerText ? el.innerText.slice(0, 60).replace(/\s+/g, ' ').trim() : '',
          });
        }

        // Element entirely out of bounds (e.g. pushed completely to negative or extreme right)
        if (rect.left > docClientW || rect.right < 0) {
          elementsOutOfBounds.push({
            tagName: el.tagName,
            id: el.id || null,
            className: typeof el.className === 'string' ? el.className.slice(0, 100) : '',
            rect: {
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            },
          });
        }
      }
    }

    return {
      docClientW,
      docScrollW,
      bodyScrollW,
      windowInnerW,
      hasOverflow: hasDocOverflow || hasBodyOverflow || hasWindowOverflow,
      overflowAmount,
      overflowingElements: overflowingElements.slice(0, 12),
      elementsOutOfBoundsCount: elementsOutOfBounds.length,
    };
  }, viewport);
}

async function runResponsiveAudit() {
  console.log('================================================================');
  console.log('       Convert24 Comprehensive Responsive Design Audit          ');
  console.log('================================================================');
  console.log(`Target Base URL: ${BASE_URL}`);
  console.log(`Viewports to test: ${VIEWPORTS.length}`);
  console.log(`Public pages: ${PUBLIC_PAGES.length}`);
  console.log(`Tool pages: ${TOOL_PAGES.length}`);
  console.log(`Admin pages: ${ADMIN_PAGES.length}`);
  console.log('----------------------------------------------------------------\n');

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  // 1. Authenticate admin context once
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  console.log('Authenticating Admin context via /api/admin/auth/login...');
  const loginRes = await adminPage.request.post(`${BASE_URL}/api/admin/auth/login`, {
    data: {
      email: 'admin@filetools.local',
      password: 'AdminPassword123!',
    },
  });
  const loginJson = await loginRes.json();
  if (!loginJson.success) {
    console.error('Failed to log in as admin:', loginJson);
  } else {
    console.log(`Admin authenticated successfully: ${loginJson.user.email} (${loginJson.user.role})\n`);
  }
  await adminPage.close();

  // Public context for public/tool pages
  const publicContext = await browser.newContext();

  const auditResults = {
    timestamp: new Date().toISOString(),
    viewportsTested: VIEWPORTS,
    summary: {
      totalPagesAudited: 0,
      totalViewportChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      overflowIncidents: 0,
    },
    pages: [],
    overflowDefects: [],
    navigationChecks: [],
    interactiveToolChecks: [],
    adminResponsiveChecks: [],
    consoleErrors: [],
    networkFailures: [],
  };

  const allAudits = [
    ...PUBLIC_PAGES.map((p) => ({ ...p, isAdmin: false })),
    ...TOOL_PAGES.map((p) => ({ ...p, isAdmin: false })),
    ...ADMIN_PAGES.map((p) => ({ ...p, isAdmin: true })),
  ];

  auditResults.summary.totalPagesAudited = allAudits.length;

  const reportPath = path.join(REPORT_DIR, 'audit-results.json');
  let skipPageCrawl = false;
  if (fs.existsSync(reportPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      if (existing.pages && existing.pages.length === allAudits.length) {
        console.log(`Loaded ${existing.pages.length} audited pages from existing audit-results.json. Resuming with interaction tests...`);
        auditResults = existing;
        auditResults.navigationChecks = [];
        auditResults.interactiveToolChecks = [];
        auditResults.adminResponsiveChecks = [];
        skipPageCrawl = true;
      }
    } catch (e) {}
  }

  if (!skipPageCrawl) {
    for (const pageItem of allAudits) {
    const pageCategory = pageItem.category;
    const pagePath = pageItem.path;
    const pageName = pageItem.name;
    const context = pageItem.isAdmin ? adminContext : publicContext;

    console.log(`\nAuditing [${pageCategory}] ${pagePath} ...`);

    const pageAuditRecord = {
      path: pagePath,
      name: pageName,
      category: pageCategory,
      isAdmin: pageItem.isAdmin,
      viewports: {},
    };

    const page = await context.newPage();

    // Collect console errors & network failures for this page
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('Failed to load resource') && !text.includes('favicon')) {
          auditResults.consoleErrors.push({
            page: pagePath,
            message: text,
          });
        }
      }
    });

    page.on('requestfailed', (req) => {
      const url = req.url();
      if (!url.includes('favicon.ico')) {
        auditResults.networkFailures.push({
          page: pagePath,
          url,
          failure: req.failure() ? req.failure().errorText : 'unknown',
        });
      }
    });

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      try {
        await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: 'load', timeout: 15000 });
        // Give client hydration a moment
        await page.waitForTimeout(300);
      } catch (err) {
        console.warn(`  - [${vp.label}] Navigation warning: ${err.message}`);
      }

      const layoutEval = await evaluatePageLayout(page, vp);
      const isPassed = !layoutEval.hasOverflow;

      auditResults.summary.totalViewportChecks++;
      if (isPassed) {
        auditResults.summary.passedChecks++;
      } else {
        auditResults.summary.failedChecks++;
        auditResults.summary.overflowIncidents++;

        console.log(
          `  ❌ OVERFLOW on [${vp.label} - ${vp.width}px]: scrollW=${layoutEval.docScrollW}px > clientW=${layoutEval.docClientW}px (overflow +${layoutEval.overflowAmount}px)`
        );
        for (const el of layoutEval.overflowingElements) {
          console.log(
            `     -> Element: <${el.tagName.toLowerCase()}> "${el.selector}" extends +${el.excessPx}px (right=${el.rect.right}px)`
          );
          auditResults.overflowDefects.push({
            page: pagePath,
            pageName,
            category: pageCategory,
            viewport: vp.label,
            viewportWidth: vp.width,
            overflowAmount: layoutEval.overflowAmount,
            element: el,
          });
        }
      }

      // Capture screenshot at required canonical viewports (or when overflow is detected)
      const shouldScreenshot =
        ['small-mobile', 'standard-mobile', 'tablet-portrait', 'desktop', 'large-desktop'].includes(
          vp.name
        ) || !isPassed;

      let screenshotPath = null;
      if (shouldScreenshot) {
        const screenshotFilename = `${pageName}_${vp.name}.png`;
        screenshotPath = path.join(SCREENSHOT_DIR, screenshotFilename);
        if (!fs.existsSync(screenshotPath)) {
          await page.screenshot({ path: screenshotPath, fullPage: false });
        }
      }

      pageAuditRecord.viewports[vp.name] = {
        viewportName: vp.name,
        viewportLabel: vp.label,
        width: vp.width,
        height: vp.height,
        status: isPassed ? 'PASS' : 'FAIL',
        docClientW: layoutEval.docClientW,
        docScrollW: layoutEval.docScrollW,
        overflowAmount: layoutEval.overflowAmount,
        overflowingElementsCount: layoutEval.overflowingElements.length,
        screenshot: screenshotPath ? path.relative(process.cwd(), screenshotPath) : null,
      };
    }

    auditResults.pages.push(pageAuditRecord);
    await page.close();
  }

  // Save intermediate report JSON in case interactive steps encounter any issue
  fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2));
  }

  // =========================================================================
  // Interaction Testing: Public Mobile Navigation
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('Testing Mobile Navigation Interactions (Hamburger Menu)...');
  console.log('----------------------------------------------------------------');
  {
    const page = await publicContext.newPage();
    for (const width of [320, 375, 430, 768]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${BASE_URL}/`, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      // Check mobile hamburger button
      const menuBtn = page.locator('button[aria-controls="mobile-navigation"]');
      const menuBtnExists = await menuBtn.isVisible().catch(() => false);

      const navTest = {
        viewportWidth: width,
        menuButtonVisible: menuBtnExists,
        drawerOpens: false,
        drawerCloses: false,
        linksCount: 0,
        hasOverflowWhenOpen: false,
      };

      if (menuBtnExists) {
        await menuBtn.click();
        await page.waitForTimeout(300);

        // Check if navigation drawer is visible
        const navMenu = page.locator('#mobile-navigation');
        const isMenuOpen = await navMenu.isVisible().catch(() => false);
        navTest.drawerOpens = isMenuOpen;

        const links = page.locator('#mobile-navigation a');
        navTest.linksCount = await links.count();

        // Check layout overflow while menu is open
        const openOverflow = await evaluatePageLayout(page, { width, height: 800 });
        navTest.hasOverflowWhenOpen = openOverflow.hasOverflow;

        // Take screenshot of mobile nav open
        const navScreenshotPath = path.join(SCREENSHOT_DIR, `interaction_mobile_nav_open_${width}px.png`);
        await page.screenshot({ path: navScreenshotPath });
        navTest.screenshot = path.relative(process.cwd(), navScreenshotPath);

        // Close menu
        await menuBtn.click();
        await page.waitForTimeout(300);
        navTest.drawerCloses = !(await navMenu.isVisible().catch(() => false));
      }

      console.log(
        `  - Width ${width}px: menuBtn=${navTest.menuButtonVisible}, opens=${navTest.drawerOpens}, closes=${navTest.drawerCloses}, openOverflow=${navTest.hasOverflowWhenOpen}`
      );
      auditResults.navigationChecks.push(navTest);
    }
    await page.close();
  }

  // =========================================================================
  // Interaction Testing: Representative Tool UIs (Active States & Controls)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('Testing Representative Tool Interactive States on Mobile & Tablet...');
  console.log('----------------------------------------------------------------');
  const sampleJpgPath = path.join(process.cwd(), 'tests/fixtures/sample.jpg');
  const sample3PagesPdfPath = path.join(process.cwd(), 'tests/fixtures/sample-3pages.pdf');

  // Tool 1: Compress Image Interactive State
  try {
    const page = await publicContext.newPage();
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${BASE_URL}/tools/compress-image`);
      await page.waitForSelector('[data-hydrated="true"]');

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(sampleJpgPath);
      await page.waitForTimeout(600);

      // Verify file card, quality slider, compress button
      const slider = page.locator('input[type="range"]');
      const hasSlider = await slider.isVisible().catch(() => false);
      const compressBtn = page.getByRole('button', { name: /Compress Image/i });
      const hasBtn = await compressBtn.isVisible().catch(() => false);

      const layoutEval = await evaluatePageLayout(page, { width, height: 800 });
      const screenshot = path.join(SCREENSHOT_DIR, `tool_active_compress_image_${width}px.png`);
      await page.screenshot({ path: screenshot });

      console.log(
        `  - Compress Image (${width}px): sliderVisible=${hasSlider}, btnVisible=${hasBtn}, overflow=${layoutEval.hasOverflow} (+${layoutEval.overflowAmount}px)`
      );
      if (layoutEval.hasOverflow) {
        console.log(`    -> Compress Image Overflow Elements:`, layoutEval.overflowingElements);
      }
      auditResults.interactiveToolChecks.push({
        tool: 'Compress Image',
        viewportWidth: width,
        sliderVisible: hasSlider,
        actionButtonVisible: hasBtn,
        hasOverflow: layoutEval.hasOverflow,
        overflowAmount: layoutEval.overflowAmount,
        overflowingElements: layoutEval.overflowingElements,
        screenshot: path.relative(process.cwd(), screenshot),
      });
    }
    await page.close();
  } catch (err) {
    console.error('Error during Compress Image interactive check:', err.message);
  }

  // Tool 2: Resize Image Interactive State (Inputs & Checkbox)
  try {
    const page = await publicContext.newPage();
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${BASE_URL}/tools/resize-image`);
      await page.waitForSelector('input[type="file"]', { state: 'attached' });

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(sampleJpgPath);
      await page.waitForTimeout(600);

      const numberInputs = page.locator('input[type="number"]');
      const inputsVisible = (await numberInputs.count()) >= 2;

      const layoutEval = await evaluatePageLayout(page, { width, height: 800 });
      const screenshot = path.join(SCREENSHOT_DIR, `tool_active_resize_image_${width}px.png`);
      await page.screenshot({ path: screenshot });

      console.log(
        `  - Resize Image (${width}px): inputsVisible=${inputsVisible}, overflow=${layoutEval.hasOverflow} (+${layoutEval.overflowAmount}px)`
      );
      auditResults.interactiveToolChecks.push({
        tool: 'Resize Image',
        viewportWidth: width,
        inputsVisible,
        hasOverflow: layoutEval.hasOverflow,
        overflowAmount: layoutEval.overflowAmount,
        overflowingElements: layoutEval.overflowingElements,
        screenshot: path.relative(process.cwd(), screenshot),
      });
    }
    await page.close();
  } catch (err) {
    console.error('Error during Resize Image interactive check:', err.message);
  }

  // Tool 3: Split PDF Interactive State (Page Grid & Mode Tabs)
  try {
    const page = await publicContext.newPage();
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${BASE_URL}/tools/split-pdf`);
      await page.waitForSelector('[data-hydrated="true"]');

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(sample3PagesPdfPath);
      await page.waitForTimeout(1000);

      const splitBtn = page.getByRole('button', { name: /Split PDF/i });
      const btnVisible = await splitBtn.first().isVisible().catch(() => false);

      const layoutEval = await evaluatePageLayout(page, { width, height: 800 });
      const screenshot = path.join(SCREENSHOT_DIR, `tool_active_split_pdf_${width}px.png`);
      await page.screenshot({ path: screenshot });

      console.log(
        `  - Split PDF (${width}px): btnVisible=${btnVisible}, overflow=${layoutEval.hasOverflow} (+${layoutEval.overflowAmount}px)`
      );
      auditResults.interactiveToolChecks.push({
        tool: 'Split PDF',
        viewportWidth: width,
        actionButtonVisible: btnVisible,
        hasOverflow: layoutEval.hasOverflow,
        overflowAmount: layoutEval.overflowAmount,
        overflowingElements: layoutEval.overflowingElements,
        screenshot: path.relative(process.cwd(), screenshot),
      });
    }
    await page.close();
  } catch (err) {
    console.error('Error during Split PDF interactive check:', err.message);
  }

  // Tool 4: Reorder PDF Pages Interactive State (Thumbnails & Move Buttons)
  try {
    const page = await publicContext.newPage();
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${BASE_URL}/tools/reorder-pdf-pages`);
      await page.waitForSelector('[data-hydrated="true"]');

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(sample3PagesPdfPath);
      await page.waitForTimeout(1000);

      const submitBtn = page.locator('#reorder-pages-submit-btn, button:has-text("Save & Download")');
      const btnVisible = await submitBtn.first().isVisible().catch(() => false);

      const layoutEval = await evaluatePageLayout(page, { width, height: 800 });
      const screenshot = path.join(SCREENSHOT_DIR, `tool_active_reorder_pdf_${width}px.png`);
      await page.screenshot({ path: screenshot });

      console.log(
        `  - Reorder PDF Pages (${width}px): btnVisible=${btnVisible}, overflow=${layoutEval.hasOverflow} (+${layoutEval.overflowAmount}px)`
      );
      auditResults.interactiveToolChecks.push({
        tool: 'Reorder PDF Pages',
        viewportWidth: width,
        actionButtonVisible: btnVisible,
        hasOverflow: layoutEval.hasOverflow,
        overflowAmount: layoutEval.overflowAmount,
        overflowingElements: layoutEval.overflowingElements,
        screenshot: path.relative(process.cwd(), screenshot),
      });
    }
    await page.close();
  } catch (err) {
    console.error('Error during Reorder PDF Pages interactive check:', err.message);
  }

  // =========================================================================
  // Admin Panel Responsive & Interaction Checks
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('Testing Admin Panel Responsive Layouts & Sidebar Behaviors...');
  console.log('----------------------------------------------------------------');
  try {
    const page = await adminContext.newPage();
    for (const width of [320, 375, 768, 1024, 1366]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${BASE_URL}/admin/dashboard`);
      await page.waitForTimeout(300);

      const aside = page.locator('aside');
      const isAsideVisible = await aside.isVisible().catch(() => false);

      // Check mobile sidebar toggle if present
      const sidebarToggleBtn = page.locator('button[aria-label="Toggle navigation menu"]');
      const toggleVisible = await sidebarToggleBtn.first().isVisible().catch(() => false);

      let drawerOpensOnMobile = false;
      if (toggleVisible) {
        await sidebarToggleBtn.first().click();
        await page.waitForTimeout(300);
        drawerOpensOnMobile = await page.locator('aside').isVisible().catch(() => false);
        const closeAsideBtn = page.locator('aside button[aria-label="Close navigation"]');
        if (await closeAsideBtn.isVisible().catch(() => false)) {
          await closeAsideBtn.click();
          await page.waitForTimeout(200);
        }
      }

      const layoutEval = await evaluatePageLayout(page, { width, height: 800 });
      const screenshot = path.join(SCREENSHOT_DIR, `admin_dashboard_layout_${width}px.png`);
      if (!fs.existsSync(screenshot)) {
        await page.screenshot({ path: screenshot });
      }

      console.log(
        `  - Admin Dashboard (${width}px): asideVisible=${isAsideVisible}, toggleVisible=${toggleVisible}, drawerOpens=${drawerOpensOnMobile}, overflow=${layoutEval.hasOverflow} (+${layoutEval.overflowAmount}px)`
      );
      auditResults.adminResponsiveChecks.push({
        screen: 'Admin Dashboard',
        viewportWidth: width,
        sidebarVisible: isAsideVisible,
        sidebarToggleVisible: toggleVisible,
        drawerOpensOnMobile,
        hasOverflow: layoutEval.hasOverflow,
        overflowAmount: layoutEval.overflowAmount,
        overflowingElements: layoutEval.overflowingElements,
        screenshot: path.relative(process.cwd(), screenshot),
      });
    }

    // Check Admin Blog Editor on 375px & 768px
    for (const width of [375, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE_URL}/admin/blog/new`);
      await page.waitForTimeout(400);

      const layoutEval = await evaluatePageLayout(page, { width, height: 900 });
      const screenshot = path.join(SCREENSHOT_DIR, `admin_blog_new_${width}px.png`);
      if (!fs.existsSync(screenshot)) {
        await page.screenshot({ path: screenshot });
      }

      console.log(
        `  - Admin Blog Editor (${width}px): overflow=${layoutEval.hasOverflow} (+${layoutEval.overflowAmount}px)`
      );
      auditResults.adminResponsiveChecks.push({
        screen: 'Admin Blog Editor (/admin/blog/new)',
        viewportWidth: width,
        hasOverflow: layoutEval.hasOverflow,
        overflowAmount: layoutEval.overflowAmount,
        overflowingElements: layoutEval.overflowingElements,
        screenshot: path.relative(process.cwd(), screenshot),
      });
    }

    // Check Admin Media Library on 375px & 768px
    for (const width of [375, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE_URL}/admin/media`);
      await page.waitForTimeout(400);

      const layoutEval = await evaluatePageLayout(page, { width, height: 900 });
      const screenshot = path.join(SCREENSHOT_DIR, `admin_media_${width}px.png`);
      if (!fs.existsSync(screenshot)) {
        await page.screenshot({ path: screenshot });
      }

      console.log(
        `  - Admin Media Library (${width}px): overflow=${layoutEval.hasOverflow} (+${layoutEval.overflowAmount}px)`
      );
      auditResults.adminResponsiveChecks.push({
        screen: 'Admin Media Library (/admin/media)',
        viewportWidth: width,
        hasOverflow: layoutEval.hasOverflow,
        overflowAmount: layoutEval.overflowAmount,
        overflowingElements: layoutEval.overflowingElements,
        screenshot: path.relative(process.cwd(), screenshot),
      });
    }

    await page.close();
  } catch (err) {
    console.error('Error during Admin responsive checks:', err.message);
  }

  await browser.close();

  // Save final report JSON
  fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2));

  console.log('\n================================================================');
  console.log('                 Responsive Audit Finished                      ');
  console.log('================================================================');
  console.log(`Total Pages Audited: ${auditResults.summary.totalPagesAudited}`);
  console.log(`Total Viewport Checks: ${auditResults.summary.totalViewportChecks}`);
  console.log(`Passed: ${auditResults.summary.passedChecks}`);
  console.log(`Failed (Overflow/Layout issue): ${auditResults.summary.failedChecks}`);
  console.log(`Overflow Incidents: ${auditResults.summary.overflowIncidents}`);
  console.log(`Report JSON written to: ${reportPath}`);
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
  console.log('================================================================\n');
}

runResponsiveAudit().catch((err) => {
  console.error('Fatal error in responsive audit runner:', err);
  process.exit(1);
});

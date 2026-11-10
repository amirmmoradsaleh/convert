/**
 * Convert24 Responsive Design Remediation Verification Suite
 * Evaluates all 53 routes across 10 viewports + targeted 768/800/900/1023px header checks.
 * Validates all P1, P2, and P3 defect remediations.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(process.cwd(), 'tests/fixtures/audit/responsive-remediation-screenshots');
const REPORT_DIR = path.join(process.cwd(), 'tests/fixtures/audit/responsive-remediation-report');

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'small-mobile', width: 320, height: 720, label: 'Small Mobile (320px)' },
  { name: 'standard-mobile', width: 375, height: 812, label: 'Standard Mobile (375px)' },
  { name: 'large-mobile', width: 430, height: 932, label: 'Large Mobile (430px)' },
  { name: 'intermediate-phablet', width: 640, height: 800, label: 'Intermediate Phablet (640px)' },
  { name: 'pre-tablet', width: 767, height: 800, label: 'Pre-Tablet (767px)' },
  { name: 'tablet-portrait', width: 768, height: 1024, label: 'Tablet Portrait (768px)' },
  { name: 'pre-desktop', width: 1023, height: 800, label: 'Pre-Desktop (1023px)' },
  { name: 'tablet-landscape', width: 1024, height: 768, label: 'Tablet Landscape (1024px)' },
  { name: 'desktop', width: 1366, height: 900, label: 'Desktop (1366px)' },
  { name: 'large-desktop', width: 1920, height: 1080, label: 'Large Desktop (1920px)' },
];

const TARGETED_HEADER_WIDTHS = [768, 800, 900, 1023];

const PUBLIC_PAGES = [
  { name: 'homepage', path: '/', category: 'Public Website' },
  { name: 'about', path: '/about', category: 'Public Website' },
  { name: 'contact', path: '/contact', category: 'Public Website' },
  { name: 'privacy', path: '/privacy', category: 'Public Website' },
  { name: 'terms', path: '/terms', category: 'Public Website' },
  { name: 'blog', path: '/blog', category: 'Public Website' },
  { name: 'blog-post', path: '/blog/essential-tips-for-managing-pdf-documents', category: 'Public Website' },
  { name: 'image-tools-hub', path: '/image-tools', category: 'Public Website' },
  { name: 'pdf-tools-hub', path: '/pdf-tools', category: 'Public Website' },
  { name: 'format-jpg', path: '/formats/jpg', category: 'Public Website' },
  { name: 'format-png', path: '/formats/png', category: 'Public Website' },
  { name: 'format-webp', path: '/formats/webp', category: 'Public Website' },
  { name: 'format-pdf', path: '/formats/pdf', category: 'Public Website' },
  { name: 'error-404', path: '/non-existent-audit-404', category: 'Public Website' },
  { name: 'login-public', path: '/admin/login', category: 'Public Website' },
];

const CANONICAL_TOOL_SLUGS = [
  'jpg-to-png', 'png-to-jpg', 'jpg-to-webp', 'webp-to-jpg', 'png-to-webp',
  'webp-to-png', 'heic-to-jpg', 'svg-to-png', 'gif-to-png', 'bmp-to-png',
  'compress-image', 'resize-image', 'crop-image', 'rotate-image', 'image-to-pdf',
  'jpg-to-pdf', 'png-to-pdf', 'pdf-to-jpg', 'pdf-to-png', 'merge-pdf',
  'split-pdf', 'compress-pdf', 'rotate-pdf', 'delete-pdf-pages', 'reorder-pdf-pages',
];
const TOOL_PAGES = CANONICAL_TOOL_SLUGS.map((slug) => ({
  name: `tool-${slug}`,
  path: `/tools/${slug}`,
  category: 'Public Tool',
}));

const ADMIN_PAGES = [
  { name: 'admin-dashboard', path: '/admin/dashboard', category: 'Admin Panel' },
  { name: 'admin-blog', path: '/admin/blog', category: 'Admin Panel' },
  { name: 'admin-blog-new', path: '/admin/blog/new', category: 'Admin Panel' },
  { name: 'admin-navigation', path: '/admin/navigation', category: 'Admin Panel' },
  { name: 'admin-media', path: '/admin/media', category: 'Admin Panel' },
  { name: 'admin-settings', path: '/admin/settings', category: 'Admin Panel' },
  { name: 'admin-tools', path: '/admin/tools', category: 'Admin Panel' },
  { name: 'admin-pages', path: '/admin/pages', category: 'Admin Panel' },
  { name: 'admin-pages-new', path: '/admin/pages/new', category: 'Admin Panel' },
  { name: 'admin-users', path: '/admin/users', category: 'Admin Panel' },
  { name: 'admin-audit', path: '/admin/audit', category: 'Admin Panel' },
  { name: 'admin-backup', path: '/admin/backup', category: 'Admin Panel' },
];

async function evaluatePageLayout(page, viewport) {
  return await page.evaluate((vp) => {
    const docEl = document.documentElement;
    const body = document.body;
    const clientW = window.innerWidth;
    const docScrollW = docEl.scrollWidth;
    const bodyScrollW = body ? body.scrollWidth : 0;
    const maxScrollW = Math.max(docScrollW, bodyScrollW);
    const hasOverflow = maxScrollW > clientW;
    const overflowAmount = Math.max(0, maxScrollW - clientW);

    const overflowingElements = [];
    if (hasOverflow) {
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (['auto', 'scroll'].includes(style.overflowX)) continue;

        const rect = el.getBoundingClientRect();
        if (rect.right > clientW + 1) {
          let sel = el.tagName.toLowerCase();
          if (el.id) sel += `#${el.id}`;
          else if (el.className && typeof el.className === 'string') {
            const firstClasses = el.className.trim().split(/\s+/).slice(0, 3).join('.');
            if (firstClasses) sel += `.${firstClasses}`;
          }
          overflowingElements.push({
            selector: sel,
            tagName: el.tagName,
            rect: {
              top: Math.round(rect.top),
              right: Math.round(rect.right),
              bottom: Math.round(rect.bottom),
              left: Math.round(rect.left),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            excessPx: Math.round(rect.right - clientW),
            text: (el.textContent || '').trim().slice(0, 40),
          });
          if (overflowingElements.length >= 10) break;
        }
      }
    }

    return {
      clientW,
      docScrollW: maxScrollW,
      hasOverflow,
      overflowAmount,
      overflowingElements,
    };
  }, viewport);
}

async function runRemediationVerification() {
  console.log('================================================================');
  console.log('       Convert24 Responsive Remediation Verification Suite      ');
  console.log('================================================================');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const publicContext = await browser.newContext();
  const adminContext = await browser.newContext();

  // 1. Authenticate Admin
  console.log('Authenticating Admin context...');
  const authPage = await adminContext.newPage();
  const loginRes = await authPage.request.post(`${BASE_URL}/api/admin/auth/login`, {
    data: { email: 'admin@filetools.local', password: 'AdminPassword123!' },
  });
  console.log(`Admin login status: ${loginRes.status()}`);
  await authPage.close();

  const remediationResults = {
    timestamp: new Date().toISOString(),
    summary: {
      totalPagesAudited: 0,
      totalViewportChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      overflowIncidents: 0,
    },
    defectChecks: {},
    targetedHeaderChecks: [],
    pages: [],
    consoleErrors: [],
    networkFailures: [],
  };

  // =========================================================================
  // TARGETED CHECK 1: Global Header Breakpoint Analysis (768, 800, 900, 1023)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('Targeted Check 1: Global Header at 768px, 800px, 900px, 1023px...');
  console.log('----------------------------------------------------------------');
  {
    const page = await publicContext.newPage();
    for (const width of TARGETED_HEADER_WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${BASE_URL}/`, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      const headerEval = await page.evaluate((w) => {
        const header = document.querySelector('header');
        const nav = document.querySelector('header nav');
        const ctaBtn = document.querySelector('header a[href*="explore-hubs"]');
        const searchInput = document.querySelector('header input[placeholder*="search" i]');
        const mobileBtn = document.querySelector('header button[aria-controls="mobile-navigation"]');

        const docScrollW = document.documentElement.scrollWidth;
        const overflow = Math.max(0, docScrollW - w);

        return {
          width: w,
          docScrollW,
          overflow,
          headerFound: Boolean(header),
          navVisible: nav ? window.getComputedStyle(nav).display !== 'none' : false,
          ctaVisible: ctaBtn ? window.getComputedStyle(ctaBtn).display !== 'none' : false,
          searchVisible: searchInput ? window.getComputedStyle(searchInput).display !== 'none' : false,
          mobileBtnVisible: mobileBtn ? window.getComputedStyle(mobileBtn).display !== 'none' : false,
        };
      }, width);

      const screenshot = path.join(SCREENSHOT_DIR, `after_global_header_${width}px.png`);
      await page.screenshot({ path: screenshot });

      console.log(
        `  - Header (${width}px): scrollW=${headerEval.docScrollW}px, overflow=+${headerEval.overflow}px, nav=${headerEval.navVisible}, search=${headerEval.searchVisible}, cta=${headerEval.ctaVisible}, mobileBtn=${headerEval.mobileBtnVisible}`
      );

      remediationResults.targetedHeaderChecks.push({
        ...headerEval,
        screenshot: path.relative(process.cwd(), screenshot),
      });
    }
    await page.close();
  }

  // =========================================================================
  // TARGETED CHECK 2: Blog Detail Breadcrumbs (320px, 375px, 430px)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('Targeted Check 2: Blog Detail Breadcrumbs on Mobile Viewports...');
  console.log('----------------------------------------------------------------');
  {
    const page = await publicContext.newPage();
    const blogUrl = `${BASE_URL}/blog/essential-tips-for-managing-pdf-documents`;
    remediationResults.defectChecks['DEFECT-P1-02-BlogBreadcrumbs'] = [];

    for (const width of [320, 375, 430]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(blogUrl, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      const breadcrumbEval = await page.evaluate((w) => {
        const nav = document.querySelector('nav[aria-label="Breadcrumb"]');
        const lastItem = nav ? nav.querySelector('li:last-child') : null;
        const lastSpan = lastItem ? lastItem.querySelector('span') : null;
        const docScrollW = document.documentElement.scrollWidth;

        return {
          width: w,
          docScrollW,
          overflow: Math.max(0, docScrollW - w),
          navFound: Boolean(nav),
          lastSpanFound: Boolean(lastSpan),
          lastSpanText: lastSpan ? lastSpan.textContent : '',
          lastSpanRight: lastSpan ? Math.round(lastSpan.getBoundingClientRect().right) : 0,
        };
      }, width);

      const screenshot = path.join(SCREENSHOT_DIR, `after_blog_breadcrumb_${width}px.png`);
      await page.screenshot({ path: screenshot });

      const passed = breadcrumbEval.overflow === 0;
      console.log(
        `  - Blog Breadcrumb (${width}px): ${passed ? '✅ PASS' : '❌ FAIL'} | scrollW=${breadcrumbEval.docScrollW}px (overflow +${breadcrumbEval.overflow}px), lastSpanRight=${breadcrumbEval.lastSpanRight}px`
      );

      remediationResults.defectChecks['DEFECT-P1-02-BlogBreadcrumbs'].push({
        ...breadcrumbEval,
        passed,
        screenshot: path.relative(process.cwd(), screenshot),
      });
    }
    await page.close();
  }

  // =========================================================================
  // TARGETED CHECK 3: Homepage Hero Decorative Section (767px)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('Targeted Check 3: Homepage Hero Section Decorative Elements at 767px...');
  console.log('----------------------------------------------------------------');
  {
    const page = await publicContext.newPage();
    await page.setViewportSize({ width: 767, height: 800 });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'load' });
    await page.waitForTimeout(300);

    const layout = await evaluatePageLayout(page, { width: 767, height: 800 });
    const screenshot = path.join(SCREENSHOT_DIR, 'after_homepage_hero_767px.png');
    await page.screenshot({ path: screenshot });

    const passed = !layout.hasOverflow;
    console.log(
      `  - Homepage (767px): ${passed ? '✅ PASS' : '❌ FAIL'} | scrollW=${layout.docScrollW}px (overflow +${layout.overflowAmount}px)`
    );

    remediationResults.defectChecks['DEFECT-P2-01-HomepageHero'] = {
      width: 767,
      passed,
      scrollWidth: layout.docScrollW,
      overflow: layout.overflowAmount,
      screenshot: path.relative(process.cwd(), screenshot),
    };
    await page.close();
  }

  // =========================================================================
  // TARGETED CHECK 4: Compress Image Slider Labels on 320px Active State
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('Targeted Check 4: Compress Image Quality Slider Labels on 320px Active State...');
  console.log('----------------------------------------------------------------');
  {
    const page = await publicContext.newPage();
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${BASE_URL}/tools/compress-image`);
    await page.waitForSelector('input[type="file"]', { state: 'attached' });

    const sampleJpg = path.join(process.cwd(), 'tests/fixtures/sample.jpg');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(sampleJpg);
    await page.waitForTimeout(600);

    const sliderEval = await page.evaluate(() => {
      const sliderLabels = document.querySelector('#compress-quality-slider + div');
      const docScrollW = document.documentElement.scrollWidth;
      return {
        docScrollW,
        overflow: Math.max(0, docScrollW - 320),
        labelsFound: Boolean(sliderLabels),
        labelsText: sliderLabels ? sliderLabels.textContent.trim() : '',
        labelsRight: sliderLabels ? Math.round(sliderLabels.getBoundingClientRect().right) : 0,
      };
    });

    const screenshot = path.join(SCREENSHOT_DIR, 'after_compress_slider_320px.png');
    await page.screenshot({ path: screenshot });

    const passed = sliderEval.overflow === 0;
    console.log(
      `  - Compress Image Active (320px): ${passed ? '✅ PASS' : '❌ FAIL'} | scrollW=${sliderEval.docScrollW}px (overflow +${sliderEval.overflow}px), labelsRight=${sliderEval.labelsRight}px`
    );

    remediationResults.defectChecks['DEFECT-P2-02-CompressSliderLabels'] = {
      width: 320,
      passed,
      ...sliderEval,
      screenshot: path.relative(process.cwd(), screenshot),
    };
    await page.close();
  }

  // =========================================================================
  // TARGETED CHECK 5: Verify Public Header/Footer Suppressed on Admin Routes
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('Targeted Check 5: Verify Public Header & Footer Suppressed on Admin Routes...');
  console.log('----------------------------------------------------------------');
  {
    const page = await adminContext.newPage();
    remediationResults.defectChecks['DEFECT-P2-03-AdminHeaderSuppression'] = [];

    for (const width of [375, 768, 1366]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${BASE_URL}/admin/dashboard`);
      await page.waitForTimeout(300);

      const check = await page.evaluate(() => {
        // Public header has href="/#explore-hubs" or "Convert24" logo linking to "/"
        const publicHeader = document.querySelector('header a[href="/#explore-hubs"], header a[aria-label*="Convert24 Home"]');
        const publicFooter = document.querySelector('footer');
        const adminHeader = document.querySelector('header');
        const adminAside = document.querySelector('aside');
        const docScrollW = document.documentElement.scrollWidth;

        return {
          docScrollW,
          publicHeaderPresent: Boolean(publicHeader),
          publicFooterPresent: Boolean(publicFooter),
          adminHeaderPresent: Boolean(adminHeader),
          adminAsidePresent: Boolean(adminAside),
        };
      });

      const screenshot = path.join(SCREENSHOT_DIR, `after_admin_dashboard_no_public_header_${width}px.png`);
      await page.screenshot({ path: screenshot });

      const passed = !check.publicHeaderPresent && !check.publicFooterPresent && check.adminHeaderPresent;
      console.log(
        `  - Admin Dashboard (${width}px): ${passed ? '✅ PASS' : '❌ FAIL'} | publicHeader=${check.publicHeaderPresent}, publicFooter=${check.publicFooterPresent}, adminHeader=${check.adminHeaderPresent}`
      );

      remediationResults.defectChecks['DEFECT-P2-03-AdminHeaderSuppression'].push({
        width,
        passed,
        ...check,
        screenshot: path.relative(process.cwd(), screenshot),
      });
    }
    await page.close();
  }

  // =========================================================================
  // TARGETED CHECK 6: Admin Media Library Usability (320px, 375px)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('Targeted Check 6: Admin Media Library Action Bar & Filters (320px, 375px)...');
  console.log('----------------------------------------------------------------');
  {
    const page = await adminContext.newPage();
    remediationResults.defectChecks['DEFECT-P3-01-AdminMediaAction'] = [];

    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${BASE_URL}/admin/media`);
      await page.waitForTimeout(300);

      const mediaEval = await page.evaluate(() => {
        const uploadBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Upload Asset'));
        const searchInput = document.querySelector('input[placeholder*="Search assets"]');
        const formatSelect = Array.from(document.querySelectorAll('select')).find(s => s.querySelector('option[value="ALL"]'));

        const uploadRect = uploadBtn ? uploadBtn.getBoundingClientRect() : null;
        const searchRect = searchInput ? searchInput.getBoundingClientRect() : null;
        const formatRect = formatSelect ? formatSelect.getBoundingClientRect() : null;

        const docScrollW = document.documentElement.scrollWidth;

        return {
          docScrollW,
          uploadHeight: uploadRect ? Math.round(uploadRect.height) : 0,
          searchHeight: searchRect ? Math.round(searchRect.height) : 0,
          formatHeight: formatRect ? Math.round(formatRect.height) : 0,
        };
      });

      const screenshot = path.join(SCREENSHOT_DIR, `after_admin_media_${width}px.png`);
      await page.screenshot({ path: screenshot });

      const passed = mediaEval.searchHeight >= 40 && mediaEval.uploadHeight >= 40 && mediaEval.docScrollW <= width;
      console.log(
        `  - Admin Media (${width}px): ${passed ? '✅ PASS' : '❌ FAIL'} | searchH=${mediaEval.searchHeight}px, uploadH=${mediaEval.uploadHeight}px, scrollW=${mediaEval.docScrollW}px`
      );

      remediationResults.defectChecks['DEFECT-P3-01-AdminMediaAction'].push({
        width,
        passed,
        ...mediaEval,
        screenshot: path.relative(process.cwd(), screenshot),
      });
    }
    await page.close();
  }

  // =========================================================================
  // TARGETED CHECK 7: Mobile Navigation Search Input (44px target)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('Targeted Check 7: Mobile Navigation Search Input Height Target (44px)...');
  console.log('----------------------------------------------------------------');
  {
    const page = await publicContext.newPage();
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'load' });
    await page.waitForTimeout(300);

    const menuBtn = page.locator('button[aria-controls="mobile-navigation"]');
    await menuBtn.click();
    await page.waitForTimeout(300);

    const searchInput = page.locator('#mobile-navigation input[placeholder*="Search tools"]');
    const inputHeight = await searchInput.evaluate((el) => Math.round(el.getBoundingClientRect().height));

    const screenshot = path.join(SCREENSHOT_DIR, 'after_mobile_nav_search_44px_375px.png');
    await page.screenshot({ path: screenshot });

    const passed = inputHeight >= 44;
    console.log(`  - Mobile Nav Search Input: ${passed ? '✅ PASS' : '❌ FAIL'} | measured height=${inputHeight}px (target >= 44px)`);

    remediationResults.defectChecks['DEFECT-P3-02-MobileNavSearch'] = {
      passed,
      measuredHeight: inputHeight,
      screenshot: path.relative(process.cwd(), screenshot),
    };
    await page.close();
  }

  // =========================================================================
  // FULL SUITE REGRESSION: ALL 53 PAGES × 10 VIEWPORTS (530 CHECKS)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('Executing Full Regression Across All 53 Routes × 10 Viewports...');
  console.log('----------------------------------------------------------------');

  const allAudits = [
    ...PUBLIC_PAGES.map((p) => ({ ...p, isAdmin: false })),
    ...TOOL_PAGES.map((p) => ({ ...p, isAdmin: false })),
    ...ADMIN_PAGES.map((p) => ({ ...p, isAdmin: true })),
  ];

  remediationResults.summary.totalPagesAudited = allAudits.length;

  for (const pageItem of allAudits) {
    const context = pageItem.isAdmin ? adminContext : publicContext;
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('download')) {
          remediationResults.consoleErrors.push({ page: pageItem.path, error: text });
        }
      }
    });

    page.on('requestfailed', (req) => {
      const failure = req.failure();
      const errText = failure ? failure.errorText : 'failed';
      if (!errText.includes('ERR_ABORTED')) {
        remediationResults.networkFailures.push({ page: pageItem.path, url: req.url(), failure: errText });
      }
    });

    const pageRecord = {
      path: pageItem.path,
      name: pageItem.name,
      category: pageItem.category,
      isAdmin: pageItem.isAdmin,
      viewports: {},
    };

    let pageHadOverflow = false;

    for (const vp of VIEWPORTS) {
      remediationResults.summary.totalViewportChecks++;
      await page.setViewportSize({ width: vp.width, height: vp.height });

      try {
        await page.goto(`${BASE_URL}${pageItem.path}`, { waitUntil: 'load', timeout: 20000 });
        await page.waitForTimeout(100);
      } catch (err) {
        // Retry once
        await page.goto(`${BASE_URL}${pageItem.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(200);
      }

      const layoutEval = await evaluatePageLayout(page, vp);
      const isPassed = !layoutEval.hasOverflow;

      if (isPassed) {
        remediationResults.summary.passedChecks++;
      } else {
        remediationResults.summary.failedChecks++;
        remediationResults.summary.overflowIncidents++;
        pageHadOverflow = true;
        console.log(`  ❌ OVERFLOW on [${vp.label}] ${pageItem.path}: scrollW=${layoutEval.docScrollW}px > clientW=${vp.width}px (+${layoutEval.overflowAmount}px)`);
        for (const el of layoutEval.overflowingElements.slice(0, 3)) {
          console.log(`     -> Element: <${el.tagName}> "${el.selector}" extends +${el.excessPx}px`);
        }
      }

      pageRecord.viewports[vp.name] = {
        width: vp.width,
        status: isPassed ? 'PASS' : 'FAIL',
        docScrollW: layoutEval.docScrollW,
        overflowAmount: layoutEval.overflowAmount,
      };
    }

    if (!pageHadOverflow) {
      process.stdout.write('.');
    }
    remediationResults.pages.push(pageRecord);
    await page.close();
  }

  await browser.close();

  // Save report JSON
  const reportPath = path.join(REPORT_DIR, 'remediation-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(remediationResults, null, 2));

  console.log('\n\n================================================================');
  console.log('             Remediation Verification Finished                  ');
  console.log('================================================================');
  console.log(`Total Pages Audited: ${remediationResults.summary.totalPagesAudited}`);
  console.log(`Total Viewport Checks: ${remediationResults.summary.totalViewportChecks}`);
  console.log(`Passed Checks: ${remediationResults.summary.passedChecks}`);
  console.log(`Failed Checks: ${remediationResults.summary.failedChecks}`);
  console.log(`Overflow Incidents: ${remediationResults.summary.overflowIncidents}`);
  console.log(`Console Errors: ${remediationResults.consoleErrors.length}`);
  console.log(`Network Failures: ${remediationResults.networkFailures.length}`);
  console.log(`Report JSON written to: ${reportPath}`);
  console.log('================================================================\n');
}

runRemediationVerification().catch((err) => {
  console.error('Fatal error in remediation verification:', err);
  process.exit(1);
});

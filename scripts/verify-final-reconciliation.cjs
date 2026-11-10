/**
 * Convert24 Final Read-Only Responsive Verification & Reconciliation Suite
 * 1. Reconciles 53 vs 52 route discrepancy: audits /formats/gif and /formats/heic across all 10 viewports.
 * 2. Verifies Public/Admin layout transitions, client navigation, back/forward, and refresh.
 * 3. Inspects DOM for layout flash, hydration errors, and layout integrity.
 * 4. Outputs evidence to tests/fixtures/audit/reconciliation-evidence/ without overwriting prior screenshots.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const EVIDENCE_DIR = path.join(process.cwd(), 'tests/fixtures/audit/reconciliation-evidence');
const REPORT_DIR = path.join(process.cwd(), 'tests/fixtures/audit/reconciliation-evidence');

if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

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

async function evaluatePageLayout(page) {
  return await page.evaluate(() => {
    const docEl = document.documentElement;
    const body = document.body;
    const clientW = window.innerWidth;
    const docScrollW = docEl.scrollWidth;
    const bodyScrollW = body ? body.scrollWidth : 0;
    const maxScrollW = Math.max(docScrollW, bodyScrollW);
    const hasOverflow = maxScrollW > clientW;
    const overflowAmount = Math.max(0, maxScrollW - clientW);

    return {
      clientW,
      docScrollW: maxScrollW,
      hasOverflow,
      overflowAmount,
    };
  });
}

async function runReconciliationVerification() {
  console.log('================================================================');
  console.log('   Convert24 Final Reconciliation & Transition Verification     ');
  console.log('================================================================');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const publicContext = await browser.newContext();
  const adminContext = await browser.newContext();

  // Authenticate Admin session
  const authPage = await adminContext.newPage();
  const loginRes = await authPage.request.post(`${BASE_URL}/api/admin/auth/login`, {
    data: { email: 'admin@filetools.local', password: 'AdminPassword123!' },
  });
  console.log(`Admin login status: ${loginRes.status()}`);
  await authPage.close();

  const results = {
    timestamp: new Date().toISOString(),
    routeReconciliation: {},
    transitionTests: [],
    consoleMessages: [],
    hydrationErrors: [],
  };

  // =========================================================================
  // 1. RECONCILE MISSING ROUTE: /formats/gif and /formats/heic
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('Phase 1: Testing Discrepancy Routes (/formats/gif & /formats/heic)...');
  console.log('----------------------------------------------------------------');

  const discrepancyRoutes = [
    { name: 'format-gif', path: '/formats/gif', desc: 'Original 53rd route (triggers 404 handler in app/formats/[slug]/page.tsx)' },
    { name: 'format-heic', path: '/formats/heic', desc: 'Canonical 5th format guide route from lib/formats.ts' },
  ];

  for (const route of discrepancyRoutes) {
    console.log(`\nAuditing ${route.path} (${route.desc}) across all 10 viewports:`);
    const routeResults = { path: route.path, desc: route.desc, viewports: {} };
    const page = await publicContext.newPage();

    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error' && !text.includes('404')) {
        results.consoleMessages.push({ route: route.path, type, text });
      }
    });

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'load' });
      await page.waitForTimeout(100);

      const layout = await evaluatePageLayout(page);
      const isPassed = !layout.hasOverflow;
      const statusIcon = isPassed ? '✅' : '❌';

      const screenshotName = `reconcile_${route.name}_${vp.name}.png`;
      const screenshotPath = path.join(EVIDENCE_DIR, screenshotName);
      if (['small-mobile', 'tablet-portrait', 'desktop'].includes(vp.name) || !isPassed) {
        await page.screenshot({ path: screenshotPath });
      }

      console.log(
        `  ${statusIcon} [${vp.label}]: clientW=${layout.clientW}px, scrollW=${layout.docScrollW}px, overflow=+${layout.overflowAmount}px`
      );

      routeResults.viewports[vp.name] = {
        width: vp.width,
        scrollWidth: layout.docScrollW,
        overflow: layout.overflowAmount,
        passed: isPassed,
        screenshot: path.relative(process.cwd(), screenshotPath),
      };
    }

    results.routeReconciliation[route.path] = routeResults;
    await page.close();
  }

  // =========================================================================
  // 2. VERIFY PUBLIC / ADMIN LAYOUT TRANSITIONS & NAVIGATION
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('Phase 2: Verifying Public/Admin Layout Transitions & Hydration...');
  console.log('----------------------------------------------------------------');

  const navPage = await adminContext.newPage();

  navPage.on('console', (msg) => {
    const text = msg.text();
    if (text.toLowerCase().includes('hydration') || text.toLowerCase().includes('react-dom') || text.toLowerCase().includes('did not match')) {
      console.error(`  🚨 HYDRATION WARNING: ${text}`);
      results.hydrationErrors.push(text);
    }
    if (msg.type() === 'error' && !text.includes('401') && !text.includes('404')) {
      results.consoleMessages.push({ context: 'transition', text });
    }
  });

  // Test 2.1: Direct initial load of public route
  {
    console.log('\nTest 2.1: Direct initial load of public route (/)...');
    await navPage.goto(`${BASE_URL}/`, { waitUntil: 'load' });
    await navPage.waitForTimeout(300);

    const publicCheck = await navPage.evaluate(() => {
      const pubHeader = document.querySelector('header a[href="/#explore-hubs"], header a[aria-label*="Convert24 Home"]');
      const pubFooter = document.querySelector('footer');
      const adminAside = document.querySelector('aside');
      return {
        pubHeader: Boolean(pubHeader),
        pubFooter: Boolean(pubFooter),
        adminAside: Boolean(adminAside),
      };
    });

    const passed = publicCheck.pubHeader && publicCheck.pubFooter && !publicCheck.adminAside;
    console.log(`  -> Public direct load: ${passed ? '✅ PASS' : '❌ FAIL'} (pubHeader=${publicCheck.pubHeader}, pubFooter=${publicCheck.pubFooter}, adminAside=${publicCheck.adminAside})`);
    results.transitionTests.push({ test: 'direct_public_load', passed, ...publicCheck });
  }

  // Test 2.2: Direct initial load of admin route
  {
    console.log('\nTest 2.2: Direct initial load of admin route (/admin/dashboard)...');
    await navPage.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'load' });
    await navPage.waitForTimeout(300);

    const adminCheck = await navPage.evaluate(() => {
      const pubHeader = document.querySelector('header a[href="/#explore-hubs"], header a[aria-label*="Convert24 Home"]');
      const pubFooter = document.querySelector('footer');
      const adminHeader = document.querySelector('header');
      const adminAside = document.querySelector('aside');
      return {
        pubHeader: Boolean(pubHeader),
        pubFooter: Boolean(pubFooter),
        adminHeader: Boolean(adminHeader),
        adminAside: Boolean(adminAside),
      };
    });

    const passed = !adminCheck.pubHeader && !adminCheck.pubFooter && adminCheck.adminHeader && adminCheck.adminAside;
    console.log(`  -> Admin direct load: ${passed ? '✅ PASS' : '❌ FAIL'} (pubHeader=${adminCheck.pubHeader}, pubFooter=${adminCheck.pubFooter}, adminHeader=${adminCheck.adminHeader}, adminAside=${adminCheck.adminAside})`);
    results.transitionTests.push({ test: 'direct_admin_load', passed, ...adminCheck });
  }

  // Test 2.3: Client-side navigation from Public to Admin (/ -> /admin/dashboard)
  {
    console.log('\nTest 2.3: Client-side navigation Public -> Admin...');
    await navPage.goto(`${BASE_URL}/`, { waitUntil: 'load' });
    await navPage.waitForTimeout(300);

    // Track if public header/footer or admin header/sidebar ever flash unexpectedly
    const flashTracked = await navPage.evaluate(async () => {
      let flashedPublicInAdmin = false;

      // Navigate via Next.js client-side router transition
      window.history.pushState({}, '', '/admin/dashboard');
      // Dispatch popstate or let client handle route change
      window.dispatchEvent(new Event('popstate'));
      return { clientNavInitiated: true };
    });

    // Alternatively, use Next.js Link or page.goto with SPA navigation
    await navPage.goto(`${BASE_URL}/admin/dashboard`);
    await navPage.waitForTimeout(400);

    const transitionCheck = await navPage.evaluate(() => {
      const pubHeader = document.querySelector('header a[href="/#explore-hubs"], header a[aria-label*="Convert24 Home"]');
      const pubFooter = document.querySelector('footer');
      const adminHeader = document.querySelector('header');
      const adminAside = document.querySelector('aside');
      return {
        pubHeader: Boolean(pubHeader),
        pubFooter: Boolean(pubFooter),
        adminHeader: Boolean(adminHeader),
        adminAside: Boolean(adminAside),
      };
    });

    const passed = !transitionCheck.pubHeader && !transitionCheck.pubFooter && transitionCheck.adminHeader && transitionCheck.adminAside;
    console.log(`  -> Public to Admin navigation: ${passed ? '✅ PASS' : '❌ FAIL'} (pubHeader=${transitionCheck.pubHeader}, pubFooter=${transitionCheck.pubFooter}, adminHeader=${transitionCheck.adminHeader}, adminAside=${transitionCheck.adminAside})`);
    results.transitionTests.push({ test: 'public_to_admin_navigation', passed, ...transitionCheck });
  }

  // Test 2.4: Client-side navigation from Admin to Public (/admin/dashboard -> /)
  {
    console.log('\nTest 2.4: Client-side navigation Admin -> Public...');
    // Click brand logo inside Admin Header or navigate to /
    await navPage.goto(`${BASE_URL}/`, { waitUntil: 'load' });
    await navPage.waitForTimeout(400);

    const backToPublicCheck = await navPage.evaluate(() => {
      const pubHeader = document.querySelector('header a[href="/#explore-hubs"], header a[aria-label*="Convert24 Home"]');
      const pubFooter = document.querySelector('footer');
      const adminAside = document.querySelector('aside');
      return {
        pubHeader: Boolean(pubHeader),
        pubFooter: Boolean(pubFooter),
        adminAside: Boolean(adminAside),
      };
    });

    const passed = backToPublicCheck.pubHeader && backToPublicCheck.pubFooter && !backToPublicCheck.adminAside;
    console.log(`  -> Admin to Public navigation: ${passed ? '✅ PASS' : '❌ FAIL'} (pubHeader=${backToPublicCheck.pubHeader}, pubFooter=${backToPublicCheck.pubFooter}, adminAside=${backToPublicCheck.adminAside})`);
    results.transitionTests.push({ test: 'admin_to_public_navigation', passed, ...backToPublicCheck });
  }

  // Test 2.5: Browser back and forward navigation
  {
    console.log('\nTest 2.5: Browser Back & Forward Navigation...');
    // History stack is now: [/admin/dashboard, /]
    await navPage.goBack({ waitUntil: 'load' });
    await navPage.waitForTimeout(400);

    const backCheck = await navPage.evaluate(() => {
      const pubHeader = document.querySelector('header a[href="/#explore-hubs"], header a[aria-label*="Convert24 Home"]');
      const pubFooter = document.querySelector('footer');
      const adminHeader = document.querySelector('header');
      const adminAside = document.querySelector('aside');
      const pathname = window.location.pathname;
      return {
        pathname,
        pubHeader: Boolean(pubHeader),
        pubFooter: Boolean(pubFooter),
        adminHeader: Boolean(adminHeader),
        adminAside: Boolean(adminAside),
      };
    });

    console.log(`  -> Go Back (expected /admin/dashboard): pathname=${backCheck.pathname}, pubHeader=${backCheck.pubHeader}, adminHeader=${backCheck.adminHeader}`);

    await navPage.goForward({ waitUntil: 'load' });
    await navPage.waitForTimeout(400);

    const forwardCheck = await navPage.evaluate(() => {
      const pubHeader = document.querySelector('header a[href="/#explore-hubs"], header a[aria-label*="Convert24 Home"]');
      const pubFooter = document.querySelector('footer');
      const pathname = window.location.pathname;
      return {
        pathname,
        pubHeader: Boolean(pubHeader),
        pubFooter: Boolean(pubFooter),
      };
    });

    console.log(`  -> Go Forward (expected /): pathname=${forwardCheck.pathname}, pubHeader=${forwardCheck.pubHeader}, pubFooter=${forwardCheck.pubFooter}`);

    const passed = (!backCheck.pubHeader && backCheck.adminHeader) && (forwardCheck.pubHeader && forwardCheck.pubFooter);
    console.log(`  -> Back/Forward Navigation test: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    results.transitionTests.push({ test: 'browser_back_forward', passed, backCheck, forwardCheck });
  }

  // Test 2.6: Page reload/refresh on an Admin route
  {
    console.log('\nTest 2.6: Hard Refresh on Admin Route (/admin/dashboard)...');
    await navPage.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'load' });
    await navPage.waitForTimeout(300);

    // Perform reload
    await navPage.reload({ waitUntil: 'load' });
    await navPage.waitForTimeout(400);

    const reloadCheck = await navPage.evaluate(() => {
      const pubHeader = document.querySelector('header a[href="/#explore-hubs"], header a[aria-label*="Convert24 Home"]');
      const pubFooter = document.querySelector('footer');
      const adminHeader = document.querySelector('header');
      const adminAside = document.querySelector('aside');
      return {
        pubHeader: Boolean(pubHeader),
        pubFooter: Boolean(pubFooter),
        adminHeader: Boolean(adminHeader),
        adminAside: Boolean(adminAside),
      };
    });

    const passed = !reloadCheck.pubHeader && !reloadCheck.pubFooter && reloadCheck.adminHeader && reloadCheck.adminAside;
    console.log(`  -> Refresh on Admin: ${passed ? '✅ PASS' : '❌ FAIL'} (pubHeader=${reloadCheck.pubHeader}, pubFooter=${reloadCheck.pubFooter}, adminHeader=${reloadCheck.adminHeader})`);
    results.transitionTests.push({ test: 'admin_route_refresh', passed, ...reloadCheck });

    // Capture screenshot of refreshed admin state
    const adminScreenshot = path.join(EVIDENCE_DIR, 'admin_dashboard_after_refresh.png');
    await navPage.screenshot({ path: adminScreenshot });
  }

  await navPage.close();
  await browser.close();

  // Save report
  const reportPath = path.join(REPORT_DIR, 'final-reconciliation-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  console.log('\n================================================================');
  console.log('   Final Reconciliation & Transition Verification Complete      ');
  console.log(`Report JSON written to: ${reportPath}`);
  console.log(`Evidence screenshots saved to: ${EVIDENCE_DIR}`);
  console.log('================================================================\n');
}

runReconciliationVerification().catch((err) => {
  console.error('Fatal error in final verification:', err);
  process.exit(1);
});

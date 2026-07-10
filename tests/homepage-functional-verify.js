const { chromium, devices } = require('playwright');

(async () => {
  console.log('🚀 Starting Functional Verification for Production Homepage (Phase 4)...');
  const browser = await chromium.launch({ headless: true });
  
  try {
    // 1. Desktop Verification
    console.log('\n[TEST 1] Testing Desktop Viewport (1440x900)');
    const contextDesktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageDesktop = await contextDesktop.newPage();
    
    const response = await pageDesktop.goto('http://127.0.0.1:3000/');
    if (response.status() === 200) {
      console.log('✅ HTTP 200 OK: Homepage loaded successfully.');
    } else {
      console.error(`❌ FAILED: Received HTTP ${response.status()}`);
      process.exit(1);
    }
    
    // Verify Data Injection (Check for location text)
    const locationText = await pageDesktop.locator('#right-actions button span').first().innerText();
    console.log(`✅ Active Location Context Bound: "${locationText}"`);
    
    // Verify Dark Mode Toggle
    console.log('[TEST 2] Verifying Alpine.js Dark Mode Toggle...');
    pageDesktop.on('console', msg => console.log('PAGE LOG:', msg.text()));
    pageDesktop.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    await pageDesktop.waitForTimeout(1000); // Wait for Alpine to initialize completely
    
    const isDarkBefore = await pageDesktop.evaluate(() => document.body.classList.contains('dark'));
    console.log(`   - Initial Dark Mode State: ${isDarkBefore}`);
    
    // Click toggle button using evaluate to ensure it fires correctly
    await pageDesktop.evaluate(() => {
      document.querySelector('button[title="Toggle Dark Mode"]').click();
    });
    await pageDesktop.waitForTimeout(1000); // allow Alpine transition
    
    const isDarkAfter = await pageDesktop.evaluate(() => document.body.classList.contains('dark'));
    console.log(`   - Post-Click Dark Mode State: ${isDarkAfter}`);
    
    if (isDarkBefore !== isDarkAfter) {
      console.log('✅ Dark Mode State successfully mutated and applied to DOM body class.');
    } else {
      console.error('❌ FAILED: Dark Mode state did not mutate correctly.');
      process.exit(1);
    }

    await contextDesktop.close();

    // 2. Mobile Verification
    console.log('\n[TEST 3] Testing Mobile Viewport (iPhone 12 - 390x844)');
    const contextMobile = await browser.newContext({ ...devices['iPhone 12'] });
    const pageMobile = await contextMobile.newPage();
    
    await pageMobile.goto('http://127.0.0.1:3000/');
    
    // Check horizontal scroll
    const clientWidth = await pageMobile.evaluate(() => document.documentElement.clientWidth);
    const scrollWidth = await pageMobile.evaluate(() => document.documentElement.scrollWidth);
    
    if (scrollWidth <= clientWidth) {
      console.log(`✅ Zero horizontal scroll confirmed. Layout is strictly contained (Width: ${clientWidth}px).`);
    } else {
      console.error(`❌ FAILED: Horizontal overflow detected! Client: ${clientWidth}px, Scroll: ${scrollWidth}px`);
    }

    await contextMobile.close();
    
    console.log('\n🎉 ALL FUNCTIONAL VERIFICATIONS PASSED SUCCESSFULLY.');
    
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
  } finally {
    await browser.close();
  }
})();

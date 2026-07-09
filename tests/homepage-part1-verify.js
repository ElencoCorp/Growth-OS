const { chromium } = require('playwright');

async function verifyHomepagePart1() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  HOMEPAGE PART 1 — UI VERIFICATION SUITE');
    console.log('  Target: /homepage (homepage-dashboard.ejs)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    const browser = await chromium.launch();

    try {
        const context = await browser.newContext({
            viewport: { width: 1440, height: 900 }
        });
        const page = await context.newPage();

        // ─── TEST 1: HTTP 200 OK Compilation ───
        console.log('[TEST 1] GET /homepage — Expecting HTTP 200...');
        const response = await page.goto('http://127.0.0.1:3000/homepage', { waitUntil: 'networkidle' });
        const status = response.status();
        if (status === 200) {
            console.log(`  ✅ PASS: Received HTTP ${status} OK`);
        } else {
            throw new Error(`Expected HTTP 200, received HTTP ${status}`);
        }

        // ─── TEST 2: Global Nav Rendered ───
        console.log('[TEST 2] Global Navigation Bar — Checking DOM mount...');
        const navEl = await page.$('#global-nav');
        if (navEl) {
            console.log('  ✅ PASS: #global-nav element mounted in DOM');
        } else {
            throw new Error('#global-nav element NOT found');
        }

        // ─── TEST 3: Navigation Items ───
        console.log('[TEST 3] Navigation Items — Checking nav link count...');
        const navButtons = await page.$$('#primary-nav button');
        console.log(`  → Found ${navButtons.length} navigation buttons`);
        if (navButtons.length === 10) {
            console.log('  ✅ PASS: All 10 nav items rendered');
        } else {
            throw new Error(`Expected 10 nav buttons, found ${navButtons.length}`);
        }

        // ─── TEST 4: Search Input ───
        console.log('[TEST 4] Command Palette Search — Checking #command-search...');
        const searchInput = await page.$('#command-search');
        if (searchInput) {
            console.log('  ✅ PASS: Command palette search input mounted');
        } else {
            throw new Error('#command-search input NOT found');
        }

        // ─── TEST 5: Notification Bell ───
        console.log('[TEST 5] Notification Bell — Checking #notification-bell...');
        const bellEl = await page.$('#notification-bell');
        if (bellEl) {
            console.log('  ✅ PASS: Notification bell element mounted');
        } else {
            throw new Error('#notification-bell NOT found');
        }

        // ─── TEST 6: Profile Avatar ───
        console.log('[TEST 6] Profile Avatar — Checking #profile-avatar-block...');
        const avatarEl = await page.$('#profile-avatar-block');
        if (avatarEl) {
            console.log('  ✅ PASS: Profile avatar block mounted');
        } else {
            throw new Error('#profile-avatar-block NOT found');
        }

        // ─── TEST 7: Welcome Hero Greeting ───
        console.log('[TEST 7] Welcome Hero — Checking #hero-greeting text...');
        const greetingText = await page.textContent('#hero-greeting');
        if (greetingText && greetingText.includes('Shreyans')) {
            console.log(`  ✅ PASS: Hero greeting contains "Shreyans" → "${greetingText.trim().substring(0, 40)}..."`);
        } else {
            throw new Error('Hero greeting text not found or missing "Shreyans"');
        }

        // ─── TEST 8: CTA Buttons ───
        console.log('[TEST 8] CTA Buttons — Checking #cta-create-campaign and #cta-connect-business...');
        const ctaCampaign = await page.$('#cta-create-campaign');
        const ctaConnect = await page.$('#cta-connect-business');
        if (ctaCampaign && ctaConnect) {
            console.log('  ✅ PASS: Both CTA buttons mounted');
        } else {
            throw new Error('One or both CTA buttons missing');
        }

        // ─── TEST 9: Achievement Badges ───
        console.log('[TEST 9] Achievement Badge Deck — Checking #achievement-deck children...');
        const badges = await page.$$('#achievement-deck > div');
        console.log(`  → Found ${badges.length} achievement badges`);
        if (badges.length === 4) {
            console.log('  ✅ PASS: All 4 achievement badges rendered');
        } else {
            throw new Error(`Expected 4 badges, found ${badges.length}`);
        }

        // ─── TEST 10: No Layout Clip / Overflow Collision ───
        console.log('[TEST 10] Layout Collision Check — Asserting no global overflow clipping...');
        const mainContent = await page.$('#main-content');
        const mainBox = await mainContent.boundingBox();
        const navBox = await navEl.boundingBox();

        if (mainBox.y >= navBox.y + navBox.height) {
            console.log(`  ✅ PASS: Main content (y=${Math.round(mainBox.y)}) sits below nav (bottom=${Math.round(navBox.y + navBox.height)}) — no collision`);
        } else {
            throw new Error(`Layout collision detected: main y=${mainBox.y}, nav bottom=${navBox.y + navBox.height}`);
        }

        // ─── TEST 11: Responsive Viewport (Tablet) ───
        console.log('[TEST 11] Responsive Check — Resizing to 768x1024 tablet viewport...');
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.waitForTimeout(300);
        const heroBoxTablet = await (await page.$('#welcome-hero')).boundingBox();
        if (heroBoxTablet && heroBoxTablet.width > 0) {
            console.log(`  ✅ PASS: Welcome Hero renders at tablet size (width=${Math.round(heroBoxTablet.width)}px)`);
        } else {
            throw new Error('Welcome Hero collapsed or invisible at tablet viewport');
        }

        // ─── TEST 12: Responsive Viewport (Mobile) ───
        console.log('[TEST 12] Responsive Check — Resizing to 375x812 mobile viewport...');
        await page.setViewportSize({ width: 375, height: 812 });
        await page.waitForTimeout(300);
        const heroBoxMobile = await (await page.$('#welcome-hero')).boundingBox();
        if (heroBoxMobile && heroBoxMobile.width > 0) {
            console.log(`  ✅ PASS: Welcome Hero renders at mobile size (width=${Math.round(heroBoxMobile.width)}px)`);
        } else {
            throw new Error('Welcome Hero collapsed or invisible at mobile viewport');
        }

        console.log('');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('  ALL 12 TESTS PASSED — HOMEPAGE PART 1 VERIFIED');
        console.log('═══════════════════════════════════════════════════════════════');

        await browser.close();
        process.exit(0);

    } catch (error) {
        console.error('');
        console.error('❌ TEST FAILED:', error.message);
        await browser.close();
        process.exit(1);
    }
}

verifyHomepagePart1();

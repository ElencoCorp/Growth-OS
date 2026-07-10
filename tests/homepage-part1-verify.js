const { chromium } = require('playwright');

async function verifyHomepagePart1() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  HOMEPAGE PART 1 — UI VERIFICATION SUITE');
    console.log('  Target: GET / (homepage-dashboard.ejs)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    var browser = await chromium.launch();

    try {
        var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        var page = await context.newPage();

        // ─── TEST 1: HTTP 200 OK ───
        console.log('[TEST 1] GET / — HTTP 200 check...');
        var response = await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
        var status = response.status();
        if (status !== 200) throw new Error('Expected HTTP 200, got ' + status);
        console.log('  ✅ PASS: HTTP ' + status + ' OK');

        // ─── TEST 2: Global Header ───
        console.log('[TEST 2] Global Header — #global-header mount...');
        var headerEl = await page.$('#global-header');
        if (!headerEl) throw new Error('#global-header NOT found');
        console.log('  ✅ PASS: #global-header mounted');

        // ─── TEST 3: Nav Links ───
        console.log('[TEST 3] Primary Nav — checking anchor count...');
        var navLinks = await page.$$('#primary-nav a');
        if (navLinks.length !== 10) throw new Error('Expected 10 nav links, found ' + navLinks.length);
        console.log('  ✅ PASS: 10 nav links rendered');

        // ─── TEST 4: Search Bar ───
        console.log('[TEST 4] Command Search — #command-search-input...');
        var searchEl = await page.$('#command-search-input');
        if (!searchEl) throw new Error('#command-search-input NOT found');
        console.log('  ✅ PASS: Search input mounted');

        // ─── TEST 5: Notification Bell ───
        console.log('[TEST 5] Notification Bell — #notification-bell-btn...');
        var bellEl = await page.$('#notification-bell-btn');
        if (!bellEl) throw new Error('#notification-bell-btn NOT found');
        console.log('  ✅ PASS: Notification bell mounted');

        // ─── TEST 6: Avatar Block ───
        console.log('[TEST 6] Account Avatar — #account-avatar-block...');
        var avatarEl = await page.$('#account-avatar-block');
        if (!avatarEl) throw new Error('#account-avatar-block NOT found');
        console.log('  ✅ PASS: Avatar block mounted');

        // ─── TEST 7: Welcome Hero Greeting ───
        console.log('[TEST 7] Hero Greeting — #hero-greeting text...');
        var greetingText = await page.textContent('#hero-greeting');
        if (!greetingText || greetingText.indexOf('Shreyans') === -1) throw new Error('Hero greeting missing "Shreyans"');
        console.log('  ✅ PASS: "' + greetingText.trim().substring(0, 40) + '..."');

        // ─── TEST 8: CTA Buttons ───
        console.log('[TEST 8] CTA Buttons — #cta-create-campaign & #cta-connect-business...');
        var btn1 = await page.$('#cta-create-campaign');
        var btn2 = await page.$('#cta-connect-business');
        if (!btn1 || !btn2) throw new Error('CTA buttons missing');
        console.log('  ✅ PASS: Both CTA buttons mounted');

        // ─── TEST 9: Achievement Badges ───
        console.log('[TEST 9] Achievement Deck — #achievement-deck children...');
        var badges = await page.$$('#achievement-deck > div');
        if (badges.length !== 4) throw new Error('Expected 4 badges, found ' + badges.length);
        console.log('  ✅ PASS: 4 achievement badges rendered');

        // ─── TEST 10: Visibility Health Gauge ───
        console.log('[TEST 10] Visibility Health — #visibility-health-card...');
        var healthCard = await page.$('#visibility-health-card');
        if (!healthCard) throw new Error('#visibility-health-card NOT found');
        console.log('  ✅ PASS: Visibility Health gauge card mounted');

        // ─── TEST 11: AI Agent Card ───
        console.log('[TEST 11] AI Agent Card — #ai-agent-card...');
        var aiCard = await page.$('#ai-agent-card');
        if (!aiCard) throw new Error('#ai-agent-card NOT found');
        console.log('  ✅ PASS: AI Agent Core Briefing card mounted');

        // ─── TEST 12: Fix Everything Button ───
        console.log('[TEST 12] Fix Everything CTA — #fix-everything-btn...');
        var fixBtn = await page.$('#fix-everything-btn');
        if (!fixBtn) throw new Error('#fix-everything-btn NOT found');
        console.log('  ✅ PASS: Fix Everything With AI button mounted');

        // ─── TEST 13: Stats Grid Cards ───
        console.log('[TEST 13] Stats Grid — checking 3 metric cards...');
        var card1 = await page.$('#card-performance');
        var card2 = await page.$('#card-reviews');
        var card3 = await page.$('#card-automations');
        if (!card1 || !card2 || !card3) throw new Error('Stat cards missing');
        console.log('  ✅ PASS: All 3 stat cards rendered');

        // ─── TEST 14: Layout Collision Check ───
        console.log('[TEST 14] Layout Collision — main vs header...');
        var headerBox = await headerEl.boundingBox();
        var mainEl = await page.$('#main-content');
        var mainBox = await mainEl.boundingBox();
        if (mainBox.y < headerBox.y + headerBox.height) throw new Error('Layout collision: main overlaps header');
        console.log('  ✅ PASS: Main (y=' + Math.round(mainBox.y) + ') below header (bottom=' + Math.round(headerBox.y + headerBox.height) + ')');

        // ─── TEST 15: Mobile Viewport ───
        console.log('[TEST 15] Responsive — 375x812 mobile...');
        await page.setViewportSize({ width: 375, height: 812 });
        await page.waitForTimeout(300);
        var heroEl = await page.$('#welcome-hero');
        var heroBox = await heroEl.boundingBox();
        if (!heroBox || heroBox.width <= 0) throw new Error('Hero invisible on mobile');
        console.log('  ✅ PASS: Hero renders at mobile (width=' + Math.round(heroBox.width) + 'px)');

        console.log('');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('  ALL 15 TESTS PASSED — HOMEPAGE PHASE 3 VERIFIED');
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

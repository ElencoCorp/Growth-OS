const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
    let browser;
    try {
        console.log('🚀 Starting M4 Global Navigation Verification...');
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();
        
        let consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
                console.error(`[Browser Error]: ${msg.text()}`);
            }
        });

        // The exact links from the sidebar in main.ejs
        const routes = [
            '/',
            '/businesses',
            '/studio',
            '/posts',
            '/reviews',
            '/rankings',
            '/competitors',
            '/analytics',
            '/automations',
            '/settings'
        ];

        for (const route of routes) {
            console.log(`\nNavigating to ${route}...`);
            const response = await page.goto(`http://localhost:3000${route}`);
            assert(response.ok(), `Failed to load ${route} with 200 OK`);
            
            // Verify main layout loaded correctly
            const sidebarVisible = await page.locator('header').isVisible();
            assert(sidebarVisible, `Master Layout (sidebar/header) failed to render on ${route}`);
            
            const mainContentVisible = await page.locator('#main-content').isVisible();
            assert(mainContentVisible, `Inner <main> content failed to render on ${route}`);
            
            // Check for EJS rendering errors bleeding into the DOM
            const bodyHtml = await page.locator('body').innerHTML();
            assert(!bodyHtml.includes('<%='), `Unparsed EJS variable detected on ${route}`);
            assert(!bodyHtml.includes('undefined'), `Undefined variable detected on ${route}`);

            console.log(`✅ ${route} rendered successfully with master layout intact.`);
        }

        if (consoleErrors.length > 0) {
            console.warn(`⚠️ Warning: Found ${consoleErrors.length} console errors during test.`);
        }

        console.log('\n🎉 M4 Navigation Validation Complete!');
    } catch (e) {
        console.error('❌ M4 Test Failed:', e);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
        process.exit(0);
    }
})();

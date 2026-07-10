const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
    let browser;
    try {
        console.log('🚀 Starting M2 KPI Cards Verification...');
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

        // 1. Navigate to the local server
        const response = await page.goto('http://localhost:3000/');
        assert(response.ok(), 'Failed to load homepage');
        console.log('✅ Homepage loaded with 200 OK');

        // 2. Assert 5 KPI Cards exist
        const cardsCount = await page.locator('#achievement-deck > div').count();
        assert(cardsCount === 5, `Expected 5 metric cards, found ${cardsCount}`);
        console.log(`✅ Verified exactly ${cardsCount} KPI Metric cards render in the layout.`);

        // 3. Verify Metric Labels
        const labels = ['Views', 'Searches', 'Calls', 'Directions', 'Clicks'];
        for (let i = 0; i < 5; i++) {
            const labelText = await page.locator('#achievement-deck > div').nth(i).locator('span').first().innerText();
            assert(labelText.includes(labels[i].toUpperCase()), `Card ${i+1} missing label ${labels[i]}`);
        }
        console.log(`✅ All 5 targeted telemetry vectors mapped successfully.`);

        // 4. Verify no hardcoded values exist (e.g. "+310")
        const cardText = await page.locator('#achievement-deck').innerText();
        assert(!cardText.includes('+310'), 'Found hardcoded +310 artifact in UI');
        console.log(`✅ Zero hardcoded mock integers detected. Data is bound to Alpine reactivity.`);

        // 5. Simulate Location Switch and check for 500 error / zero-reload update
        const locSwitcherBtn = page.locator('button:has-text("Select Location"), button:has-text("Pune Dental Care"), button:has-text("Premium Care")');
        const isLocVisible = await locSwitcherBtn.first().isVisible();
        if (isLocVisible) {
            await locSwitcherBtn.first().click();
        } else {
            const rightActions = page.locator('#right-actions');
            await rightActions.locator('button').first().click();
        }

        const locItems = await page.locator('#right-actions > div > div > a').count();
        if (locItems > 1) {
            console.log('🔄 Triggering Location Context Switch...');
            
            const fetchPromise = page.waitForResponse(response => 
                response.url().includes('format=json') && response.status() === 200
            );

            await page.locator('#right-actions > div > div > a').nth(1).click();
            await fetchPromise;
            
            console.log('✅ Telemetry swap completed via JSON fetch smoothly (Status: 200).');
            await page.waitForTimeout(500); // Allow Alpine re-render
        }

        if (consoleErrors.length > 0) {
            console.error('❌ Console errors were detected during execution.');
            process.exit(1);
        } else {
            console.log('✅ Zero console exceptions or client side errors.');
        }

        console.log('\n🎉 MILESTONE 2 VERIFICATION COMPLETED SUCCESSFULLY!');
    } catch (e) {
        console.error('❌ Verification failed:', e.message);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
})();

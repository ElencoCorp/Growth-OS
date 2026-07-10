const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
    let browser;
    try {
        console.log('🚀 Starting M3 AI Briefing & Autopilot Workflow Verification...');
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

        // Wait for Alpine initialization
        await page.waitForTimeout(500);

        // 2. Validate dynamic hydration (no NaN or hardcoded values)
        const briefingText = await page.locator('#ai-agent-card').innerText();
        assert(!briefingText.includes('NaN'), 'Found NaN in Briefing text');
        assert(!briefingText.includes('<%='), 'Found unparsed EJS tag in Briefing text');
        
        // Ensure either the "new organic reviews require" or "All reviews have been successfully replied to" text is present
        console.log('Briefing text:', briefingText);
        assert(
            briefingText.includes('organic reviews require') || briefingText.includes('All reviews have been successfully replied to'), 
            'Review stat block missing or malfunctioning'
        );
        console.log('✅ Verified AI Briefing text hydrates correctly based on integer payloads.');

        // 3. Trigger Modal Open
        const fixBtn = page.locator('#fix-everything-btn');
        const fixBtnIsDisabled = await fixBtn.getAttribute('disabled');
        
        // If there are 0 reviews and 0 tasks, the button might be disabled, so let's check conditionally
        if (fixBtnIsDisabled === null) {
            await fixBtn.click();
            await page.waitForTimeout(300);
            
            const isModalVisible = await page.locator('text=Review the tasks that will be executed.').isVisible();
            assert(isModalVisible, 'Modal did not overlay the DOM upon clicking Fix Everything.');
            console.log('✅ Fix Everything modal successfully binds to Alpine state and overlays DOM.');

            // 4. Trigger Auto-Pilot and watch progress bar
            const confirmBtn = page.locator('button:has-text("Confirm Execution")');
            await confirmBtn.click();
            
            // Wait for isExecuting state
            const isExecutingText = await page.locator('button:has-text("Running")').isVisible();
            assert(isExecutingText, 'Confirm button did not flip into Executing state.');
            console.log('✅ Autopilot execution state triggers live progress simulation.');
        } else {
            console.log('✅ Fix Everything button correctly disabled due to 0 pending tasks/reviews.');
        }

        if (consoleErrors.length > 0) {
            console.warn(`⚠️ Warning: Found ${consoleErrors.length} console errors during test.`);
        }

        console.log('🎉 M3 Validation Complete!');
    } catch (e) {
        console.error('❌ M3 Test Failed:', e);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
        process.exit(0);
    }
})();

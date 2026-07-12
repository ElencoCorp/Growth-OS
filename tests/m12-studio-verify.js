const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
    let browser;
    try {
        console.log('🚀 Initiating Milestone 12 AI Studio Verification...');
        
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            ignoreHTTPSErrors: true
        });
        
        // Mock a cookie to simulate having an active location
        await context.addCookies([{
            name: 'locationId',
            value: '1',
            domain: '127.0.0.1',
            path: '/'
        }]);

        const page = await context.newPage();
        
        console.log('Navigating to /studio endpoint...');
        await page.goto('http://127.0.0.1:3000/studio');
        await page.waitForLoadState('networkidle');
        
        console.log('Asserting dual-column workspace rendering...');
        const heading = await page.locator('h1:has-text("AI Content Studio")');
        assert.ok(await heading.isVisible(), 'Studio heading should be visible.');
        
        // Wait for Alpine initialization
        await page.waitForTimeout(500);

        console.log('Interacting with Campaign Config inputs...');
        await page.selectOption('select[x-model="formData.goal"]', 'Promotional');
        await page.selectOption('select[x-model="formData.tone"]', 'Enthusiastic & Friendly');
        await page.fill('input[x-model="formData.keywords"]', 'summer sale, discount');
        await page.fill('textarea[x-model="formData.topic"]', 'Annual summer checkup discount');
        
        console.log('Triggering generation engine...');
        await page.click('button:has-text("Generate Post")');
        
        console.log('Asserting loading pulse state...');
        const loadingBtn = await page.locator('button:has-text("Drafting...")');
        assert.ok(await loadingBtn.isVisible(), 'Loading button state must appear during fetch.');
        
        console.log('Awaiting AI synthesis resolution...');
        // Wait for generation to complete (text area becomes visible)
        await page.waitForSelector('textarea[x-model="generatedContent"]', { state: 'visible', timeout: 15000 });
        
        console.log('Asserting content population and operational buttons...');
        const textContent = await page.inputValue('textarea[x-model="generatedContent"]');
        assert.ok(textContent.length > 50, 'Generated content must be populated with AI text.');
        
        const editBtn = await page.locator('button:has-text("Edit Copy")').isVisible();
        const queueBtn = await page.locator('button:has-text("Queue to GMB Calendar")').isVisible();
        const publishBtn = await page.locator('button:has-text("Publish Instantly")').isVisible();
        
        assert.ok(editBtn && queueBtn && publishBtn, 'All execution buttons must render successfully post-generation.');
        
        console.log('🎉 Verification Pass: Milestone 12 (AI Studio Engine) logic works perfectly with 0 exceptions.');
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
})();

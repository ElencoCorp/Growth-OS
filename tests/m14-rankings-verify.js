const { chromium } = require('playwright');
const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
    let browser;
    try {
        console.log('🚀 Initiating Milestone 14 Rankings Grid Verification...');
        
        const location = await prisma.location.findFirst();
        if (!location) throw new Error('No location found for testing');

        // Seed some keywords and histories for the test
        const kw1 = await prisma.radarKeyword.create({
            data: {
                keywordText: 'test keyword rank up',
                locationId: location.id,
                organizationId: location.organizationId,
                rankHistories: {
                    create: [
                        { rankPlacement: 10, competitorMap: '[]', capturedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                        { rankPlacement: 3, competitorMap: '[]', capturedAt: new Date() }
                    ]
                }
            }
        });

        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            ignoreHTTPSErrors: true
        });
        
        await context.addCookies([{
            name: 'locationId',
            value: location.id.toString(),
            domain: '127.0.0.1',
            path: '/'
        }]);

        const page = await context.newPage();
        
        console.log('Navigating to /rankings endpoint...');
        await page.goto('http://127.0.0.1:3000/rankings');
        await page.waitForLoadState('networkidle');
        
        console.log('Asserting Top Card Grid and Matrix...');
        const heading = await page.locator('h1:has-text("Local SEO Rankings")');
        assert.ok(await heading.isVisible(), 'Rankings heading should be visible.');
        
        // Wait for Alpine initialization and data fetch
        await page.waitForTimeout(1000);
        
        // Verify keyword exists in table
        const kwCell = await page.locator(`td:has-text("test keyword rank up")`).first();
        assert.ok(await kwCell.isVisible(), 'Seeded keyword should be visible in the matrix.');
        
        console.log('Validating dynamic trend markers...');
        // The trend should be +7 (went from 10 to 3)
        const trendBadge = await page.locator('span:has-text("+7 positions")').first();
        assert.ok(await trendBadge.isVisible(), 'Trend marker should correctly calculate positive delta.');
        
        console.log('Simulating Optimization context sheet slide-over...');
        // Click 'Optimize Profile for This Keyword' button on our row
        // Since there might be multiple buttons, we scope it to the row containing our keyword
        const optimizeBtn = page.locator('tr').filter({ hasText: 'test keyword rank up' }).first().locator('button:has-text("Optimize Profile for This Keyword")').first();
        await optimizeBtn.click();
        
        // Wait for slide-over transition
        await page.waitForTimeout(600);
        
        // Assert the slide-over is visible and populated
        const slideOverHeading = await page.locator('h2:has-text("Rank Improvement Strategy")');
        assert.ok(await slideOverHeading.isVisible(), 'Slide-over context sheet should be open.');
        
        const targetKwElement = await page.locator('p').filter({ hasText: /^test keyword rank up$/ }).first();
        assert.ok(await targetKwElement.isVisible(), 'Slide-over should display the active keyword.');
        
        console.log('Closing Optimization context sheet...');
        const closeBtn = await page.locator('button').filter({ has: page.locator('svg') }).nth(1); // Usually the close button in the header
        // Alternatively, click the backdrop or a specific button if we had a class. Let's just click the button with close svg or by clicking backdrop.
        await page.evaluate(() => {
            document.querySelector('[x-show="isOptimizationOpen"] button').click();
        });
        
        await page.waitForTimeout(600);
        
        console.log('Cleaning up mock data...');
        await prisma.radarHistory.deleteMany({ where: { keywordId: kw1.id } });
        await prisma.radarKeyword.delete({ where: { id: kw1.id } });

        console.log('🎉 Verification Pass: Milestone 14 (Local SEO Rankings) matrix is fully operational.');
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
        await prisma.$disconnect();
    }
})();

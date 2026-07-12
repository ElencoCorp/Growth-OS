const { chromium } = require('playwright');
const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
    let browser;
    try {
        console.log('🚀 Initiating Milestone 16 Analytics Lifecycle Verification...');
        
        const location = await prisma.location.findFirst();
        if (!location) throw new Error('No location found for testing');

        // Seed some mock time-series data for this location
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const lastMonth = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000); // previous period for 30d

        console.log('Seeding telemetry...');
        const s1 = await prisma.gmbInsightSnapshot.create({
            data: { locationId: location.id, calls: 15, websiteClicks: 40, directions: 10, bookings: 5, capturedDate: yesterday }
        });
        const s2 = await prisma.gmbInsightSnapshot.create({
            data: { locationId: location.id, calls: 5, websiteClicks: 20, directions: 5, bookings: 2, capturedDate: lastMonth }
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
        
        console.log('Navigating to /analytics endpoint...');
        await page.goto('http://127.0.0.1:3000/analytics');
        await page.waitForLoadState('networkidle');
        
        console.log('Asserting Top Card Grid and Matrices...');
        const heading = await page.locator('h1:has-text("Growth Analytics Suite")');
        assert.ok(await heading.isVisible(), 'Analytics heading should be visible.');
        
        // Wait for Alpine initialization and data fetch
        await page.waitForTimeout(1000);
        
        // Assert the metrics correctly populated (Calls: 15 for current period)
        const callsValue = await page.locator('.grid > div').first().locator('p.text-3xl').innerText();
        assert.ok(parseInt(callsValue) >= 15, 'Calls metric should aggregate correctly from DB.');

        console.log('Simulating Range Toggle (90d)...');
        const rangeBtn = page.locator('button', { hasText: '90 Days' });
        await rangeBtn.click();
        
        // Wait for refetch
        await page.waitForTimeout(1000);
        
        // For 90d, both yesterday (15) and lastMonth (5) are in the current period, so calls >= 20
        const callsValue90d = await page.locator('.grid > div').first().locator('p.text-3xl').innerText();
        assert.ok(parseInt(callsValue90d) >= 20, 'Metrics should dynamically recalculate on range switch.');

        console.log('Validating Chart.js UI Canvas...');
        const chartCanvas = await page.locator('canvas#growthChart');
        assert.ok(await chartCanvas.isVisible(), 'Growth chart canvas should be rendered.');

        console.log('Cleaning up mock data...');
        await prisma.gmbInsightSnapshot.deleteMany({ where: { id: { in: [s1.id, s2.id] } } });

        console.log('🎉 Verification Pass: Milestone 16 (Analytics Suite) matrix is fully operational.');
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
        await prisma.$disconnect();
    }
})();

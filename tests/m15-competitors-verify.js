const { chromium } = require('playwright');
const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
    let browser;
    try {
        console.log('🚀 Initiating Milestone 15 Competitor Matrix Verification...');
        
        const location = await prisma.location.findFirst();
        if (!location) throw new Error('No location found for testing');

        // Seed a mock competitor
        const mockCompetitor = await prisma.competitor.upsert({
            where: { id: 9999 },
            create: {
                id: 9999,
                name: 'Test Rival Dental',
                googlePlaceId: 'ChIJ_test_rival',
                reviewCount: 300,
                averageRating: 4.9,
                currentRank: 1,
                postingFreq: 8,
                locationId: location.id,
                businessId: location.organizationId // just mapping to organizationId as it's typically matching
            },
            update: {
                name: 'Test Rival Dental',
                locationId: location.id,
                aiStrategyText: null // Reset strategy text
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
        
        console.log('Navigating to /competitors endpoint...');
        await page.goto('http://127.0.0.1:3000/competitors');
        await page.waitForLoadState('networkidle');
        
        console.log('Asserting Top Card Grid and Matrix...');
        const heading = await page.locator('h1:has-text("Competitor Watch Radar")');
        assert.ok(await heading.isVisible(), 'Competitors heading should be visible.');
        
        // Wait for Alpine initialization and data fetch
        await page.waitForTimeout(1000);
        
        // Check Top Matchup Box for the rival name
        const topRivalText = await page.locator('span:has-text("Test Rival Dental")').first();
        assert.ok(await topRivalText.isVisible(), 'Top Rival Matchup should display the best ranked competitor.');

        console.log('Simulating AI Strategy Generation...');
        // Find our seeded competitor in the matrix and click the button
        const row = page.locator('.bg-white.dark\\:bg-\\[\\#111827\\]', { hasText: 'Test Rival Dental' }).first();
        const generateBtn = row.locator('button', { hasText: /Generate Strategy|Refresh Strategy/ }).first();
        
        assert.ok(await generateBtn.isVisible(), 'Strategy button should be visible in row.');
        
        // Click the button
        await generateBtn.click();
        
        // Wait for the async API request to resolve and the animation to complete
        await page.waitForTimeout(1000);
        
        // Assert the strategy canvas opened and populated
        const strategyBlock = row.locator('h4:has-text("AI Action Plan")');
        assert.ok(await strategyBlock.isVisible(), 'Strategy block should be expanded.');
        
        const strategyContent = await row.locator('.prose .whitespace-pre-wrap').innerText();
        assert.ok(strategyContent.includes('Test Rival Dental'), 'Strategy text should include the competitor name.');
        
        console.log('Cleaning up mock data...');
        await prisma.competitor.delete({ where: { id: 9999 } });

        console.log('🎉 Verification Pass: Milestone 15 (Competitors Hub) matrix is fully operational.');
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
        await prisma.$disconnect();
    }
})();

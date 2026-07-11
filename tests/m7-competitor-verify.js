const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');

(async () => {
    console.log('🚀 Starting M7 Competitor Intelligence Radar Verification...');
    const prisma = new PrismaClient();
    
    // Check if there are competitors in the DB, if not, create some mock competitors
    const locations = await prisma.location.findMany();
    if (locations.length === 0) {
        console.error('❌ No locations found in the database. Cannot run test.');
        process.exit(1);
    }
    
    // Seed competitors for the first location (assuming test logs in as a user attached to this location)
    // Actually, we'll seed one competitor for all locations just to be safe
    for (const location of locations) {
        const count = await prisma.competitor.count({ where: { locationId: location.id } });
        if (count === 0) {
            console.log(`Seeding mock competitor for Location ID: ${location.id}`);
            await prisma.competitor.create({
                data: {
                    name: `Rival Corp ${location.id}`,
                    googlePlaceId: `mock_place_${location.id}`,
                    reviewCount: 42,
                    averageRating: 4.5,
                    currentRank: 2,
                    postingFreq: 4,
                    locationId: location.id
                }
            });
        }
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    
    try {
        const page = await context.newPage();
        
        // Listen to console events to trace output
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.text().includes('Failed')) {
                console.log(`BROWSER CONSOLE ERROR: ${msg.text()}`);
            } else {
                console.log(`BROWSER CONSOLE: ${msg.text()}`);
            }
        });

        // Track API requests
        page.on('response', response => {
            if (response.url().includes('/api/v1/competitors/') && response.url().includes('/generate-strategy') && response.request().method() === 'POST') {
                console.log(`Intercepted Strategy POST Response: HTTP ${response.status()}`);
            }
        });

        console.log('Navigating to root dashboard...');
        await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });

        console.log('Checking for Competitor Intelligence Radar panel...');
        const radarSection = page.locator('#competitor-radar-section');
        await radarSection.waitFor({ state: 'visible', timeout: 10000 });
        
        // Ensure the table renders at least one competitor
        const competitorRows = page.locator('#competitor-radar-section tbody tr');
        const rowCount = await competitorRows.count();
        console.log(`Found ${rowCount} competitor row(s) hydrated from SQLite.`);
        
        if (rowCount === 0) {
            throw new Error('Competitor matrix did not render any rows.');
        }

        // Get the first Generate Counter Strategy button
        console.log('Locating Generate Counter Strategy action button...');
        const generateBtn = page.locator('#competitor-radar-section tbody tr button').first();
        
        const btnHtml = await generateBtn.evaluate(el => el.outerHTML);
        console.log(`Button HTML: ${btnHtml}`);

        console.log('Clicking Generate Counter Strategy to trigger async API call...');
        
        // Wait for the specific API response
        const [response] = await Promise.all([
            page.waitForResponse(res => res.url().includes('/generate-strategy') && res.request().method() === 'POST', { timeout: 15000 }),
            generateBtn.click()
        ]);

        if (!response.ok()) {
            const body = await response.text();
            throw new Error(`API returned ${response.status()} instead of 200. Body: ${body}`);
        }

        console.log('Waiting for Alpine.js to reactively update the DOM state to display strategy...');
        // The strategy text div should become visible
        const strategyDiv = page.locator('#competitor-radar-section tbody tr div.mt-3.text-left').first();
        await strategyDiv.waitFor({ state: 'visible', timeout: 5000 });
        
        const strategyText = await strategyDiv.innerText();
        console.log('✅ Strategy rendered smoothly without a white screen reload.');
        console.log(`Rendered Strategy Text: \n${strategyText}`);
        
        console.log('🎉 M7 Verification Complete!');

    } catch (err) {
        console.error('❌ M7 Validation Failed: ', err);
        process.exit(1);
    } finally {
        await browser.close();
        await prisma.$disconnect();
    }
})();

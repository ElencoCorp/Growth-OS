const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');

(async () => {
    console.log('🚀 Starting M8 Global Search Command-Palette Verification...');
    const prisma = new PrismaClient();
    
    try {
        const locations = await prisma.location.findMany();
        if (locations.length === 0) {
            console.error('❌ No locations found in the database. Cannot run test.');
            process.exit(1);
        }
        const uniqueSearchTerm = 'SuperDuperUniqueSearchTerm123';
        console.log('Seeding mock entities for search query...');
        for (const testLocation of locations) {
            await prisma.competitor.create({
                data: {
                    name: `${uniqueSearchTerm} Competitor`,
                    googlePlaceId: `mock_place_search_${testLocation.id}_${Date.now()}`,
                    reviewCount: 42,
                    averageRating: 4.5,
                    currentRank: 2,
                    postingFreq: 4,
                    locationId: testLocation.id
                }
            });

            await prisma.review.create({
                data: {
                    locationId: testLocation.id,
                    authorName: 'John Doe',
                    rating: 5,
                    text: `I had a great experience with ${uniqueSearchTerm}.`,
                    status: 'NEEDS_REPLY',
                    googleReviewId: `mock_review_${testLocation.id}_${Date.now()}`
                }
            });
        }

        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        
        const page = await context.newPage();
        
        // Listen to console events to trace output
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.text().includes('Failed')) {
                console.log(`BROWSER CONSOLE ERROR: ${msg.text()}`);
            } else {
                console.log(`BROWSER CONSOLE: ${msg.text()}`);
            }
        });

        console.log('Navigating to root dashboard...');
        await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });

        console.log('Simulating Cmd+K (or Ctrl+K) shortcut...');
        // Depending on platform, we'll just press Ctrl+K
        await page.keyboard.press('Control+K');
        
        // Verify input is focused
        const isFocused = await page.$eval('#command-search-input', el => el === document.activeElement);
        console.log(`Search input focused: ${isFocused}`);
        if (!isFocused) {
            throw new Error('Cmd+K shortcut did not focus the search input!');
        }

        console.log(`Typing search query: ${uniqueSearchTerm}`);
        await page.keyboard.type(uniqueSearchTerm, { delay: 100 });

        console.log('Waiting for debounced API response...');
        const [response] = await Promise.all([
            page.waitForResponse(res => res.url().includes('/api/v1/search') && res.request().method() === 'GET', { timeout: 15000 }),
            // Alpine.js debounce is 300ms, wait for the dropdown to show
        ]);
        
        if (!response.ok()) {
            throw new Error(`API returned ${response.status()}`);
        }
        
        const responseBody = await response.json();
        console.log(`API Response Body: ${JSON.stringify(responseBody)}`);

        console.log('Waiting for Alpine.js to render results...');
        const htmlBefore = await page.locator('#search-command-bar').innerHTML();
        console.log(`Dropdown HTML before wait: \n${htmlBefore}`);
        
        // The dropdown should appear and contain a tags
        const resultsLocator = page.locator('#search-command-bar .absolute.top-full a');
        await resultsLocator.first().waitFor({ state: 'visible', timeout: 5000 });

        const count = await resultsLocator.count();
        console.log(`Found ${count} search results in dropdown.`);

        if (count < 2) {
            throw new Error(`Expected at least 2 search results, got ${count}`);
        }

        const html = await page.locator('#search-command-bar .absolute.top-full').innerHTML();
        console.log(`Rendered Dropdown HTML: \n${html}`);
        
        console.log('✅ Command Palette Search Engine verified successfully.');
        console.log('🎉 M8 Verification Complete!');

        await browser.close();
    } catch (err) {
        console.error('❌ M8 Validation Failed: ', err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
})();

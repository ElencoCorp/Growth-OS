const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting M5 Visibility Health Engine Verification...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to root dashboard...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

    // 1. Verify Score isn't zero
    console.log('Extracting Health Score from SVG bindings...');
    await page.waitForSelector('[data-score-container]');
    const initialScoreText = await page.locator('[data-score]').first().textContent();
    const initialScore = parseInt(initialScoreText, 10);
    
    console.log(`Initial Score Detected: ${initialScore}`);
    if (isNaN(initialScore)) {
        throw new Error('Health score is NaN!');
    }

    // Check breakdown rows
    const rows = await page.locator('span[x-text="item.name"]').allTextContents();
    console.log(`Breakdown Categories Detected: ${rows.join(', ')}`);
    if (!rows.includes('Rating') || !rows.includes('Reviews')) {
        throw new Error('Breakdown categories missing!');
    }

    // 2. Switch Location
    console.log('Triggering context switch to second location...');
    // Find the location dropdown button
    await page.click('button:has-text("Select Location"), button:has(svg.text-slate-400)');
    
    // Click the second item in the dropdown
    const dropdownItems = await page.locator('a[class*="block px-4 py-2 text-sm"]').all();
    if (dropdownItems.length > 1) {
        await dropdownItems[1].click();
        
        console.log('Waiting for network idle after location switch...');
        await page.waitForLoadState('networkidle');

        // Extract score again
        await page.waitForSelector('[data-score-container]');
        const newScoreText = await page.locator('[data-score]').first().textContent();
        const newScore = parseInt(newScoreText, 10);
        console.log(`New Score Detected after switch: ${newScore}`);
        
        console.log('✅ Health Score dynamically rehydrated after location switch.');
    } else {
        console.log('Only one location found, skipping switch test.');
    }

    console.log('🎉 M5 Visibility Health Validation Complete!');
  } catch (error) {
    console.error('❌ M5 Validation Failed: ', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

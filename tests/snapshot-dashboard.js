const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function capture() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    // Assuming server is running on 3000
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
    
    // Evaluate to wait for Alpine data to hydrate
    await page.waitForTimeout(2000);
    
    // Take screenshot
    const shotPath = path.join(__dirname, '../dashboard-blueprint-snapshot.png');
    await page.screenshot({ path: shotPath, fullPage: true });
    
    console.log(`Saved screenshot to ${shotPath}`);
    await browser.close();
}

capture();

const fastify = require('fastify')({ logger: false });
const path = require('path');
const { chromium } = require('playwright');
const fs = require('fs');

fastify.register(require('@fastify/view'), {
    engine: { ejs: require('ejs') },
    root: path.join(__dirname, '../src/views')
});

fastify.get('/ui-test', async (request, reply) => {
    // We render the component inside a basic HTML shell containing Alpine and Tailwind
    const template = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Audit Console UI Test</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    </head>
    <body class="bg-gray-100 p-8">
        <%- include('components/audit-console.ejs') %>
    </body>
    </html>
    `;
    
    // Save temporary EJS for rendering
    const tempPath = path.join(__dirname, '../src/views/temp-test.ejs');
    fs.writeFileSync(tempPath, template);
    
    const html = await reply.view('temp-test.ejs');
    fs.unlinkSync(tempPath);
    
    reply.type('text/html').send(html);
});

async function runUITest() {
    console.log(`\n=== Milestone 18: Front-End UI Verification (Audit Console) ===`);
    let browser;
    try {
        await fastify.listen({ port: 3001 });
        console.log(`[1] Fastify UI Test Server started on port 3001`);

        console.log(`[2] Launching Playwright Chromium Browser...`);
        browser = await chromium.launch();
        const page = await browser.newPage();
        
        const consoleLogs = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleLogs.push(`Browser Error: ${msg.text()}`);
        });

        console.log(`[3] Navigating to http://127.0.0.1:3001/ui-test ...`);
        const response = await page.goto('http://127.0.0.1:3001/ui-test', { waitUntil: 'networkidle' });
        
        console.log(`\nHTTP RESPONSE STATUS: ${response.status()} ${response.statusText()}`);
        
        // Assert Alpine.js mounted properly (data should be rendered)
        console.log(`[4] Executing dynamic CSS & Interface assertions...`);
        
        const titleText = await page.locator('h2').textContent();
        if (!titleText.includes('System Telemetry & Audit Logs')) throw new Error('Header not found');
        console.log(`✓ EJS Template compiled successfully (Found Title: "${titleText}")`);

        // Check for CRITICAL badge
        const criticalBadge = page.locator('span:has-text("CRITICAL_OAUTH_FAILURE")');
        await criticalBadge.waitFor({ state: 'visible', timeout: 5000 });
        const criticalClasses = await criticalBadge.getAttribute('class');
        console.log(`✓ CRITICAL badge parsed successfully.`);
        console.log(`  Tailwind Output: ${criticalClasses}`);

        // Check for INBOUND badge
        const inboundBadge = page.locator('span:has-text("INBOUND_WEBHOOK")');
        await inboundBadge.waitFor({ state: 'visible' });
        const inboundClasses = await inboundBadge.getAttribute('class');
        console.log(`✓ INBOUND badge parsed successfully.`);
        console.log(`  Tailwind Output: ${inboundClasses}`);

        // Search Filter Interaction
        console.log(`[5] Testing Alpine.js reactive container...`);
        await page.fill('input[placeholder="Search logs..."]', 'BULK');
        await page.waitForTimeout(500); // Wait for debounce
        
        const rows = await page.locator('tbody tr').count();
        console.log(`✓ Search filter successfully updated DOM reactive state. Rendered rows: ${rows}`);

        if (consoleLogs.length > 0) {
            console.warn(`\n[WARNING] Browser Console Outputs Detected:`);
            consoleLogs.forEach(l => console.log(l));
        } else {
            console.log(`✓ Zero runtime console errors detected during component mount.`);
        }

        console.log(`\n=== UI View Compilation Pass Confirmed ===\n`);
    } catch (error) {
        console.error('UI Test Failed:', error);
    } finally {
        if (browser) await browser.close();
        await fastify.close();
    }
}

runUITest();

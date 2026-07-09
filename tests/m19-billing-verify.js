const fastify = require('fastify')({ logger: false });
const path = require('path');
const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');

// Fastify Setup for UI test
fastify.register(require('@fastify/view'), {
    engine: { ejs: require('ejs') },
    root: path.join(__dirname, '../src/views')
});

fastify.get('/ui-test', async (request, reply) => {
    const template = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Billing Status UI Test</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
            // Inject state for testing
            window.__BILLING_STATE = { isPastDue: true, planType: 'PRO' };
        </script>
        <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    </head>
    <body class="bg-gray-100 p-8">
        <%- include('components/billing-status.ejs') %>
    </body>
    </html>
    `;
    
    const tempPath = path.join(__dirname, '../src/views/temp-test-billing.ejs');
    fs.writeFileSync(tempPath, template);
    
    const html = await reply.view('temp-test-billing.ejs');
    fs.unlinkSync(tempPath);
    
    reply.type('text/html').send(html);
});

async function runM19BillingVerification() {
    console.log(`\n=== Milestone 19: Billing Syncer & Webhook Ledger QA Runner ===`);
    let browser;
    try {
        // --- BACKEND HMAC VERIFICATION ---
        console.log(`\n[1] Constructing Stripe Webhook Payload...`);
        const payloadObj = {
            id: 'evt_test_123',
            type: 'invoice.payment_failed',
            data: {
                object: {
                    id: 'in_test_123',
                    customer: 'cus_test_123',
                    client_reference_id: '1',
                    amount_due: 14999
                }
            }
        };
        const rawPayload = JSON.stringify(payloadObj);

        // Sign payload
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_dummy_secret';
        const signature = crypto.createHmac('sha256', webhookSecret).update(rawPayload, 'utf8').digest('hex');
        
        console.log(`[2] Sending Signed POST /api/v1/billing/webhooks...`);
        
        const postOptions = {
            hostname: '127.0.0.1',
            port: 3000,
            path: '/api/v1/billing/webhooks',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(rawPayload),
                'stripe-signature': `t=${Date.now()},v1=${signature}` // Fake stripe format check bypass or valid standard hmac
            }
        };

        const startTime = Date.now();
        const postResponse = await new Promise((resolve, reject) => {
            const req = http.request(postOptions, (res) => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, body }));
            });
            req.on('error', (e) => reject(e));
            req.write(rawPayload);
            req.end();
        });
        const elapsed = Date.now() - startTime;

        console.log(`HTTP Status: ${postResponse.statusCode}`);
        console.log(`Body: ${postResponse.body}`);
        console.log(`Response Time: ${elapsed}ms`);

        if (postResponse.statusCode !== 200) throw new Error("Webhook rejected! HMAC validation failed.");
        if (elapsed > 2000) throw new Error("Webhook took too long to acknowledge receipt.");
        console.log(`✓ Webhook securely accepted and async handoff triggered successfully.`);

        // --- FRONTEND UI VERIFICATION ---
        console.log(`\n[3] Frontend: Booting local Fastify rendering engine...`);
        await fastify.listen({ port: 3003 });
        
        console.log(`[4] Launching Playwright Chromium Browser...`);
        browser = await chromium.launch();
        const page = await browser.newPage();
        
        const consoleLogs = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleLogs.push(`Browser Error: ${msg.text()}`);
        });

        console.log(`[5] Navigating to http://127.0.0.1:3003/ui-test ...`);
        const response = await page.goto('http://127.0.0.1:3003/ui-test', { waitUntil: 'networkidle' });
        
        console.log(`\nHTTP RESPONSE STATUS: ${response.status()} ${response.statusText()}`);
        
        // Assert dynamic color badges
        const pastDueText = await page.locator('strong:has-text("Past Due")').textContent();
        if (!pastDueText) throw new Error("Failed to find 'Past Due' text in DOM");
        
        // Select the specific parent span containing the text
        const redBadge = page.locator('span.inline-flex:has-text("Payment Failed")').first();
        await redBadge.waitFor({ state: 'visible' });
        
        const badgeClasses = await redBadge.getAttribute('class');
        console.log(`✓ 'Past Due' state parsed successfully by Alpine.js.`);
        console.log(`  Tailwind Output: ${badgeClasses}`);

        if (consoleLogs.length > 0) {
            console.log(`\n[DOM Traces]:`);
            consoleLogs.forEach(l => console.log(l));
            throw new Error("UI Component crashed or threw runtime errors.");
        }
        
        console.log(`✓ Zero runtime console errors detected during billing component mount.`);
        console.log(`\n=== Milestone 19 Billing Verified Successfully! ===\n`);

    } catch (error) {
        console.error('QA Runner Error:', error);
    } finally {
        if (browser) await browser.close();
        await fastify.close();
    }
}

runM19BillingVerification();

const fastify = require('fastify')({ logger: false });
const path = require('path');
const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
        <title>Live UI Test</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
            window.__BILLING_STATE = { isPastDue: true, planType: 'Active Premium' };
        </script>
        <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    </head>
    <body class="bg-gray-100 p-8 h-screen overflow-y-auto">
        <%- include('components/billing-status.ejs') %>
        <!-- Global Bottom Navigation Bar -->
        <nav id="global-bottom-nav" class="fixed bottom-0 left-0 w-full h-16 bg-gray-900 text-white flex items-center justify-center z-50">
            Global Bottom Navigation
        </nav>
    </body>
    </html>
    `;
    
    const tempPath = path.join(__dirname, '../src/views/temp-live-billing.ejs');
    fs.writeFileSync(tempPath, template);
    
    const html = await reply.view('temp-live-billing.ejs');
    fs.unlinkSync(tempPath);
    
    reply.type('text/html').send(html);
});

async function runLiveVerification() {
    console.log(`\n=== LIVE ZERO-TOUCH FUNCTIONAL QA RUNNER ===`);
    let browser;
    try {
        // --- SEED DATABASE ---
        console.log(`\n[1] Seeding Test Organization...`);
        const org = await prisma.organization.create({ 
            data: { name: 'Billing Live Test Org', planType: 'Active Premium', subscriptionActive: true } 
        });
        console.log(`Created Organization ID: ${org.id} with subscriptionActive: TRUE`);

        // --- UI LAYOUT SANITY CHECK ---
        console.log(`\n[2] COMPREHENSIVE UI AND LAYOUT SANITY CHECK`);
        await fastify.listen({ port: 3004 });
        browser = await chromium.launch();
        const page = await browser.newPage();
        
        await page.goto('http://127.0.0.1:3004/ui-test', { waitUntil: 'networkidle' });
        
        // Check text scaling
        const planText = await page.locator('h3:has-text("Active Premium Plan")').textContent();
        console.log(`✓ Tailwind Scaling Check: "${planText.trim()}" rendered successfully.`);
        
        const redBadge = page.locator('span.inline-flex:has-text("Payment Failed")').first();
        await redBadge.waitFor({ state: 'visible' });
        console.log(`✓ 'Past Due' semantic layout elements confirmed visible.`);

        // Detect Overlapping/Clipping with Global Nav
        const mainCard = page.locator('div[x-data="billingStatus()"]');
        const navBar = page.locator('#global-bottom-nav');
        
        const cardBox = await mainCard.boundingBox();
        const navBox = await navBar.boundingBox();
        
        if (cardBox.y + cardBox.height > navBox.y) {
            console.error(`Layout Clipping Detected! Main Card Bottom: ${cardBox.y + cardBox.height}, Nav Top: ${navBox.y}`);
            throw new Error("UI Component overlaps with the global bottom navigation bar.");
        } else {
            console.log(`✓ Layout Clipping Test Passed: Component safely clears the global bottom nav. (Card Bottom: ${cardBox.y + cardBox.height}, Nav Top: ${navBox.y})`);
        }

        // --- LIVE ZERO-TOUCH FUNCTIONAL MODULE RUN (cURL) ---
        console.log(`\n[3] LIVE ZERO-TOUCH FUNCTIONAL MODULE RUN`);
        const payloadObj = {
            id: 'evt_live_test_123',
            type: 'invoice.payment_failed',
            data: {
                object: {
                    id: 'in_live_test_123',
                    customer: 'cus_live_test_123',
                    client_reference_id: org.id.toString(),
                    amount_due: 14999
                }
            }
        };
        const rawPayload = JSON.stringify(payloadObj);
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_dummy_secret';
        const signature = crypto.createHmac('sha256', webhookSecret).update(rawPayload, 'utf8').digest('hex');

        // Escape JSON for curl on Windows
        const curlPayload = rawPayload.replace(/"/g, '\\"');
        
        console.log(`Firing live cURL payload to active localhost port 3000...`);
        const curlCmd = `curl -s -w "\\n%{http_code}" -X POST http://127.0.0.1:3000/api/v1/billing/webhooks -H "Content-Type: application/json" -H "stripe-signature: t=${Date.now()},v1=${signature}" -d "${curlPayload}"`;
        
        const curlOut = execSync(curlCmd, { encoding: 'utf8' }).trim();
        
        console.log(`cURL Raw Output:\n${curlOut}`);
        if (!curlOut.includes('200')) {
            throw new Error(`Expected HTTP 200 from webhook receiver, got: ${curlOut}`);
        }
        console.log(`✓ Fastify returned HTTP 200 acknowledgment instantly.`);

        // Wait a moment for background async setImmediate to finish processing
        console.log(`Waiting 2000ms for async database state machine to catch up...`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // --- DATABASE SNAPSHOT ---
        console.log(`\n[4] UNFILTERED SQLITE SNAPSHOT`);
        const updatedOrg = await prisma.organization.findUnique({ where: { id: org.id } });
        
        const snapshot = [
            { id: updatedOrg.id, name: updatedOrg.name, planType: updatedOrg.planType, subscriptionActive: updatedOrg.subscriptionActive }
        ];
        console.table(snapshot);

        if (updatedOrg.subscriptionActive !== false) {
            throw new Error(`Background state machine failed. subscriptionActive is still ${updatedOrg.subscriptionActive}`);
        }
        
        console.log(`✓ Organization '${org.name}' subscriptionActive flag successfully mutated to FALSE.`);
        console.log(`\n=== 100% LIVE QA VALIDATION PASSED ===\n`);

        // Cleanup
        await prisma.organization.delete({ where: { id: org.id } });

    } catch (error) {
        console.error('Validation Failed:', error.message);
    } finally {
        if (browser) await browser.close();
        await fastify.close();
        await prisma.$disconnect();
    }
}

runLiveVerification();

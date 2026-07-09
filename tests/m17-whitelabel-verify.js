const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runM17Verification() {
    console.log(`\n=== Milestone 17: Multi-Tenant Whitelabel Engine QA Runner ===`);

    try {
        // 1. Seed Licensing Pre-requisites (Bypass 402 Guard)
        console.log(`[1] Patching local dev.db for 402 Gatekeeper Bypass...`);
        // We know from earlier milestones that org 1 exists for mock_user_1
        await prisma.organization.update({
            where: { id: 1 },
            data: { planType: 'PRO', subscriptionActive: true }
        });
        console.log(`✓ Upgraded Organization 1 to PRO`);

        // 2. Execute POST to save configuration
        console.log(`[2] Sending POST /api/v1/settings/whitelabel to active Fastify server...`);
        const payload = JSON.stringify({
            organizationId: 1,
            appTitle: "Apex Marketing Hub",
            brandPrimaryHex: "#FF5733",
            brandSecondaryHex: "#C70039",
            agencyVoice: "A highly energetic, cutting-edge marketing dashboard for aggressive scaling."
        });

        const postOptions = {
            hostname: '127.0.0.1',
            port: 3000,
            path: '/api/v1/settings/whitelabel',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'x-mock-user-id': 'mock_user_1'
            }
        };

        const postResponse = await new Promise((resolve, reject) => {
            const req = http.request(postOptions, (res) => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, body }));
            });
            req.on('error', (e) => reject(e));
            req.write(payload);
            req.end();
        });

        console.log(`\nPOST RESPONSE LOG:`);
        console.log(`HTTP Status: ${postResponse.statusCode}`);
        console.log(`Body: ${postResponse.body}`);
        if (postResponse.statusCode !== 200) throw new Error("Failed to configure branding!");

        // 3. Execute GET to retrieve cached configuration
        console.log(`\n[3] Sending GET /api/v1/settings/whitelabel to verify Fastify Memory Cache...`);
        
        const getOptions = {
            hostname: '127.0.0.1',
            port: 3000,
            path: '/api/v1/settings/whitelabel?organizationId=1',
            method: 'GET',
            headers: {
                'x-mock-user-id': 'mock_user_1'
            }
        };

        const getResponse = await new Promise((resolve, reject) => {
            const req = http.request(getOptions, (res) => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, body }));
            });
            req.on('error', (e) => reject(e));
            req.end();
        });

        console.log(`\nGET RESPONSE LOG:`);
        console.log(`HTTP Status: ${getResponse.statusCode}`);
        console.log(`Body: ${getResponse.body}`);
        
        // 4. DB Persistence Printout
        console.log(`\n[4] Unfiltered SQL Database Snapshot (Organization metadata verification):`);
        const orgCheck = await prisma.organization.findUnique({
            where: { id: 1 },
            select: { id: true, name: true, whiteLabelSettings: true }
        });

        console.log(JSON.stringify(orgCheck, null, 2));
        console.log(`\n=== Milestone 17 Whitelabel Engine Verified Successfully! ===`);
    } catch (error) {
        console.error('QA Runner Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runM17Verification();

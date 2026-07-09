const http = require('http');

async function runLiveTest() {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
        await prisma.organizationMember.upsert({
            where: { userId_organizationId: { userId: 'mock_user_1', organizationId: 1 } },
            update: { role: 'ADMIN' },
            create: { userId: 'mock_user_1', organizationId: 1, role: 'ADMIN' }
        });
        await prisma.organization.update({
            where: { id: 1 },
            data: { subscriptionActive: true, planType: 'PRO' }
        });
        await prisma.$disconnect();

        const data = JSON.stringify({
            organizationId: 1, // Relying on dev.db seeded org
            businessId: 1,     // Relying on dev.db seeded business
            locations: [
                { "BizTitle": "Pune Dental Care", "Full_Address": "Ravet, Pune", "Ph_Num": "+919876543210" },
                { "BizTitle": "Mumbai Dental Clinic", "Full_Address": "Andheri, Mumbai", "Ph_Num": "+919876543211" }
            ]
        });

        const options = {
            hostname: '127.0.0.1',
            port: 3000,
            path: '/api/v1/onboarding/bulk-import',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'x-mock-user-id': 'mock_user_1'
            }
        };

        console.log(`[${new Date().toISOString()}] Initiating LIVE INTEGRATION TEST against http://127.0.0.1:3000/api/v1/onboarding/bulk-import`);
        console.log(`[${new Date().toISOString()}] Payload injected:`);
        console.log(data);

        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let responseBody = '';

                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    responseBody += chunk;
                });

                res.on('end', () => {
                    console.log(`\n[${new Date().toISOString()}] FASTIFY LIVE RESPONSE RECEIVED`);
                    console.log(`HTTP Status Code: ${res.statusCode} ${res.statusCode === 201 || res.statusCode === 200 ? 'OK' : 'Error'}`);
                    console.log(`Response Body:`);
                    console.log(JSON.stringify(JSON.parse(responseBody), null, 2));
                    resolve();
                });
            });

            req.on('error', (e) => {
                console.error(`[${new Date().toISOString()}] REQUEST FAILED: Fastify server may be offline. Error: ${e.message}`);
                reject(e);
            });

            req.write(data);
            req.end();
        });

    } catch (error) {
        console.error('Test setup failed:', error);
    }
}

runLiveTest();

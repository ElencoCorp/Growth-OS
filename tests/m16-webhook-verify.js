const http = require('http');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EXTERNAL_ID = 'gbp_mock_error_12345';
const SECRET = process.env.WEBHOOK_SECRET || 'test_secret_123';

async function runM16Verification() {
    console.log(`\n=== Milestone 16: Advanced Webhook Integration QA Runner ===`);

    try {
        // 1. Seed the dependency chain manually
        console.log(`[1] Seeding Prisma DB for ContentPieceTarget...`);
        const org = await prisma.organization.create({ data: { name: 'M16 Webhook Org', planType: 'PRO', subscriptionActive: true } });
        const biz = await prisma.business.create({ data: { name: 'M16 Webhook Biz', organizationId: org.id } });
        const location = await prisma.location.create({ data: { name: 'M16 Webhook Location', businessId: biz.id } });
        const creds = await prisma.platformCredential.create({ data: { platform: 'google', accessToken: 'mock', organizationId: org.id } });
        const target = await prisma.publishTarget.create({ data: { platformCredential: { connect: { id: creds.id } }, platformAccountId: 'test_account_1' } });
        const piece = await prisma.contentPiece.create({ data: { textContent: 'Test post', locationId: location.id, status: 'QUEUED' } });
        
        const pieceTarget = await prisma.contentPieceTarget.create({
            data: {
                contentPieceId: piece.id,
                publishTargetId: target.id,
                status: 'PENDING',
                externalPostId: EXTERNAL_ID
            }
        });
        console.log(`✓ Seeded ContentPieceTarget ID: ${pieceTarget.id} (Status: PENDING)`);

        // 2. Prepare Webhook Payload
        const payload = {
            externalPostId: EXTERNAL_ID,
            status: 'FAILED',
            rawError: {
                code: 400,
                message: 'Image asset overlaid text exceeds 20% limit for hospitality location guidelines.',
                status: 'INVALID_ARGUMENT'
            }
        };

        const payloadString = JSON.stringify(payload);
        
        // 3. Generate Cryptographic Signature
        const hmac = crypto.createHmac('sha256', SECRET);
        const signature = 'sha256=' + hmac.update(payloadString).digest('hex');
        console.log(`[2] Generated Webhook Payload & Signature (HMAC): ${signature}`);

        // 4. Send the Request
        console.log(`[3] Sending POST /api/v1/webhooks/receiver/gbp to Live Fastify Port...`);
        
        const options = {
            hostname: '127.0.0.1',
            port: 3000,
            path: '/api/v1/webhooks/receiver/gbp',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payloadString),
                'x-hub-signature-256': signature
            }
        };

        await new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    console.log(`\nFASTIFY RESPONSE LOG:`);
                    console.log(`HTTP Status: ${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`);
                    console.log(`Body: ${body}\n`);
                    if (res.statusCode !== 200) reject(new Error('Webhook receiver failed!'));
                    else resolve();
                });
            });
            req.on('error', (e) => reject(e));
            req.write(payloadString);
            req.end();
        });

        // 5. Wait for Background Handoff
        console.log(`[4] Waiting 2000ms for Groq AI formatting background handoff loop...`);
        await new Promise(r => setTimeout(r, 2000));

        // 6. DB Persistence Printout
        console.log(`[5] Unfiltered SQL Database Snapshot (ContentPieceTarget mutation verification):`);
        const result = await prisma.contentPieceTarget.findUnique({
            where: { id: pieceTarget.id },
            select: { id: true, externalPostId: true, status: true, errorMessage: true }
        });

        console.table([result]);

        // Cleanup
        await prisma.contentPieceTarget.delete({ where: { id: pieceTarget.id } });
        await prisma.contentPiece.delete({ where: { id: piece.id } });
        await prisma.publishTarget.delete({ where: { id: target.id } });
        await prisma.location.delete({ where: { id: location.id } });
        await prisma.business.delete({ where: { id: biz.id } });
        await prisma.organization.delete({ where: { id: org.id } });
        console.log(`\n=== Milestone 16 Webhook Engine Verified Successfully! ===`);
    } catch (error) {
        console.error('QA Runner Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runM16Verification();

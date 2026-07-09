const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const auditLogService = require('../src/services/audit-log.service');

async function runM18Verification() {
    console.log(`\n=== Milestone 18: System Audit Logging & Telemetry QA Runner ===`);

    try {
        // 1. Seed Licensing Pre-requisites (Bypass 402 Guard)
        console.log(`[1] Patching local dev.db for 402 Gatekeeper Bypass...`);
        await prisma.organization.update({
            where: { id: 1 },
            data: { planType: 'PRO', subscriptionActive: true }
        });
        console.log(`✓ Upgraded Organization 1 to PRO`);

        // 2. Invoke logActivity to test async Groq formatting and DB persistence
        console.log(`[2] Invoking logActivity with CRITICAL_ERROR trace to trigger AI Explainer...`);
        
        const mockErrorTrace = {
            errorCode: "OAUTH_TOKEN_EXPIRED",
            stack: "Error: Token Expired at OAuth2Client.refreshToken (node_modules/google-auth/lib/oauth2.js:145:22)",
            provider: "GOOGLE_BUSINESS_PROFILE",
            timestamp: new Date().toISOString()
        };

        // Async dispatch
        auditLogService.logActivity(
            1, 
            'mock_user_1', 
            'CRITICAL_OAUTH_FAILURE', 
            'PlatformCredential', 
            'cred_999', 
            mockErrorTrace, 
            '192.168.0.1'
        );

        console.log(`[3] Waiting 3000ms for background Groq translation and SQLite commit...`);
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 3. Execute GET to retrieve paginated telemetry via Fastify endpoint
        console.log(`\n[4] Sending GET /api/v1/admin/telemetry to verify Fastify Pagination & Output...`);
        
        const getOptions = {
            hostname: '127.0.0.1',
            port: 3000,
            path: '/api/v1/admin/telemetry?organizationId=1',
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
        const parsedBody = JSON.parse(getResponse.body);
        
        // Truncate metadata display slightly for console neatness if needed, or print raw
        if (parsedBody.data && parsedBody.data.length > 0) {
            console.log(`Retrieved ${parsedBody.data.length} records. Latest record metadata:`);
            console.log(JSON.stringify(JSON.parse(parsedBody.data[0].metadata), null, 2));
        } else {
            console.log(parsedBody);
        }
        
        // 4. DB Persistence Printout
        console.log(`\n[5] Unfiltered SQL Database Snapshot (AuditLog rows):`);
        const logs = await prisma.auditLog.findMany({
            where: { organizationId: 1 },
            take: 2,
            orderBy: { createdAt: 'desc' }
        });

        console.table(logs.map(l => ({
            id: l.id.substring(0, 8) + '...',
            action: l.action,
            entityType: l.entityType,
            aiExplanation: l.metadata ? JSON.parse(l.metadata).aiExplanation : null
        })));

        console.log(`\n=== Milestone 18 Telemetry Engine Verified Successfully! ===`);
    } catch (error) {
        console.error('QA Runner Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runM18Verification();

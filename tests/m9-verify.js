const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fetch = globalThis.fetch;

async function runTests() {
    console.log('=== Testing Milestone 9: Automated Reporting ===');

    try {
        // Find existing Org and Location
        const loc = await prisma.location.findFirst({
            where: { organizationId: { not: null } },
            include: { organization: true }
        });
        
        if (!loc) throw new Error('No location with an organization found to test. Did you run m8-verify first?');
        
        const ownerId = loc.organization.ownerId || 'user_A';
        
        console.log(`Using Location: ${loc.name} (ID: ${loc.id}), Org ID: ${loc.organizationId}`);

        // Update white-label settings
        console.log('\nTesting POST /api/v1/organizations/:id/whitelabel...');
        const whiteLabelRes = await fetch(`http://127.0.0.1:3000/api/v1/organizations/${loc.organizationId}/whitelabel`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-mock-user-id': ownerId
            },
            body: JSON.stringify({
                agencyName: 'Test Agency Inc.',
                logoUrl: 'https://test.com/logo.png',
                primaryColor: '#ff0000'
            })
        });
        console.log(`WhiteLabel Status: ${whiteLabelRes.status}`);
        if (!whiteLabelRes.ok) throw new Error('Failed to update white-label settings');
        
        // Generate manual report
        console.log('\nTesting POST /api/v1/reports/generate...');
        const reportRes = await fetch(`http://127.0.0.1:3000/api/v1/reports/generate`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-mock-user-id': ownerId
            },
            body: JSON.stringify({
                locationId: loc.id,
                organizationId: loc.organizationId
            })
        });
        console.log(`Generate Report Status: ${reportRes.status}`);
        if (!reportRes.ok) throw new Error('Failed to generate report');
        
        const data = await reportRes.json();
        console.log(`Report Snapshot ID: ${data.snapshot.id}`);
        
        console.log('\n=== Milestone 9 Tests Passed ===');
        
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

runTests();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fetch = globalThis.fetch;

async function runTests() {
    console.log('=== Testing Milestone 8: Tenant Isolation ===');

    try {
        console.log('\n1. Setting up test data...');
        
        // Create Org A
        const orgA = await prisma.organization.create({
            data: {
                name: 'Agency A',
                ownerId: 'user_A',
                members: { create: { userId: 'user_A', role: 'ADMIN' } },
                businesses: { create: { name: 'Business A' } }
            },
            include: { businesses: true }
        });
        
        const locA = await prisma.location.create({
            data: {
                name: 'Location A',
                address: '123 A Street',
                organizationId: orgA.id,
                businessId: orgA.businesses[0].id
            }
        });
        
        console.log(`Created Org A (ID: ${orgA.id}), Location A (ID: ${locA.id}), Owner: user_A`);

        // Create Org B
        const orgB = await prisma.organization.create({
            data: {
                name: 'Agency B',
                ownerId: 'user_B',
                members: { create: { userId: 'user_B', role: 'ADMIN' } },
                businesses: { create: { name: 'Business B' } }
            },
            include: { businesses: true }
        });

        const locB = await prisma.location.create({
            data: {
                name: 'Location B',
                address: '456 B Street',
                organizationId: orgB.id,
                businessId: orgB.businesses[0].id
            }
        });
        
        console.log(`Created Org B (ID: ${orgB.id}), Location B (ID: ${locB.id}), Owner: user_B`);

        // 2. Test Authorized Access
        console.log(`\n2. Testing Authorized Access: user_A -> Location A (ID: ${locA.id})`);
        const res1 = await fetch(`http://127.0.0.1:3000/api/v1/mock-gbp/locations/${locA.id}`, {
            headers: { 'x-mock-user-id': 'user_A' }
        });
        console.log(`Response Status: ${res1.status}`);
        if (res1.status === 403) throw new Error('user_A was unexpectedly blocked from Location A');

        // 3. Test Unauthorized Access (Tenant Isolation)
        console.log(`\n3. Testing Unauthorized Access: user_A -> Location B (ID: ${locB.id})`);
        const res2 = await fetch(`http://127.0.0.1:3000/api/v1/mock-gbp/locations/${locB.id}`, {
            headers: { 'x-mock-user-id': 'user_A' }
        });
        console.log(`Response Status: ${res2.status}`);
        
        if (res2.status !== 403) {
            throw new Error(`Tenant Isolation Failed! Expected 403 Forbidden, got ${res2.status}`);
        }
        
        const errorData = await res2.json();
        console.log(`Error Message: ${errorData.error}`);
        
        console.log('\n=== Milestone 8 Tests Passed: Tenant Isolation Secure ===');
        
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

runTests();

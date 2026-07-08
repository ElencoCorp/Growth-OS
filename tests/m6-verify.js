const fetch = globalThis.fetch;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
    console.log('=== Testing Milestone 6: Content Calendar ===');
    const locationId = 1;

    try {
        // 1. Create a draft post directly via Prisma for testing
        const post = await prisma.post.create({
            data: {
                locationId: locationId,
                textContent: 'This is an automated test post for scheduling.',
                status: 'DRAFT',
            }
        });
        console.log(`Created Draft Post ID: ${post.id}`);

        // 2. Hit the schedule endpoint to schedule it 10 seconds in the past so cron picks it up instantly
        const scheduledDate = new Date(Date.now() - 10000).toISOString();
        
        console.log(`\nTesting POST /api/v1/posts/${post.id}/schedule`);
        const scheduleRes = await fetch(`http://127.0.0.1:3000/api/v1/posts/${post.id}/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduledFor: scheduledDate })
        });
        
        console.log(`Schedule Status: ${scheduleRes.status}`);
        if (!scheduleRes.ok) throw new Error('Failed to schedule post');

        // Check if saved as SCHEDULED
        const checkPost = await prisma.post.findUnique({ where: { id: post.id } });
        console.log(`Post status in DB after scheduling: ${checkPost.status}`);
        if (checkPost.status !== 'SCHEDULED') throw new Error('Post not marked as SCHEDULED');

        // 3. Wait for Cron (runs every 1 minute)
        // To avoid waiting a full minute, we will manually invoke the cron function for the test.
        console.log(`\nManually triggering the cron publisher job...`);
        const cronJob = require('../src/jobs/cron-publisher.job');
        await cronJob.runPublisherCron();

        // 4. Check if it's PUBLISHED
        const finalPost = await prisma.post.findUnique({ where: { id: post.id } });
        console.log(`\nPost status in DB after cron: ${finalPost.status}`);
        
        if (finalPost.status !== 'PUBLISHED') throw new Error('Post not marked as PUBLISHED by cron');

        // 5. Test Calendar GET Endpoint
        console.log(`\nTesting GET /api/v1/locations/${locationId}/calendar`);
        const getRes = await fetch(`http://127.0.0.1:3000/api/v1/locations/${locationId}/calendar`);
        console.log(`Get Calendar Status: ${getRes.status}`);
        if (!getRes.ok) throw new Error('Failed to fetch calendar');
        
        const getData = await getRes.json();
        console.log(`Calendar Posts returned: ${getData.posts.length}`);

        console.log('\n=== Milestone 6 Tests Passed ===');
        
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

runTests();

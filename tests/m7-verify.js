const fetch = globalThis.fetch;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
    console.log('=== Testing Milestone 7: Meta Integration ===');
    const locationId = 1;

    try {
        // 1. Mock Meta OAuth Connection
        console.log(`\nTesting GET /api/v1/social/meta/callback?locationId=${locationId}&code=test_code_123`);
        const metaRes = await fetch(`http://127.0.0.1:3000/api/v1/social/meta/callback?locationId=${locationId}&code=test_code_123`);
        const metaData = await metaRes.json();
        console.log(`Meta Callback Status: ${metaRes.status}`, metaData);
        if (!metaRes.ok) throw new Error('Meta OAuth callback failed');

        // 2. Create a test post
        const post = await prisma.post.create({
            data: {
                locationId: locationId,
                textContent: 'This is a cross-channel test post.',
                imageUrl: 'https://images.unsplash.com/photo-1506744626753-1fa28f6f53cb',
                status: 'DRAFT',
            }
        });
        console.log(`\nCreated Draft Post ID: ${post.id}`);

        // 3. Schedule it across all channels
        const scheduledDate = new Date(Date.now() - 10000).toISOString();
        const channels = ['GBP', 'FB', 'IG'];
        
        console.log(`\nTesting POST /api/v1/posts/${post.id}/schedule with channels:`, channels);
        const scheduleRes = await fetch(`http://127.0.0.1:3000/api/v1/posts/${post.id}/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                scheduledFor: scheduledDate,
                channels: JSON.stringify(channels)
            })
        });
        
        console.log(`Schedule Status: ${scheduleRes.status}`);
        if (!scheduleRes.ok) throw new Error('Failed to schedule cross-channel post');

        // 4. Manually trigger cron
        console.log(`\nManually triggering the cron publisher job...`);
        const cronJob = require('../src/jobs/cron-publisher.job');
        await cronJob.runPublisherCron();

        // 5. Check if it's PUBLISHED and no errors
        const finalPost = await prisma.post.findUnique({ where: { id: post.id } });
        console.log(`\nPost status in DB after cron: ${finalPost.status}`);
        if (finalPost.errorMessage) {
            console.error(`Post had errors: ${finalPost.errorMessage}`);
        }
        
        if (finalPost.status !== 'PUBLISHED') throw new Error('Post not marked as PUBLISHED by cron');

        console.log('\n=== Milestone 7 Tests Passed ===');
        
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

runTests();

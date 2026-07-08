const schedulerService = require('../services/scheduling/scheduler.service');
const googlePostsService = require('../services/google/posts.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let isRunning = false;

async function runPublisherCron() {
    if (isRunning) return; // Prevent overlapping runs
    isRunning = true;

    try {
        const duePosts = await schedulerService.getDuePosts();
        
        if (duePosts.length > 0) {
            console.log(`[Cron Publisher] Found ${duePosts.length} posts due for publishing.`);
        }

        for (const post of duePosts) {
            try {
                console.log(`[Cron Publisher] Publishing post ID: ${post.id}`);
                
                // Assuming publishLocalPost handles the API call and throws on error
                await googlePostsService.publishLocalPost(post.locationId, post);

                // Ensure it's marked as published
                await prisma.post.update({
                    where: { id: post.id },
                    data: {
                        status: 'PUBLISHED',
                        publishedAt: new Date()
                    }
                });
                
                console.log(`[Cron Publisher] Successfully published post ID: ${post.id}`);
            } catch (err) {
                console.error(`[Cron Publisher] Failed to publish post ID: ${post.id}`, err.message);
                await schedulerService.markPostFailed(post.id, err.message);
            }
        }
    } catch (error) {
        console.error('[Cron Publisher] Error in cron loop:', error);
    } finally {
        isRunning = false;
    }
}

// Start the cron runner
function startCron(intervalMs = 60000) {
    console.log(`[Cron Publisher] Starting cron scheduler (Interval: ${intervalMs}ms)`);
    setInterval(runPublisherCron, intervalMs);
}

module.exports = {
    startCron,
    runPublisherCron
};

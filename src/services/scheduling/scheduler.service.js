const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getDuePosts() {
    try {
        const now = new Date();
        const duePosts = await prisma.post.findMany({
            where: {
                status: 'SCHEDULED',
                scheduledFor: {
                    lte: now
                }
            }
        });
        return duePosts;
    } catch (error) {
        console.error('[Scheduler Service] Error fetching due posts:', error);
        throw error;
    }
}

async function markPostFailed(postId, errorMsg) {
    try {
        await prisma.post.update({
            where: { id: postId },
            data: {
                status: 'FAILED',
                errorMessage: errorMsg
            }
        });
    } catch (error) {
        console.error(`[Scheduler Service] Error marking post ${postId} as FAILED:`, error);
        throw error;
    }
}

module.exports = {
    getDuePosts,
    markPostFailed
};

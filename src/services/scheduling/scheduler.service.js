const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const googlePostsService = require('../google/posts.service');
const facebookService = require('../social/facebook.service');
const instagramService = require('../social/instagram.service');

async function getDuePosts() {
    try {
        const now = new Date();
        const duePosts = await prisma.contentPiece.findMany({
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
        await prisma.contentPiece.update({
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

async function publishPostAcrossChannels(post) {
    let channels = [];
    try {
        channels = JSON.parse(post.channels || '["GBP"]');
    } catch (e) {
        channels = ["GBP"];
    }

    const errors = [];

    if (channels.includes('GBP')) {
        try {
            await googlePostsService.publishLocalPost(post.locationId, post);
        } catch (err) {
            errors.push(`GBP: ${err.message}`);
        }
    }

    if (channels.includes('FB')) {
        try {
            await facebookService.publishFacebookPost(post.locationId, post);
        } catch (err) {
            errors.push(`FB: ${err.message}`);
        }
    }

    if (channels.includes('IG')) {
        try {
            await instagramService.publishInstagramPost(post.locationId, post);
        } catch (err) {
            errors.push(`IG: ${err.message}`);
        }
    }

    if (errors.length > 0) {
        throw new Error(errors.join(' | '));
    }
    
    return true;
}

module.exports = {
    getDuePosts,
    markPostFailed,
    publishPostAcrossChannels
};

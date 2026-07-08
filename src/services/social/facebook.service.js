const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function publishFacebookPost(locationId, post) {
    try {
        const location = await prisma.location.findUnique({ where: { id: locationId } });
        if (!location || !location.metaAccessToken || !location.facebookPageId) {
            throw new Error(`Location ${locationId} does not have Facebook connected.`);
        }

        console.log(`[Facebook Service] Publishing post ${post.id} to Page ${location.facebookPageId}`);
        // Mock Graph API Call
        await new Promise(resolve => setTimeout(resolve, 500)); 
        
        console.log(`[Facebook Service] Successfully published to Facebook!`);
        return true;
    } catch (error) {
        console.error(`[Facebook Service] Error:`, error.message);
        throw error;
    }
}

module.exports = { publishFacebookPost };

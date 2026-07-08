const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function publishInstagramPost(locationId, post) {
    try {
        const location = await prisma.location.findUnique({ where: { id: locationId } });
        if (!location || !location.metaAccessToken || !location.instagramAccountId) {
            throw new Error(`Location ${locationId} does not have Instagram connected.`);
        }

        if (!post.imageUrl) {
            throw new Error(`Instagram requires an image. Post ${post.id} has no image.`);
        }

        console.log(`[Instagram Service] Publishing post ${post.id} to Account ${location.instagramAccountId}`);
        // Mock Graph API Call
        await new Promise(resolve => setTimeout(resolve, 500)); 
        
        console.log(`[Instagram Service] Successfully published to Instagram!`);
        return true;
    } catch (error) {
        console.error(`[Instagram Service] Error:`, error.message);
        throw error;
    }
}

module.exports = { publishInstagramPost };

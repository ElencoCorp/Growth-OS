const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function handleMetaCallback(locationId, mockAuthCode) {
    try {
        console.log(`[Meta OAuth] Processing auth code for Location ${locationId}`);
        // Mock token exchange
        const mockAccessToken = `meta_access_token_${mockAuthCode}_${Date.now()}`;
        const mockFbPageId = `fb_page_${locationId}`;
        const mockIgAccountId = `ig_acct_${locationId}`;

        await prisma.location.update({
            where: { id: locationId },
            data: {
                metaAccessToken: mockAccessToken,
                facebookPageId: mockFbPageId,
                instagramAccountId: mockIgAccountId
            }
        });
        
        return { success: true, metaAccessToken: mockAccessToken, facebookPageId: mockFbPageId, instagramAccountId: mockIgAccountId };
    } catch (error) {
        console.error('[Meta OAuth] Error handling callback:', error);
        throw error;
    }
}

async function getMetaStatus(locationId) {
    try {
        const location = await prisma.location.findUnique({
            where: { id: locationId },
            select: { metaAccessToken: true, facebookPageId: true, instagramAccountId: true }
        });
        if (!location) throw new Error('Location not found');
        return {
            connected: !!location.metaAccessToken,
            facebookPageId: location.facebookPageId,
            instagramAccountId: location.instagramAccountId
        };
    } catch (error) {
        console.error('[Meta OAuth] Error getting status:', error);
        throw error;
    }
}

module.exports = {
    handleMetaCallback,
    getMetaStatus
};

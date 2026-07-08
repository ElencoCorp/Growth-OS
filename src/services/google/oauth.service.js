const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cryptoUtils = require('../../utils/crypto');

/**
 * Structured Logger
 */
function logEvent(action, locationId, status, retryCount = 0, error = null) {
    const logEntry = {
        requestId: require('crypto').randomUUID(),
        timestamp: new Date().toISOString(),
        action,
        locationId,
        status,
        retryCount
    };
    if (error) logEntry.error = error;
    console.log(`[Google OAuth Service] ${JSON.stringify(logEntry)}`);
}

/**
 * Checks if token is valid (or proactively refreshes it).
 * Uses encrypted tokens from the database.
 */
async function refreshAccessToken(locationId) {
    try {
        const location = await prisma.location.findUnique({ where: { id: locationId } });
        
        if (!location || !location.googleRefreshToken) {
            throw new Error('No refresh token available for this location.');
        }

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error('Missing Google Client ID or Secret in environment variables.');
        }

        const decryptedRefreshToken = cryptoUtils.decrypt(location.googleRefreshToken);

        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: decryptedRefreshToken,
                grant_type: 'refresh_token'
            })
        });

        if (!response.ok) {
            const errData = await response.text();
            throw new Error(`Failed to refresh access token: ${errData}`);
        }

        const data = await response.json();
        
        // Encrypt and update the Location with the new access token
        const encryptedAccessToken = cryptoUtils.encrypt(data.access_token);
        
        await prisma.location.update({
            where: { id: locationId },
            data: {
                googleAccessToken: encryptedAccessToken
            }
        });

        logEvent('refreshAccessToken', locationId, 'SUCCESS');
        
        return data.access_token; // Return raw token for immediate in-memory use by other services
    } catch (error) {
        logEvent('refreshAccessToken', locationId, 'FAILED', 0, error.message);
        throw error;
    }
}

/**
 * Helper to fetch the decrypted access token directly for other services.
 */
async function getDecryptedAccessToken(locationId) {
    const location = await prisma.location.findUnique({ where: { id: locationId } });
    if (!location || !location.googleAccessToken) {
        throw new Error('No access token available for this location.');
    }
    return cryptoUtils.decrypt(location.googleAccessToken);
}

module.exports = {
    refreshAccessToken,
    getDecryptedAccessToken
};

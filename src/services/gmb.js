const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Maps Google's star rating strings to integers.
 */
function parseStarRating(ratingStr) {
    const ratings = {
        'ONE': 1,
        'TWO': 2,
        'THREE': 3,
        'FOUR': 4,
        'FIVE': 5
    };
    return ratings[ratingStr] || 5; // Default to 5 if unknown
}

/**
 * Checks if token is valid (using a ping to tokeninfo) or simply refreshes it via refresh_token.
 * For robustness, we'll just proactively refresh it if we get a 401.
 */
async function refreshAccessToken(locationId) {
    const location = await prisma.location.findUnique({ where: { id: locationId } });
    if (!location || !location.googleRefreshToken) {
        throw new Error('No refresh token available for this location.');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('Missing Google Client ID or Secret in environment variables.');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: location.googleRefreshToken,
            grant_type: 'refresh_token'
        })
    });

    if (!response.ok) {
        const errData = await response.text();
        throw new Error(`Failed to refresh access token: ${errData}`);
    }

    const data = await response.json();
    
    // Securely update the Location with the new access token
    await prisma.location.update({
        where: { id: locationId },
        data: {
            googleAccessToken: data.access_token
        }
    });

    return data.access_token;
}

/**
 * Sycns the fetched API reviews to the Prisma database.
 */
async function syncReviewsToDatabase(locationId, apiReviews) {
    // Wipe existing reviews for this location to prevent duplicates (since we don't have googleReviewId)
    await prisma.review.deleteMany({
        where: { locationId: locationId }
    });

    if (!apiReviews || apiReviews.length === 0) {
        return [];
    }

    const mappedReviews = apiReviews.map(r => ({
        locationId: locationId,
        authorName: r.reviewer?.displayName || 'Anonymous User',
        rating: parseStarRating(r.starRating),
        text: r.comment || '',
        reply: r.reviewReply?.comment || null
    }));

    // Insert new reviews
    await prisma.review.createMany({
        data: mappedReviews
    });

    return mappedReviews;
}

/**
 * Fetches live reviews from the Google Business Profile API.
 */
async function fetchLiveReviews(locationId, retries = 1) {
    let location = await prisma.location.findUnique({ where: { id: locationId } });
    if (!location) {
        throw new Error('Location not found.');
    }
    
    if (!location.googleAccessToken) {
        throw new Error('No access token available for this location.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        // We use placeholder variables for ACCOUNT_ID and LOCATION_ID as requested
        // In a real scenario, these would be populated from the database
        const url = `https://mybusiness.googleapis.com/v4/accounts/ACCOUNT_ID/locations/LOCATION_ID/reviews`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${location.googleAccessToken}`
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 401 && retries > 0) {
            console.warn('[GBP Service] Access token expired, refreshing...');
            await refreshAccessToken(locationId);
            return await fetchLiveReviews(locationId, retries - 1);
        }

        if (!response.ok) {
            throw new Error(`Google API HTTP error: ${response.status}`);
        }

        const data = await response.json();
        
        // Sync to database
        const syncedData = await syncReviewsToDatabase(locationId, data.reviews || []);
        return syncedData;
        
    } catch (error) {
        clearTimeout(timeoutId);
        console.error(`[GBP Service Error] Failed to fetch live reviews: ${error.message}`);
        throw error;
    }
}

module.exports = {
    refreshAccessToken,
    fetchLiveReviews,
    syncReviewsToDatabase
};

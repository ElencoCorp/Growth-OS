const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const oauthService = require('./oauth.service');

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
    console.log(`[Google Reviews Service] ${JSON.stringify(logEntry)}`);
}

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
    return ratings[ratingStr] || 5; 
}

/**
 * Exponential backoff fetch wrapper
 */
async function fetchWithBackoff(url, options, locationId, maxRetries = 3) {
    let retries = 0;
    while (retries <= maxRetries) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                return response;
            }

            if (response.status === 401) {
                // Token expired - proactively refresh it and retry once immediately
                logEvent('fetchWithBackoff', locationId, '401_UNAUTHORIZED', retries);
                if (retries === maxRetries) throw new Error('Unauthorized - max retries reached');
                
                const newAccessToken = await oauthService.refreshAccessToken(locationId);
                options.headers['Authorization'] = `Bearer ${newAccessToken}`;
                retries++;
                continue;
            }

            if (response.status === 429 || response.status === 403) {
                // Rate limited (429) or quota exceeded (403)
                logEvent('fetchWithBackoff', locationId, `RATE_LIMITED_${response.status}`, retries);
                if (retries === maxRetries) throw new Error(`Rate limit exceeded - max retries reached`);
                
                // Exponential backoff: 1s, 2s, 4s...
                const delayMs = Math.pow(2, retries) * 1000;
                await new Promise(res => setTimeout(res, delayMs));
                retries++;
                continue;
            }

            throw new Error(`Google API HTTP error: ${response.status}`);
        } catch (error) {
            if (error.name === 'AbortError') {
                logEvent('fetchWithBackoff', locationId, 'TIMEOUT', retries, error.message);
            } else {
                logEvent('fetchWithBackoff', locationId, 'FETCH_ERROR', retries, error.message);
            }
            if (retries === maxRetries) throw error;
            
            // Exponential backoff for network failures too
            const delayMs = Math.pow(2, retries) * 1000;
            await new Promise(res => setTimeout(res, delayMs));
            retries++;
        }
    }
    throw new Error('fetchWithBackoff failed after max retries');
}

/**
 * Syncs the fetched API reviews to the Prisma database using upsert.
 */
async function syncReviewsToDatabase(locationId, apiReviews) {
    if (!apiReviews || apiReviews.length === 0) {
        return [];
    }

    const syncedReviews = [];

    for (const r of apiReviews) {
        const reviewId = r.reviewId || require('crypto').randomUUID(); // Fallback if API doesn't provide one
        
        const data = {
            locationId: locationId,
            authorName: r.reviewer?.displayName || 'Anonymous User',
            rating: parseStarRating(r.starRating),
            text: r.comment || '',
            reply: r.reviewReply?.comment || null
        };

        const upserted = await prisma.review.upsert({
            where: { googleReviewId: reviewId },
            update: data,
            create: {
                ...data,
                googleReviewId: reviewId
            }
        });
        
        syncedReviews.push(upserted);
    }
    
    // Update lastReviewSync
    await prisma.location.update({
        where: { id: locationId },
        data: { lastReviewSync: new Date() }
    });

    return syncedReviews;
}

/**
 * Fetches live reviews from the Google Business Profile API.
 */
async function fetchLiveReviews(locationId) {
    try {
        const accessToken = await oauthService.getDecryptedAccessToken(locationId);

        // Placeholder path structure
        const url = `https://mybusiness.googleapis.com/v4/accounts/ACCOUNT_ID/locations/LOCATION_ID/reviews`;
        
        const response = await fetchWithBackoff(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        }, locationId);

        const data = await response.json();
        
        const syncedData = await syncReviewsToDatabase(locationId, data.reviews || []);
        
        logEvent('fetchLiveReviews', locationId, 'SUCCESS', 0);
        return syncedData;
    } catch (error) {
        logEvent('fetchLiveReviews', locationId, 'FAILED', 0, error.message);
        throw error;
    }
}

/**
 * Publishes a review reply to the Google Business Profile API.
 */
async function publishReviewReply(locationId, googleReviewId, replyText) {
    try {
        const accessToken = await oauthService.getDecryptedAccessToken(locationId);

        // Placeholder path structure for GBP reply endpoint
        // Actual structure: https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews/{reviewId}/reply
        const url = `https://mybusiness.googleapis.com/v4/accounts/ACCOUNT_ID/locations/LOCATION_ID/reviews/${googleReviewId}/reply`;
        
        const response = await fetchWithBackoff(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                comment: replyText
            })
        }, locationId);

        const data = await response.json();
        logEvent('publishReviewReply', locationId, 'SUCCESS', 0);
        return data;
    } catch (error) {
        logEvent('publishReviewReply', locationId, 'FAILED', 0, error.message);
        throw error;
    }
}

module.exports = {
    fetchLiveReviews,
    syncReviewsToDatabase,
    publishReviewReply
};

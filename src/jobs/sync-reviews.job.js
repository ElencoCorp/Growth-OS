const reviewsService = require('../services/google/reviews.service');

/**
 * Background job to sync Google Reviews.
 * This should be executed asynchronously without blocking the HTTP response.
 */
async function runSyncReviewsJob(locationId) {
    try {
        console.log(`[Job Runner] Starting sync-reviews job for location ${locationId}`);
        const syncedReviews = await reviewsService.fetchLiveReviews(locationId);
        console.log(`[Job Runner] Successfully synced ${syncedReviews.length} reviews for location ${locationId}`);
    } catch (error) {
        // Log specific known errors
        if (error.message.includes('429') || error.message.includes('Rate limit')) {
            console.error(`[Job Runner] Sync failed for location ${locationId} due to Rate Limiting (429). Will retry on next schedule.`);
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            console.error(`[Job Runner] Sync failed for location ${locationId} due to Unauthorized (401). Token refresh may have failed.`);
        } else {
            console.error(`[Job Runner] Sync failed for location ${locationId} with error: ${error.message}`);
        }
    }
}

module.exports = {
    runSyncReviewsJob
};

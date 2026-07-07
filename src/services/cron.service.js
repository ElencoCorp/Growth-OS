const prisma = require('../db');
const aiService = require('./ai.service');

async function processUnhandledReviews() {
    try {
        const location = await prisma.location.findFirst();
        if (!location) return;

        // Find reviews that do not have a reply yet
        const unhandledReviews = await prisma.review.findMany({
            where: {
                locationId: location.id,
                reply: null
            }
        });

        for (const review of unhandledReviews) {

            try {
                const draft = await aiService.generateReviewReply(review.text);
                await prisma.review.update({
                    where: { id: review.id },
                    data: { reply: draft }
                });

            } catch (aiError) {
                console.error(`[Cron] Failed to process review ID: ${review.id}`, aiError.message);
            }
        }
    } catch (error) {
        console.error('[Cron] Error processing reviews:', error);
    }
}

function startCron() {

    // Initial run
    processUnhandledReviews();
    // Subsequent runs
    setInterval(processUnhandledReviews, 60000);
}

module.exports = {
    startCron,
    processUnhandledReviews
};

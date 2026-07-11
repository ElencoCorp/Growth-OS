const groqService = require('../services/ai/groq.service');
const googleReviewsService = require('../services/google/reviews.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { invalidateLocationCache } = require('../services/cache.service');

async function generateReply(request, reply) {
    try {
        const reviewId = parseInt(request.params.id, 10);
        if (isNaN(reviewId)) return reply.code(400).send({ error: 'Invalid review ID' });

        const review = await prisma.review.findUnique({
            where: { id: reviewId },
            include: { location: true }
        });

        if (!review) return reply.code(404).send({ error: 'Review not found' });

        const generatedReply = await groqService.generateReviewReply(review.text, review.location);

        const updatedReview = await prisma.review.update({
            where: { id: reviewId },
            data: { aiSuggestedReply: generatedReply }
        });

        invalidateLocationCache(review.locationId);
        
        return reply.send({ success: true, aiSuggestedReply: generatedReply, review: updatedReview });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

async function publishReply(request, reply) {
    try {
        const reviewId = parseInt(request.params.id, 10);
        if (isNaN(reviewId)) return reply.code(400).send({ error: 'Invalid review ID' });
        
        const { replyText } = request.body;
        if (!replyText) return reply.code(400).send({ error: 'replyText is required' });

        const review = await prisma.review.findUnique({
            where: { id: reviewId },
            include: { location: true }
        });

        if (!review) return reply.code(404).send({ error: 'Review not found' });
        if (!review.googleReviewId) return reply.code(400).send({ error: 'Review is not synced with Google' });

        // Hit GBP API only if not a mock test review
        if (!review.googleReviewId.startsWith('mock_google_review_')) {
            await googleReviewsService.publishReviewReply(review.locationId, review.googleReviewId, replyText);
        }

        // Save to DB
        const updatedReview = await prisma.review.update({
            where: { id: reviewId },
            data: { 
                publishedReply: replyText,
                replyPublishedAt: new Date(),
                reply: replyText // legacy fallback for backward compatibility
            }
        });

        invalidateLocationCache(review.locationId);

        return reply.send({ success: true, review: updatedReview });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error', details: error.message });
    }
}

module.exports = {
    generateReply,
    publishReply
};

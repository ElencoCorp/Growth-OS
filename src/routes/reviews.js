const prisma = require('../db');
const { generateReviewReply } = require('../services/ai.service');
const { reviewsCache, invalidateLocationCache } = require('../services/cache.service');
const reviewsController = require('../controllers/reviews.controller');

/**
 * Registers reviews routes
 * @param {import('fastify').FastifyInstance} fastify 
 */
async function reviewRoutes(fastify, options) {
  
  fastify.get('/api/v1/reviews', async (request, reply) => {
    try {
      const { locationId } = request.query;
      let locWhere = {};
      
      if (locationId) {
        locWhere.locationId = parseInt(locationId);
      } else {
        const location = await prisma.location.findFirst();
        if (!location) return reply.code(404).send({ error: 'No location found' });
        locWhere.locationId = location.id;
      }
      
      const locId = locWhere.locationId;
      
      if (reviewsCache.has(locId)) {
        return { success: true, reviews: reviewsCache.get(locId) };
      }

      const reviews = await prisma.review.findMany({
        where: locWhere,
        orderBy: { createdAt: 'desc' }
      });
      
      reviewsCache.set(locId, reviews);

      return { success: true, reviews };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/api/v1/reviews/auto-reply', {
    schema: {
      body: {
        type: 'object',
        required: ['reviewId'],
        properties: {
          reviewId: { type: ['integer', 'string'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { reviewId } = request.body;
      if (!reviewId) return reply.code(400).send({ error: 'reviewId is required' });

      const review = await prisma.review.findUnique({
        where: { id: parseInt(reviewId) },
        include: { location: true }
      });

      if (!review) return reply.code(404).send({ error: 'Review not found' });

      // Generate the reply text
      const generatedReply = await generateReviewReply(review.text, review.location);

      // Save it to database
      const updatedReview = await prisma.review.update({
        where: { id: parseInt(reviewId) },
        data: { reply: generatedReply }
      });
      
      // Invalidate cache
      invalidateLocationCache(review.locationId);

      return reply.send({ success: true, draft: generatedReply, review: updatedReview });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Thin routes for Milestone 2
  fastify.post('/api/v1/reviews/:id/generate', reviewsController.generateReply);
  fastify.post('/api/v1/reviews/:id/publish', reviewsController.publishReply);
  fastify.post('/api/v1/reviews/:id/reply', reviewsController.publishReply);
}

module.exports = reviewRoutes;

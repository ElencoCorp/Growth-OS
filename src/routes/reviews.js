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
      const { locationId, filter } = request.query;
      let locWhere = {};
      
      if (locationId) {
        locWhere.locationId = parseInt(locationId);
      } else {
        const location = await prisma.location.findFirst();
        if (!location) return reply.code(404).send({ error: 'No location found' });
        locWhere.locationId = location.id;
      }
      
      if (filter === 'Positive') {
          locWhere.rating = { gte: 4 };
      } else if (filter === 'Negative') {
          locWhere.rating = { lte: 3 };
      } else if (filter === 'Needs Reply') {
          locWhere.status = 'NEEDS_REPLY';
      } else if (filter === 'Pending Approval') {
          locWhere.aiSuggestedReply = { not: null };
          locWhere.publishedReply = null;
      }

      const reviews = await prisma.review.findMany({
        where: locWhere,
        orderBy: { createdAt: 'desc' }
      });

      return { success: true, reviews };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.patch('/api/v1/reviews/:id/action', async (request, reply) => {
      const { id } = request.params;
      const { action, replyText } = request.body;
      const reviewId = parseInt(id);

      if (isNaN(reviewId)) return reply.status(400).send({ success: false, error: 'Invalid ID' });

      const review = await prisma.review.findUnique({ where: { id: reviewId } });
      if (!review) return reply.status(404).send({ success: false, error: 'Review not found' });

      let updateData = {};
      if (action === 'edit') {
          updateData.aiSuggestedReply = replyText;
      } else if (action === 'approve') {
          updateData.aiSuggestedReply = replyText;
          updateData.status = 'PENDING_PUBLISH';
      } else if (action === 'publish') {
          updateData.publishedReply = replyText;
          updateData.status = 'REPLIED';
          updateData.replyPublishedAt = new Date();
      } else {
          return reply.status(400).send({ success: false, error: 'Invalid action' });
      }

      const updated = await prisma.review.update({
          where: { id: reviewId },
          data: updateData
      });
      
      invalidateLocationCache(review.locationId);

      return reply.send({ success: true, review: updated });
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

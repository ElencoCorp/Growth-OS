const bulkImporter = require('../../../../services/bulk-importer.service');
const featureGuard = require('../../../../middleware/feature-guard');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const aiService = require('../../../../services/ai.service');
const contentStudio = require('../../../../services/content-studio.service');

async function bulkOnboardingRoutes(fastify, options) {
  
  fastify.addHook('preHandler', featureGuard);

  fastify.get('/preflight', async (request, reply) => {
    try {
      const organizationId = request.tenant?.organizationId || request.query.organizationId;
      
      if (!organizationId) {
        return reply.code(400).send({ error: 'organizationId is required' });
      }

      const capacity = await bulkImporter.getOrganizationCapacity(organizationId);
      return reply.send({ success: true, capacity });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to assess organization capacity.' });
    }
  });

  fastify.post('/bulk-import', async (request, reply) => {
    try {
      const organizationId = request.tenant?.organizationId || request.body.organizationId;
      const businessId = request.tenant?.businessId || request.body.businessId;
      const { locations, headerMap } = request.body;
      
      if (!organizationId || !businessId || !locations || !Array.isArray(locations)) {
        return reply.code(400).send({ error: 'organizationId, businessId, and locations array are structurally required.' });
      }

      const result = await bulkImporter.executeBulkImport(organizationId, businessId, locations, headerMap);
      
      return reply.code(201).send({ success: true, result });
    } catch (error) {
      request.log.error(error);
      if (error.message.includes('Operational capacity exception')) {
          return reply.code(403).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to process bulk import batch.' });
    }
  });

  fastify.post('/auto-pilot/execute', async (request, reply) => {
    try {
      const locationId = request.body.locationId ? parseInt(request.body.locationId) : null;
      if (!locationId) {
        return reply.code(400).send({ error: 'locationId is required for auto-pilot.' });
      }

      // 1. Auto-Approve Pending Drafts
      const drafts = await prisma.contentPiece.findMany({
        where: { locationId, status: 'DRAFT_PENDING_REVIEW' }
      });
      for (const draft of drafts) {
        await contentStudio.approveContentPiece(draft.id);
      }

      // 2. Batch-Publish Sentiment-Matched Replies
      const openReviews = await prisma.review.findMany({
        where: { locationId, status: 'NEEDS_REPLY' },
        take: 5
      });
      for (const review of openReviews) {
        const replyText = await aiService.generateReviewReply(review.text || '', review.rating);
        await prisma.review.update({
          where: { id: review.id },
          data: { reply: replyText, status: 'REPLIED', replyPublishedAt: new Date() }
        });
      }

      return reply.send({ success: true, processedDrafts: drafts.length, processedReviews: openReviews.length });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Auto-pilot execution failed.' });
    }
  });

}

module.exports = bulkOnboardingRoutes;

const contentStudioService = require('../../../../services/content-studio.service');

async function contentRoutes(fastify, options) {

  fastify.post('/generate', async (request, reply) => {
    try {
      const locationId = request.tenant?.locationId || request.body.locationId;
      const { contextString, imageQuery } = request.body;
      
      if (!locationId) {
        return reply.code(400).send({ error: 'locationId is required' });
      }

      const post = await contentStudioService.createDraftPost(locationId, contextString || 'General Update', imageQuery);
      return reply.code(201).send({ success: true, post });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to generate content' });
    }
  });

  fastify.put('/approve/:postId', async (request, reply) => {
    try {
      const { postId } = request.params;
      if (!postId) {
        return reply.code(400).send({ error: 'postId is required' });
      }

      const updated = await contentStudioService.approveContentPiece(postId);
      return reply.send({ success: true, post: updated });
    } catch (error) {
      request.log.error(error);
      if (error.message.includes('not found') || error.message.includes('Cannot approve')) {
          return reply.code(400).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to approve content' });
    }
  });

  fastify.post('/publish/:postId', async (request, reply) => {
    try {
      const { postId } = request.params;
      if (!postId) {
        return reply.code(400).send({ error: 'postId is required' });
      }

      const published = await contentStudioService.publishContentPiece(postId);
      return reply.send({ success: true, post: published });
    } catch (error) {
      request.log.error(error);
      if (error.message.includes('not found') || error.message.includes('Cannot publish')) {
          return reply.code(400).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to publish content' });
    }
  });

}

module.exports = contentRoutes;

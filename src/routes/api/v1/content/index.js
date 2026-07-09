const contentStudioService = require('../../../../services/content-studio.service');

async function contentRoutes(fastify, options) {
  
  fastify.post('/generate', async (request, reply) => {
    try {
      const { locationId, topic } = request.body;
      
      if (!locationId) {
        return reply.code(400).send({ error: 'locationId is required' });
      }

      const post = await contentStudioService.generateLocalPost(locationId, topic);
      return reply.code(201).send({ success: true, post });
    } catch (error) {
      request.log.error(error);
      if (error.message === 'Location not found') {
        return reply.code(404).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to generate post' });
    }
  });

  fastify.post('/publish/:postId', async (request, reply) => {
    try {
      const { postId } = request.params;
      
      if (!postId) {
        return reply.code(400).send({ error: 'postId is required' });
      }

      const post = await contentStudioService.publishLocalPost(postId);
      return reply.send({ success: true, post });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to publish post' });
    }
  });

}

module.exports = contentRoutes;

const aiService = require('../services/ai.service');
const imageService = require('../services/image.service');
const prisma = require('../db');

/**
 * Registers posts routes
 * @param {import('fastify').FastifyInstance} fastify 
 */
async function postRoutes(fastify, options) {
  
  fastify.get('/api/v1/posts', async (request, reply) => {
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
      
      const posts = await prisma.post.findMany({
        where: locWhere,
        orderBy: { createdAt: 'desc' }
      });
      return { success: true, posts };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/api/v1/posts/generate', async (request, reply) => {
    try {
      const { goalText, locationId } = request.body;

      if (!goalText) {
        return reply.code(400).send({ error: 'goalText is required' });
      }

      let locWhere = {};
      if (locationId) {
        locWhere.id = parseInt(locationId);
      } else {
        const firstLocation = await prisma.location.findFirst();
        if (!firstLocation) return reply.code(404).send({ error: 'No location found' });
        locWhere.id = firstLocation.id;
      }

      const location = await prisma.location.findUnique({
        where: locWhere
      });

      if (!location) {
        return reply.code(404).send({ error: 'Location not found' });
      }

      // 1. Pass goal text to Llama 3 via Local Ollama
      // 2. Concurrently generate an image banner
      let generatedPostText = '';
      let generatedImageUrl = null;
      
      try {
        const [postText, imgUrl] = await Promise.all([
          aiService.generateGooglePost(goalText, location),
          imageService.generateLocalImage(`${location.name} - ${goalText}`)
        ]);
        generatedPostText = postText;
        generatedImageUrl = imgUrl;
      } catch (err) {
        console.error("AI Generation Error", err);
        // Fallback if AI generation throws
        if (!generatedPostText) {
           generatedPostText = `Exciting news at ${location.name}! ${goalText}. Visit us today and let our experts take care of you!`;
        }
      }

      // 3. Save it directly to the SQLite database
      const newPost = await prisma.post.create({
        data: {
          content: generatedPostText,
          imageUrl: generatedImageUrl,
          locationId: location.id,
          status: 'Draft'
        }
      });

      return reply.send({
        success: true,
        post: newPost
      });

    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error', details: error.message });
    }
  });

  fastify.post('/api/v1/posts/publish', async (request, reply) => {
    try {
      const { postId, content } = request.body;
      
      if (!postId) {
        return reply.code(400).send({ error: 'postId is required' });
      }
      
      const updateData = { status: 'Published_Local_Mock' };
      if (content) updateData.content = content;

      const updatedPost = await prisma.post.update({
        where: { id: parseInt(postId) },
        data: updateData
      });
      
      request.log.info(`[PUBLISH] Post ${postId} marked as Published_Local_Mock`);
      
      return { success: true, post: updatedPost };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/api/v1/posts/:id/schedule', async (request, reply) => {
    try {
      const { id } = request.params;
      const { scheduledFor, content } = request.body;
      
      if (!scheduledFor) {
        return reply.code(400).send({ error: 'scheduledFor is required' });
      }

      const updateData = { 
        status: 'Scheduled',
        scheduledFor: new Date(scheduledFor)
      };
      if (content) updateData.content = content;

      const updatedPost = await prisma.post.update({
        where: { id: parseInt(id) },
        data: updateData
      });
      
      return { success: true, post: updatedPost };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

}

module.exports = postRoutes;

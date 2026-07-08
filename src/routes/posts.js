const postsController = require('../controllers/posts.controller');
const prisma = require('../db');

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

  fastify.post('/api/v1/locations/:id/posts/generate', {
    schema: {
      body: {
        type: 'object',
        required: ['goalText'],
        properties: {
          goalText: { type: 'string', minLength: 1 }
        }
      },
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, postsController.generatePost);

  fastify.post('/api/v1/posts/:id/publish', {
    schema: {
      body: {
        type: 'object',
        properties: {
          textContent: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, postsController.publishPost);

}

module.exports = postRoutes;

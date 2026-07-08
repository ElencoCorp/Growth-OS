const analyticsController = require('../controllers/analytics.controller');

/**
 * Registers analytics routes
 * @param {import('fastify').FastifyInstance} fastify 
 */
async function analyticsRoutes(fastify, options) {
  
  fastify.post('/api/v1/sync/insights/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, analyticsController.triggerSync);

  fastify.get('/api/v1/analytics/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, analyticsController.getAnalytics);

}

module.exports = analyticsRoutes;

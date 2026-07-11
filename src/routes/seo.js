const seoController = require('../controllers/seo.controller');

/**
 * Registers seo routes
 * @param {import('fastify').FastifyInstance} fastify 
 */
async function seoRoutes(fastify, options) {
  
  fastify.post('/api/v1/seo/keywords', seoController.addKeyword);
  fastify.post('/api/v1/sync/rankings/:locationId', seoController.triggerSync);
  fastify.get('/api/v1/seo/competitors/:locationId', seoController.getCompetitors);
  fastify.post('/api/v1/competitors/:competitorId/generate-strategy', seoController.generateCounterStrategy);
}

module.exports = seoRoutes;

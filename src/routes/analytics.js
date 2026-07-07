const aiService = require('../services/ai.service');
const prisma = require('../db');

/**
 * Registers analytics routes
 * @param {import('fastify').FastifyInstance} fastify 
 */
async function analyticsRoutes(fastify, options) {
  
  fastify.get('/api/v1/analytics/summary', async (request, reply) => {
    try {
      const { locationId } = request.query;
      let locWhere = {};
      
      if (locationId) {
        locWhere.id = parseInt(locationId);
      } else {
        const firstLocation = await prisma.location.findFirst();
        if (!firstLocation) return reply.code(404).send({ error: 'No location found' });
        locWhere.id = firstLocation.id;
      }
      
      const location = await prisma.location.findUnique({
        where: locWhere,
        include: { competitors: true }
      });
      if (!location) return reply.code(404).send({ error: 'Location not found' });
      
      let metrics = location.metrics ? JSON.parse(location.metrics) : null;
      
      // If no metrics exist, dynamically seed mock metrics
      if (!metrics) {
        metrics = {
            views: 4520,
            viewsChange: 12,
            directions: 340,
            directionsChange: 5,
            clicks: 890,
            clicksChange: -2,
            calls: 156,
            callsChange: 8
        };
        // Persist the mock metrics for consistency
        await prisma.location.update({
            where: { id: location.id },
            data: { metrics: JSON.stringify(metrics) }
        });
      }

      // Generate AI Executive Summary
      const summaryText = await aiService.generateExecutiveSummary(metrics, location.competitors);

      return { 
          success: true, 
          metrics,
          executiveSummary: summaryText
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

}

module.exports = analyticsRoutes;

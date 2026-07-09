const analyticsEngine = require('../../../../services/analytics-engine.service');
const featureGuard = require('../../../../middleware/feature-guard');

async function analyticsRoutes(fastify, options) {
  
  // Guard both routes with our active 402 manual software licensing gatekeepers
  fastify.addHook('preHandler', featureGuard('ANALYTICS_CORE'));

  fastify.get('/overview', async (request, reply) => {
    try {
      const organizationId = request.tenant?.organizationId || request.query.organizationId;
      
      if (!organizationId) {
        return reply.code(400).send({ error: 'organizationId is required' });
      }

      const overview = await analyticsEngine.compileOrganizationOverview(organizationId);
      
      return reply.send({ success: true, overview });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ 
        error: 'Failed to compile organization overview',
        fallback: {
            totalReviews: 0,
            averageRating: 0,
            averageMapPackPosition: 0,
            responseRate: 0,
            healthScore: 0,
            message: 'Server error encountered. Baseline established.'
        }
      });
    }
  });

  fastify.post('/report/generate', async (request, reply) => {
    try {
      const locationId = request.tenant?.locationId || request.body.locationId;
      const { dateRange } = request.body;
      
      if (!locationId || !dateRange) {
        return reply.code(400).send({ error: 'locationId and dateRange are required' });
      }

      const reportSnapshot = await analyticsEngine.generateExecutiveReport(locationId, dateRange);
      
      return reply.code(201).send({ success: true, report: reportSnapshot });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ 
          error: 'Failed to generate report snapshot',
          fallback: true,
          message: 'Historical logs empty or network delay. Returning baseline 0s.'
      });
    }
  });

}

module.exports = analyticsRoutes;

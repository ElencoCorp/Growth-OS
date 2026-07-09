const radarTrackerService = require('../../../../services/radar-tracker.service');
const featureGuard = require('../../../../middleware/feature-guard');

async function radarRoutes(fastify, options) {
  
  // Guard route definitions using active 402 manual licensing validation checks
  fastify.addHook('preHandler', featureGuard);

  fastify.get('/', async (request, reply) => {
    try {
      const locationId = request.tenant?.locationId || request.query.locationId;
      
      if (!locationId) {
        return reply.code(400).send({ error: 'locationId is required' });
      }

      const keywords = await radarTrackerService.listKeywords(locationId);
      return reply.send({ success: true, keywords });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to fetch radar keywords' });
    }
  });

  fastify.post('/', async (request, reply) => {
    try {
      const locationId = request.tenant?.locationId || request.body.locationId;
      const organizationId = request.tenant?.organizationId || request.body.organizationId;
      const { keywordText } = request.body;
      
      if (!locationId || !organizationId || !keywordText) {
        return reply.code(400).send({ error: 'locationId, organizationId, and keywordText are required' });
      }

      const newKeyword = await radarTrackerService.addKeyword(keywordText, locationId, organizationId);
      return reply.code(201).send({ success: true, keyword: newKeyword });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to add tracking keyword' });
    }
  });

  fastify.post('/track/:keywordId', async (request, reply) => {
    try {
      const { keywordId } = request.params;
      
      if (!keywordId) {
        return reply.code(400).send({ error: 'keywordId is required' });
      }

      const trackingResult = await radarTrackerService.trackKeywordPlacement(keywordId);
      
      if (trackingResult.error) {
          // Pass a safe non-breaking alert toast to the view framework
          return reply.code(200).send({
              success: false,
              alert: trackingResult.message,
              history: trackingResult.history
          });
      }

      return reply.send({ success: true, ...trackingResult });
    } catch (error) {
      request.log.error(error);
      if (error.message.includes('not found')) {
          return reply.code(404).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to execute tracking scan' });
    }
  });

}

module.exports = radarRoutes;

const radarTrackerService = require('../../../../services/radar-tracker.service');

async function radarRoutes(fastify, options) {
  
  fastify.get('/keywords', async (request, reply) => {
    try {
      const locationId = request.tenant?.locationId || request.query.locationId;
      
      if (!locationId) {
        return reply.code(400).send({ error: 'locationId is required' });
      }

      const keywords = await radarTrackerService.getKeywords(locationId);
      return reply.send({ success: true, keywords });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to fetch keywords' });
    }
  });

  fastify.post('/keywords', async (request, reply) => {
    try {
      const locationId = request.tenant?.locationId || request.body.locationId;
      const organizationId = request.tenant?.organizationId || request.body.organizationId;
      const { keywordText } = request.body;
      
      if (!locationId || !organizationId || !keywordText) {
        return reply.code(400).send({ error: 'locationId, organizationId, and keywordText are required' });
      }

      const keyword = await radarTrackerService.addKeyword(locationId, organizationId, keywordText);
      return reply.code(201).send({ success: true, keyword });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to add keyword' });
    }
  });

  fastify.post('/track/:keywordId', async (request, reply) => {
    try {
      const { keywordId } = request.params;
      
      if (!keywordId) {
        return reply.code(400).send({ error: 'keywordId is required' });
      }

      const result = await radarTrackerService.trackKeyword(keywordId);
      return reply.send(result);
    } catch (error) {
      request.log.error(error);
      if (error.message === 'Keyword not found') {
        return reply.code(404).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message || 'Failed to track keyword' });
    }
  });

}

module.exports = radarRoutes;

const bulkImporter = require('../../../../services/bulk-importer.service');
const featureGuard = require('../../../../middleware/feature-guard');

async function bulkOnboardingRoutes(fastify, options) {
  
  fastify.addHook('preHandler', featureGuard);

  fastify.get('/preflight', async (request, reply) => {
    try {
      const organizationId = request.tenant?.organizationId || request.query.organizationId;
      
      if (!organizationId) {
        return reply.code(400).send({ error: 'organizationId is required' });
      }

      const capacity = await bulkImporter.getOrganizationCapacity(organizationId);
      return reply.send({ success: true, capacity });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to assess organization capacity.' });
    }
  });

  fastify.post('/bulk-import', async (request, reply) => {
    try {
      const organizationId = request.tenant?.organizationId || request.body.organizationId;
      const businessId = request.tenant?.businessId || request.body.businessId;
      const { locations, headerMap } = request.body;
      
      if (!organizationId || !businessId || !locations || !Array.isArray(locations)) {
        return reply.code(400).send({ error: 'organizationId, businessId, and locations array are structurally required.' });
      }

      const result = await bulkImporter.executeBulkImport(organizationId, businessId, locations, headerMap);
      
      return reply.code(201).send({ success: true, result });
    } catch (error) {
      request.log.error(error);
      if (error.message.includes('Operational capacity exception')) {
          return reply.code(403).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to process bulk import batch.' });
    }
  });

}

module.exports = bulkOnboardingRoutes;

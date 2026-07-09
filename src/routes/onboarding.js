const onboardingController = require('../controllers/onboarding.controller');

/**
 * Registers onboarding routes
 * @param {import('fastify').FastifyInstance} fastify 
 */
async function onboardingRoutes(fastify, options) {
  
  fastify.get('/api/v1/google/account-locations', onboardingController.getAccountLocations);
  fastify.post('/api/v1/locations/bulk-import', onboardingController.bulkImportLocations);

}

module.exports = onboardingRoutes;

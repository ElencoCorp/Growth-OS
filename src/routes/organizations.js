const orgController = require('../controllers/organizations.controller');

async function organizationRoutes(fastify, options) {
    fastify.post('/api/v1/organizations', orgController.createOrg);
    fastify.get('/api/v1/organizations', orgController.listOrgs);
    fastify.get('/api/v1/organizations/:orgId/license', orgController.getLicenseStatus);
}

module.exports = organizationRoutes;

const orgController = require('../controllers/organizations.controller');

async function organizationRoutes(fastify, options) {
    fastify.post('/api/v1/organizations', orgController.createOrg);
    fastify.get('/api/v1/organizations', orgController.listOrgs);
}

module.exports = organizationRoutes;

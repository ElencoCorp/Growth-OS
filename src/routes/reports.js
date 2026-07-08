const reportController = require('../controllers/reports.controller');

async function reportRoutes(fastify, options) {
    fastify.post('/api/v1/organizations/:organizationId/whitelabel', reportController.updateWhiteLabelSettings);
    fastify.post('/api/v1/reports/generate', reportController.triggerManualReport);
    fastify.get('/api/v1/reports', reportController.listReports);
}

module.exports = reportRoutes;

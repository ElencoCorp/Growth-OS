const syncController = require('../controllers/sync.controller');

async function syncRoutes(fastify, options) {
    // 202 Accepted Route for async job processing
    fastify.post('/api/v1/sync/reviews/:locationId', syncController.triggerReviewSync);
}

module.exports = syncRoutes;

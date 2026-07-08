const socialController = require('../controllers/social.controller');

async function socialRoutes(fastify, options) {
    fastify.get('/api/v1/social/meta/connect', socialController.connectMeta);
    fastify.get('/api/v1/social/meta/callback', socialController.metaCallback);
    fastify.get('/api/v1/social/status/:locationId', socialController.getStatus);
}

module.exports = socialRoutes;

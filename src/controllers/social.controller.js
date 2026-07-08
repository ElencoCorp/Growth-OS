const metaOAuthService = require('../services/social/meta-oauth.service');

async function connectMeta(request, reply) {
    try {
        // Mock connection endpoint
        return reply.send({ success: true, message: 'Redirect to Meta OAuth URL' });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

async function metaCallback(request, reply) {
    try {
        const { locationId, code } = request.query;
        if (!locationId || !code) {
            return reply.code(400).send({ error: 'Missing locationId or code' });
        }
        const result = await metaOAuthService.handleMetaCallback(parseInt(locationId, 10), code);
        return reply.send(result);
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

async function getStatus(request, reply) {
    try {
        const locationId = parseInt(request.params.locationId, 10);
        if (isNaN(locationId)) return reply.code(400).send({ error: 'Invalid location ID' });
        const result = await metaOAuthService.getMetaStatus(locationId);
        return reply.send({ success: true, meta: result });
    } catch (error) {
        request.log.error(error);
        if (error.message === 'Location not found') {
            return reply.code(404).send({ error: 'Location not found' });
        }
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

module.exports = {
    connectMeta,
    metaCallback,
    getStatus
};

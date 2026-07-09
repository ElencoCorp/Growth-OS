const whitelabelService = require('../../../../services/whitelabel.service');

async function whitelabelRoutes(fastify, options) {
    // Note: tenant-resolver and feature-guard are applied globally at the Fastify 
    // protected layer in server.js. This route is safely protected.

    // GET /api/v1/settings/whitelabel
    fastify.get('/', async (request, reply) => {
        try {
            const orgId = request.tenant?.organizationId || parseInt(request.query.organizationId, 10);
            if (!orgId) {
                return reply.code(400).send({ error: 'organizationId is required' });
            }

            const config = await whitelabelService.getBrandingConfig(orgId);
            return reply.code(200).send({ success: true, branding: config });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ error: 'Failed to retrieve whitelabel configuration' });
        }
    });

    // POST /api/v1/settings/whitelabel
    fastify.post('/', async (request, reply) => {
        try {
            const orgId = request.tenant?.organizationId || parseInt(request.body.organizationId, 10);
            if (!orgId) {
                return reply.code(400).send({ error: 'organizationId is required' });
            }

            // Accept parameters: appTitle, brandPrimaryHex, brandSecondaryHex, logoUrl, supportEmail, agencyVoice
            const config = await whitelabelService.saveBrandingConfig(orgId, request.body);
            
            return reply.code(200).send({ 
                success: true, 
                message: 'Whitelabel settings saved successfully',
                branding: config 
            });
        } catch (error) {
            request.log.error(error);
            if (error.message.includes('Invalid')) {
                return reply.code(400).send({ error: error.message });
            }
            return reply.code(500).send({ error: 'Failed to save whitelabel configuration' });
        }
    });
}

module.exports = whitelabelRoutes;

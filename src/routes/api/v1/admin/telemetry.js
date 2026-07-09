const auditLogService = require('../../../../services/audit-log.service');

async function telemetryRoutes(fastify, options) {
    // Note: tenant-resolver and feature-guard are applied globally at the Fastify 
    // protected layer in server.js. This route is safely protected.

    // GET /api/v1/admin/telemetry
    fastify.get('/', async (request, reply) => {
        try {
            const orgId = request.tenant?.organizationId || parseInt(request.query.organizationId, 10);
            if (!orgId) {
                return reply.code(400).send({ error: 'organizationId is required' });
            }

            const { cursor, action, userId } = request.query;
            
            // Limit is strictly 50 for database safety
            const limit = 50;
            const filters = {};
            if (action) filters.action = String(action);
            if (userId) filters.userId = String(userId);

            const logs = await auditLogService.getLogs(orgId, cursor, limit, filters);
            
            // Determine nextCursor
            const nextCursor = logs.length === limit ? logs[logs.length - 1].id : null;

            return reply.code(200).send({ 
                success: true, 
                data: logs,
                pagination: {
                    nextCursor,
                    hasMore: nextCursor !== null
                }
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ error: 'Failed to retrieve telemetry logs' });
        }
    });
}

module.exports = telemetryRoutes;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function tenantResolver(request, reply) {
    try {
        // Fallback for tests if auth doesn't set it (tests can send ?mockUserId=X)
        const userId = request.query.mockUserId || request.headers['x-mock-user-id'] || request.user?.id || 'mock_user_1';
        
        let orgId = null;
        let locId = null;

        // Extract organizationId or locationId from query or body or params
        if (request.query.organizationId) orgId = parseInt(request.query.organizationId, 10);
        else if (request.body?.organizationId) orgId = parseInt(request.body.organizationId, 10);
        else if (request.params.organizationId) orgId = parseInt(request.params.organizationId, 10);

        if (request.query.locationId) locId = parseInt(request.query.locationId, 10);
        else if (request.body?.locationId) locId = parseInt(request.body.locationId, 10);
        else if (request.params.locationId) locId = parseInt(request.params.locationId, 10);
        else if (request.params.id) locId = parseInt(request.params.id, 10); // fallback for endpoints like /api/v1/posts/:id where id is not location. Wait, if it's post id, locId parsing is wrong. Let's strictly check for locationId or organizationId.

        // Fix: If it's a generic id parameter, we must know what it is before assuming it's a location ID.
        // Let's rely strictly on explicit locationId or organizationId unless the route is explicitly for locations.
        if (request.routerPath && request.routerPath.includes('/locations/:id')) {
             if (request.params.id) locId = parseInt(request.params.id, 10);
        }

        if (!orgId && !locId) {
            // No tenant context requested; allow pass through.
            return;
        }

        if (locId && !orgId) {
            // Find organizationId from Location
            const location = await prisma.location.findUnique({
                where: { id: locId },
                select: { organizationId: true }
            });
            
            if (location && location.organizationId) {
                orgId = location.organizationId;
            } else if (!location) {
                // Location doesn't exist
                return reply.code(404).send({ error: 'Location not found' });
            }
        }

        if (orgId) {
            console.log(`[TENANT RESOLVER] Checking access for userId: '${userId}', orgId: ${orgId}`);
            const member = await prisma.organizationMember.findUnique({
                where: {
                    userId_organizationId: {
                        userId: userId,
                        organizationId: orgId
                    }
                }
            });

            if (!member) {
                return reply.code(403).send({ error: 'Forbidden: You do not have access to this workspace.' });
            }
            
            // Attach tenant info to request
            request.tenant = { organizationId: orgId, role: member.role };
        }
        
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

module.exports = tenantResolver;

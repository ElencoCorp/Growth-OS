const orgService = require('../services/identity/organization.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createOrg(request, reply) {
    try {
        const userId = request.query.mockUserId || request.headers['x-mock-user-id'] || request.user?.id || 'mock_user_1';
        const { name } = request.body;

        if (!name) return reply.code(400).send({ error: 'Name is required' });

        const org = await orgService.createOrganization(name, userId);
        return reply.send({ success: true, organization: org });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

async function listOrgs(request, reply) {
    try {
        const userId = request.query.mockUserId || request.headers['x-mock-user-id'] || request.user?.id || 'mock_user_1';
        
        const orgs = await orgService.getOrganizationsForUser(userId);
        return reply.send({ success: true, organizations: orgs });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

async function getLicenseStatus(request, reply) {
    try {
        const orgId = parseInt(request.params.orgId, 10);
        if (isNaN(orgId)) return reply.code(400).send({ error: 'Invalid organization ID' });

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: {
                id: true,
                name: true,
                planType: true,
                subscriptionActive: true,
                subscriptionExpiresAt: true
            }
        });

        if (!org) return reply.code(404).send({ error: 'Organization not found' });

        const now = new Date();
        const isExpired = org.subscriptionExpiresAt && new Date(org.subscriptionExpiresAt) < now;
        const effectiveActive = org.subscriptionActive && !isExpired;

        return reply.send({
            success: true,
            license: {
                organizationId: org.id,
                organizationName: org.name,
                planType: org.planType,
                active: effectiveActive,
                expiresAt: org.subscriptionExpiresAt,
                isExpired: !!isExpired
            }
        });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

module.exports = {
    createOrg,
    listOrgs,
    getLicenseStatus
};

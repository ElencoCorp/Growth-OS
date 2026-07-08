const orgService = require('../services/identity/organization.service');

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

module.exports = {
    createOrg,
    listOrgs
};

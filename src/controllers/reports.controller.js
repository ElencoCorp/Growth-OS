const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const reportAggregator = require('../services/reporting/report-aggregator.service');

async function updateWhiteLabelSettings(request, reply) {
    try {
        const orgId = parseInt(request.params.organizationId, 10);
        const { agencyName, logoUrl, primaryColor } = request.body;

        if (isNaN(orgId)) return reply.code(400).send({ error: 'Invalid organization ID' });

        const settings = JSON.stringify({ agencyName, logoUrl, primaryColor });

        const updatedOrg = await prisma.organization.update({
            where: { id: orgId },
            data: { whiteLabelSettings: settings }
        });

        return reply.send({ success: true, organization: updatedOrg });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

async function triggerManualReport(request, reply) {
    try {
        const { locationId, organizationId } = request.body;

        if (!locationId || !organizationId) {
            return reply.code(400).send({ error: 'locationId and organizationId are required' });
        }

        const snapshot = await reportAggregator.generateLocationReport(parseInt(locationId, 10), parseInt(organizationId, 10));

        return reply.send({ success: true, snapshot });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

async function listReports(request, reply) {
    try {
        const locationId = parseInt(request.query.locationId, 10);
        if (isNaN(locationId)) return reply.code(400).send({ error: 'Invalid location ID' });
        
        const reports = await prisma.reportSnapshot.findMany({
            where: { locationId },
            orderBy: { generatedAt: 'desc' }
        });
        
        return reply.send({ success: true, reports });
    } catch(error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

module.exports = {
    updateWhiteLabelSettings,
    triggerManualReport,
    listReports
};

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const execSummaryService = require('../services/ai/executive-summary.service');
const syncJob = require('../jobs/sync-insights.job');

/**
 * Triggers the background job to sync insights and returns 202 Accepted.
 */
async function triggerSync(request, reply) {
    try {
        const locationId = parseInt(request.params.id, 10);
        if (isNaN(locationId)) return reply.code(400).send({ error: 'Invalid location ID' });

        const location = await prisma.location.findUnique({ where: { id: locationId } });
        if (!location) return reply.code(404).send({ error: 'Location not found' });

        // Fire and forget the background job
        syncJob.runInsightsSyncJob(locationId).catch(err => {
            console.error(`[Background Job Error] Insights sync failed for location ${locationId}:`, err);
        });

        // Immediately return 202
        return reply.code(202).send({ success: true, message: 'Sync job started' });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

/**
 * Fetches analytics data and generates an AI summary.
 */
async function getAnalytics(request, reply) {
    try {
        const locationId = parseInt(request.params.id, 10);
        if (isNaN(locationId)) return reply.code(400).send({ error: 'Invalid location ID' });

        const location = await prisma.location.findUnique({ where: { id: locationId } });
        if (!location) return reply.code(404).send({ error: 'Location not found' });

        const metricSnapshots = await prisma.metricSnapshot.findMany({
            where: { locationId: locationId },
            orderBy: { date: 'desc' },
            take: 30 // Get up to last 30 snapshots
        });

        const summaryText = await execSummaryService.generateInsightSummary(metricSnapshots);

        return reply.send({
            success: true,
            healthScore: location.healthScore,
            lastInsightsSync: location.lastInsightsSync,
            snapshots: metricSnapshots,
            executiveSummary: summaryText
        });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

module.exports = {
    triggerSync,
    getAnalytics
};

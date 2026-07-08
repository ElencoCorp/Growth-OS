const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const insightsService = require('../services/google/insights.service');
const healthService = require('../services/analytics/health.service');

async function runInsightsSyncJob(locationId) {
    try {
        console.log(`[Job] Starting insights sync for location ${locationId}...`);
        
        // 1. Fetch metrics from insights.service.js
        const metrics = await insightsService.fetchPerformanceMetrics(locationId);

        // 2. Save a new MetricSnapshot in Prisma
        await prisma.metricSnapshot.create({
            data: {
                locationId: locationId,
                date: new Date(), // using today as the snapshot date
                profileViews: metrics.profileViews,
                searchQueries: metrics.searchQueries,
                interactions: metrics.interactions
            }
        });

        // 3. Fetch recent reviews and recent metric snapshots
        const recentReviews = await prisma.review.findMany({
            where: { locationId: locationId },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        const metricSnapshots = await prisma.metricSnapshot.findMany({
            where: { locationId: locationId },
            orderBy: { date: 'desc' },
            take: 5
        });

        // 4. Calculate new healthScore via health.service.js
        const newScore = healthService.calculateHealthScore(recentReviews, metricSnapshots);

        // 5. Update the Location table with the new score and lastInsightsSync
        await prisma.location.update({
            where: { id: locationId },
            data: {
                healthScore: newScore,
                lastInsightsSync: new Date()
            }
        });

        console.log(`[Job] Completed insights sync for location ${locationId}. New Health Score: ${newScore}`);
    } catch (error) {
        console.error(`[Job] Error syncing insights for location ${locationId}:`, error.message);
    }
}

module.exports = {
    runInsightsSyncJob
};

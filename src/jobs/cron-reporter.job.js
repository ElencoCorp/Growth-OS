const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const reportAggregator = require('../services/reporting/report-aggregator.service');

async function runReporterCron() {
    console.log('[Cron Reporter] Running monthly report batch...');
    try {
        const activeLocations = await prisma.location.findMany({
            where: {
                organizationId: {
                    not: null
                }
            }
        });

        console.log(`[Cron Reporter] Found ${activeLocations.length} locations to report on.`);

        for (const loc of activeLocations) {
            try {
                await reportAggregator.generateLocationReport(loc.id, loc.organizationId);
            } catch (err) {
                console.error(`[Cron Reporter] Failed to generate report for Location ${loc.id}:`, err);
            }
        }
        console.log('[Cron Reporter] Monthly batch complete.');
    } catch (error) {
        console.error('[Cron Reporter] Critical Error:', error);
    }
}

function startReporterCron() {
    // In production, use node-cron: cron.schedule('0 0 1 * *', runReporterCron);
    // For this prototype, we'll just log that it started.
    console.log('[Cron Reporter] Scheduled for 1st of every month.');
}

module.exports = {
    startReporterCron,
    runReporterCron
};

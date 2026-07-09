const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const automationOrchestrator = require('./automation-orchestrator.service');

// System setup hook
async function initCronSystem() {
    console.log('[Cron Runner] Initializing system state...');
    try {
        // Transition stuck RUNNING flags to FAILED on boot
        const stuckJobs = await prisma.cronJob.updateMany({
            where: { status: 'RUNNING' },
            data: { status: 'FAILED' }
        });
        if (stuckJobs.count > 0) {
            console.warn(`[Cron Runner] Recovered ${stuckJobs.count} stuck jobs to FAILED state due to unexpected termination.`);
        }
    } catch (error) {
        console.error('[Cron Runner] Failed to initialize system:', error);
    }
}

// Ensure job exists
async function getOrCreateJob(jobName) {
    let job = await prisma.cronJob.findUnique({ where: { jobName } });
    if (!job) {
        job = await prisma.cronJob.create({
            data: { jobName, status: 'IDLE' }
        });
    }
    return job;
}

// Log execution metrics
async function logJobExecution(jobId, status, message, durationMs) {
    await prisma.cronJobLog.create({
        data: {
            cronJobId: jobId,
            status,
            message,
            durationMs
        }
    });
}

// Dispatch specific job execution
async function dispatchJob(jobName) {
    const job = await getOrCreateJob(jobName);

    if (job.status === 'RUNNING') {
        console.warn(`[Cron Runner] Job ${jobName} is already running. Skipping dispatch.`);
        return { success: false, message: 'Job already running.' };
    }

    await prisma.cronJob.update({
        where: { id: job.id },
        data: { status: 'RUNNING', lastRunAt: new Date() }
    });

    const startTime = Date.now();
    let finalStatus = 'COMPLETED';
    let finalMessage = 'Execution completed successfully.';

    try {
        if (jobName === 'WEEKLY_RADAR_SCAN') {
            await automationOrchestrator.runWeeklyRadarScan();
        } else {
            finalStatus = 'WARNING';
            finalMessage = `No handler defined for job: ${jobName}`;
        }
    } catch (error) {
        finalStatus = 'FAILED';
        finalMessage = error.message || 'Unknown error occurred.';
        console.error(`[Cron Runner] Error executing ${jobName}:`, error);
    }

    const durationMs = Date.now() - startTime;

    await prisma.cronJob.update({
        where: { id: job.id },
        data: { status: finalStatus === 'COMPLETED' ? 'IDLE' : finalStatus }
    });

    await logJobExecution(job.id, finalStatus, finalMessage, durationMs);

    return { success: finalStatus === 'COMPLETED', status: finalStatus, message: finalMessage };
}

// Get System Status
async function getSystemStatus() {
    return await prisma.cronJob.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
            logs: {
                orderBy: { executedAt: 'desc' },
                take: 1
            }
        }
    });
}

module.exports = {
    initCronSystem,
    dispatchJob,
    getSystemStatus
};

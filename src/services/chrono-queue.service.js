const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { dispatchTarget } = require('../workers/post-dispatcher.worker');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runBatchPostPublisher() {
    console.log('[Chrono Queue] Starting BATCH_POST_PUBLISHER run...');
    const startTime = Date.now();
    let processedTargetsCount = 0;
    let failedTargetsCount = 0;

    let cursor = null;
    let hasMore = true;

    // We get all ContentPieces that are QUEUED and scheduled in the past
    // But cursor pagination on ContentPiece directly is better
    try {
        while (hasMore) {
            const pieces = await prisma.contentPiece.findMany({
                where: {
                    status: 'QUEUED',
                    scheduledFor: { lte: new Date() }
                },
                take: 50,
                skip: cursor ? 1 : 0,
                cursor: cursor ? { id: cursor } : undefined,
                orderBy: { id: 'asc' },
                include: { targets: true }
            });

            if (pieces.length === 0) {
                hasMore = false;
                break;
            }

            for (const piece of pieces) {
                let pieceSuccess = true;

                for (const targetRel of piece.targets) {
                    if (targetRel.status === 'PENDING') {
                        // Dispatch the payload
                        const result = await dispatchTarget(targetRel.id);
                        if (!result.success) pieceSuccess = false;
                        else processedTargetsCount++;
                        
                        if(!result.success) failedTargetsCount++;
                        
                        // 500ms intentional delay payload stagger to protect SQLite & memory
                        await sleep(500);
                    }
                }

                // Update the parent piece status
                await prisma.contentPiece.update({
                    where: { id: piece.id },
                    data: { status: pieceSuccess ? 'PUBLISHED' : 'FAILED' }
                });
            }

            cursor = pieces[pieces.length - 1].id;
        }

        const durationMs = Date.now() - startTime;
        const totalSent = processedTargetsCount + failedTargetsCount;

        // Ensure job tracking exists
        let cronJob = await prisma.cronJob.findUnique({ where: { jobName: 'BATCH_POST_PUBLISHER' } });
        if (!cronJob) {
            cronJob = await prisma.cronJob.create({ data: { jobName: 'BATCH_POST_PUBLISHER', status: 'IDLE' } });
        }

        // Write CronJobLog
        await prisma.cronJobLog.create({
            data: {
                cronJobId: cronJob.id,
                status: failedTargetsCount === 0 ? 'COMPLETED' : 'WARNING',
                message: `Processed ${totalSent} targets. ${failedTargetsCount} failures.`,
                durationMs,
                recordsSent: totalSent
            }
        });

        console.log(`[Chrono Queue] Completed. Processed ${totalSent} targets in ${durationMs}ms.`);
    } catch (error) {
        console.error('[Chrono Queue] Fatal error during queue processing:', error);
        
        let cronJob = await prisma.cronJob.findUnique({ where: { jobName: 'BATCH_POST_PUBLISHER' } });
        if (cronJob) {
            await prisma.cronJobLog.create({
                data: {
                    cronJobId: cronJob.id,
                    status: 'FAILED',
                    message: error.message,
                    durationMs: Date.now() - startTime,
                    recordsSent: processedTargetsCount + failedTargetsCount
                }
            });
        }
    }
}

module.exports = {
    runBatchPostPublisher
};

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { publishContentPiece } = require('./content-studio.service');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runBatchPostPublisher() {
    console.log('[Chrono Queue] Starting BATCH_POST_PUBLISHER run...');
    const startTime = Date.now();
    let processedPiecesCount = 0;
    let failedPiecesCount = 0;
    let hasMore = true;

    try {
        // Resolve or create global CronJob tracker model once at the top
        let cronJob = await prisma.cronJob.findUnique({ where: { jobName: 'BATCH_POST_PUBLISHER' } });
        if (!cronJob) {
            cronJob = await prisma.cronJob.create({ data: { jobName: 'BATCH_POST_PUBLISHER', status: 'IDLE' } });
        }

        // Set Job status to RUNNING to lock concurrent runs
        await prisma.cronJob.update({ where: { id: cronJob.id }, data: { status: 'RUNNING', lastRunAt: new Date() } });

        while (hasMore) {
            // Audit Fix: Pull top 50 records dynamically without a static cursor layout
            // Since statuses mutate to PUBLISHED/FAILED, processed items naturally clear out of this query space
            const pieces = await prisma.contentPiece.findMany({
                where: {
                    status: 'QUEUED',
                    scheduledFor: { lte: new Date() }
                },
                take: 50,
                orderBy: { id: 'asc' }
            });

            if (pieces.length === 0) {
                hasMore = false;
                break;
            }

            for (const piece of pieces) {
                try {
                    // Delegate execution tracking directly to the content studio engine
                    const result = await publishContentPiece(piece.id);

                    if (result.status === 'PUBLISHED') {
                        processedPiecesCount++;
                    } else {
                        failedPiecesCount++;

                        // Extract target failures and write operational log nodes cleanly
                        const failedTargets = result.targets ? result.targets.filter(t => t.status === 'FAILED') : [];
                        for (const ft of failedTargets) {
                            await prisma.cronJobLog.create({
                                data: {
                                    cronJobId: cronJob.id,
                                    status: 'FAILED',
                                    message: `ContentPiece ${piece.id} -> Target Account ${ft.publishTargetId} failed: ${ft.errorMessage || 'Unknown execution threshold break'}`,
                                    durationMs: 0,
                                    recordsSent: 0
                                }
                            });
                        }
                    }

                    // 500ms intentional delay payload stagger to protect SQLite concurrency lines on your VPS
                    await sleep(500);
                } catch (pieceError) {
                    console.error(`[Chrono Queue] Intercepted error processing piece ${piece.id}:`, pieceError.message);
                    failedPiecesCount++;

                    // Safety Guardrail: Prevent processing loops from locking up if an unhandled promise drops
                    await prisma.contentPiece.update({
                        where: { id: piece.id },
                        data: { status: 'FAILED' }
                    });
                }
            }

            // Safety break: If every single item in this batch failed and remained in QUEUED state,
            // break manually to prevent an infinite processing loop on your VPS
            if (processedPiecesCount === 0 && failedPiecesCount >= pieces.length) {
                hasMore = false;
            }
        }

        const durationMs = Date.now() - startTime;
        const totalProcessed = processedPiecesCount + failedPiecesCount;

        // Reset Job status back to IDLE
        await prisma.cronJob.update({
            where: { id: cronJob.id },
            data: { status: failedPiecesCount === 0 ? 'IDLE' : 'FAILED', nextRunAt: new Date(Date.now() + 60000) }
        });

        if (totalProcessed > 0) {
            await prisma.cronJobLog.create({
                data: {
                    cronJobId: cronJob.id,
                    status: failedPiecesCount === 0 ? 'COMPLETED' : 'WARNING',
                    message: `Successfully processed execution array cycle. ${processedPiecesCount} published, ${failedPiecesCount} marked failed.`,
                    durationMs,
                    recordsSent: totalProcessed
                }
            });
            console.log(`[Chrono Queue] Completed. Processed ${totalProcessed} items in ${durationMs}ms.`);
        }
    } catch (error) {
        console.error('[Chrono Queue] Fatal failure encountered within queue daemon:', error);

        let cronJob = await prisma.cronJob.findUnique({ where: { jobName: 'BATCH_POST_PUBLISHER' } });
        if (cronJob) {
            await prisma.cronJob.update({ where: { id: cronJob.id }, data: { status: 'FAILED' } });
            await prisma.cronJobLog.create({
                data: {
                    cronJobId: cronJob.id,
                    status: 'FAILED',
                    message: `Fatal operational error: ${error.message}`,
                    durationMs: Date.now() - startTime,
                    recordsSent: processedPiecesCount + failedPiecesCount
                }
            });
        }
    }
}

// Lightweight, non-blocking interval loop (running every 60 seconds)
function startQueueDaemon() {
    console.log('[Chrono Queue] Daemon initialized. Polling configuration loops active.');
    // Schedule interval loop safely
    setInterval(runBatchPostPublisher, 60000);
}

module.exports = {
    runBatchPostPublisher,
    startQueueDaemon
};
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { publishContentPiece } = require('./content-studio.service');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runBatchPostPublisher() {
    console.log('[Chrono Queue] Starting BATCH_POST_PUBLISHER run...');
    const startTime = Date.now();
    let processedPiecesCount = 0;
    let failedPiecesCount = 0;

    let cursor = null;
    let hasMore = true;

    try {
        while (hasMore) {
            const pieces = await prisma.contentPiece.findMany({
                where: {
                    status: 'QUEUED',
                    scheduledFor: { lte: new Date() }
                },
                take: 50,
                skip: cursor ? 1 : 0,
                ...(cursor && { cursor: { id: cursor } }),
                orderBy: { id: 'asc' }
            });

            if (pieces.length === 0) {
                hasMore = false;
                break;
            }

            for (const piece of pieces) {
                try {
                    // Delegate the actual network dispatch lifecycle handling directly to the existing audited 'publishContentPiece' method
                    const result = await publishContentPiece(piece.id);
                    
                    if (result.status === 'PUBLISHED') {
                        processedPiecesCount++;
                    } else {
                        failedPiecesCount++;
                    }
                    
                    // 500ms intentional delay payload stagger to protect SQLite & memory
                    await sleep(500);
                } catch (pieceError) {
                    console.error(`[Chrono Queue] Error processing piece ${piece.id}:`, pieceError.message);
                    failedPiecesCount++;
                    // Ensure exceptions occurring within individual location iteration sets never kill the parent background daemon loop
                    await prisma.contentPiece.update({
                        where: { id: piece.id },
                        data: { status: 'FAILED' }
                    });
                }
            }

            cursor = pieces[pieces.length - 1].id;
        }

        const durationMs = Date.now() - startTime;
        const totalProcessed = processedPiecesCount + failedPiecesCount;

        if (totalProcessed > 0) {
            let cronJob = await prisma.cronJob.findUnique({ where: { jobName: 'BATCH_POST_PUBLISHER' } });
            if (!cronJob) {
                cronJob = await prisma.cronJob.create({ data: { jobName: 'BATCH_POST_PUBLISHER', status: 'IDLE' } });
            }

            await prisma.cronJobLog.create({
                data: {
                    cronJobId: cronJob.id,
                    status: failedPiecesCount === 0 ? 'COMPLETED' : 'WARNING',
                    message: `Processed ${totalProcessed} queued posts. ${failedPiecesCount} failures.`,
                    durationMs,
                    recordsSent: totalProcessed
                }
            });
            console.log(`[Chrono Queue] Completed. Processed ${totalProcessed} pieces in ${durationMs}ms.`);
        } else {
            console.log(`[Chrono Queue] Completed. No pending queued posts found.`);
        }
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
                    recordsSent: processedPiecesCount + failedPiecesCount
                }
            });
        }
    }
}

// Lightweight, non-blocking interval loop (running every 60 seconds)
function startQueueDaemon() {
    console.log('[Chrono Queue] Daemon started. Polling every 60 seconds.');
    // Run immediately on boot
    runBatchPostPublisher();
    // Then schedule interval
    setInterval(runBatchPostPublisher, 60000);
}

module.exports = {
    runBatchPostPublisher,
    startQueueDaemon
};

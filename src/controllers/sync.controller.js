const { runSyncReviewsJob } = require('../jobs/sync-reviews.job');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function triggerReviewSync(request, reply) {
    try {
        const locationId = parseInt(request.params.locationId, 10);
        
        if (isNaN(locationId)) {
            return reply.code(400).send({ error: 'Invalid location ID' });
        }

        // Basic check if location exists
        const location = await prisma.location.findUnique({ where: { id: locationId } });
        if (!location) {
            return reply.code(404).send({ error: 'Location not found' });
        }

        // Fire and forget (decoupled)
        runSyncReviewsJob(locationId).catch(err => {
            console.error(`[Background Job Error] ${err.message}`);
        });

        // 202 Accepted
        return reply.code(202).send({ 
            success: true, 
            message: 'Review sync job accepted and is running in the background.' 
        });

    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

module.exports = {
    triggerReviewSync
};

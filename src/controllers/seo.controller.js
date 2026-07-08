const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const syncJob = require('../jobs/sync-rankings.job');

async function addKeyword(request, reply) {
    try {
        const { locationId, term, lat, lng } = request.body;
        
        if (!locationId || !term) {
            return reply.code(400).send({ error: 'locationId and term are required' });
        }

        const keyword = await prisma.keyword.create({
            data: {
                locationId: parseInt(locationId, 10),
                term,
                lat: lat ? parseFloat(lat) : null,
                lng: lng ? parseFloat(lng) : null
            }
        });

        return reply.code(201).send({ success: true, keyword });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

async function triggerSync(request, reply) {
    try {
        const locationId = parseInt(request.params.locationId, 10);
        if (isNaN(locationId)) return reply.code(400).send({ error: 'Invalid location ID' });

        // Fire and forget
        syncJob.runRankingsSyncJob(locationId).catch(err => {
            console.error(`[Background Job Error] Rankings sync failed for location ${locationId}:`, err);
        });

        return reply.code(202).send({ success: true, message: 'Rankings sync job started' });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

async function getCompetitors(request, reply) {
    try {
        const locationId = parseInt(request.params.locationId, 10);
        if (isNaN(locationId)) return reply.code(400).send({ error: 'Invalid location ID' });

        const keywords = await prisma.keyword.findMany({
            where: { locationId: locationId },
            include: {
                rankingSnapshots: {
                    orderBy: { date: 'desc' },
                    take: 1
                }
            }
        });

        // Format for frontend
        const trackedKeywords = keywords.map(kw => {
            const latestSnapshot = kw.rankingSnapshots[0];
            return {
                id: kw.id,
                term: kw.term,
                rank: latestSnapshot ? latestSnapshot.rank : null,
                topCompetitors: latestSnapshot ? latestSnapshot.topCompetitors : null,
                lastUpdated: latestSnapshot ? latestSnapshot.date : null
            };
        });

        return reply.send({ success: true, trackedKeywords });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

module.exports = {
    addKeyword,
    triggerSync,
    getCompetitors
};

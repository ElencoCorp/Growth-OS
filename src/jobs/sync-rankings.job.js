const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const rankTracker = require('../services/seo/rank-tracker.service');
const competitorService = require('../services/seo/competitor.service');

async function runRankingsSyncJob(locationId) {
    try {
        console.log(`[Job] Starting rankings sync for location ${locationId}...`);
        
        // 1. Fetch all tracked keywords for the location
        const keywords = await prisma.keyword.findMany({
            where: { locationId: parseInt(locationId, 10) }
        });

        if (!keywords || keywords.length === 0) {
            console.log(`[Job] No tracked keywords found for location ${locationId}.`);
            return;
        }

        // 2. Loop through each keyword and fetch SERP data
        for (const kw of keywords) {
            try {
                const serpData = await rankTracker.fetchKeywordRanking(kw.term, kw.lat, kw.lng);
                const topCompetitors = competitorService.extractTopCompetitors(serpData);

                // 3. Save the RankingSnapshot
                await prisma.rankingSnapshot.create({
                    data: {
                        keywordId: kw.id,
                        date: new Date(),
                        rank: serpData.rank,
                        topCompetitors: topCompetitors
                    }
                });
                
                console.log(`[Job] Synced keyword "${kw.term}" -> Rank: ${serpData.rank}`);
            } catch (err) {
                console.error(`[Job] Failed to sync keyword "${kw.term}":`, err.message);
            }
        }

        console.log(`[Job] Completed rankings sync for location ${locationId}.`);
    } catch (error) {
        console.error(`[Job] Error syncing rankings for location ${locationId}:`, error.message);
    }
}

module.exports = {
    runRankingsSyncJob
};

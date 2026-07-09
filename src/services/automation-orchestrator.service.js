const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const contentStudioService = require('./content-studio.service');

// Utility for randomized pacing
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomJitter = () => Math.floor(Math.random() * (1500 - 500 + 1)) + 500;

async function runWeeklyRadarScan() {
    console.log('[Automation Orchestrator] Starting WEEKLY_RADAR_SCAN...');
    
    let cursor = null;
    let hasMore = true;
    let processedCount = 0;

    while (hasMore) {
        const locations = await prisma.location.findMany({
            take: 50,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { id: 'asc' }
        });

        if (locations.length === 0) {
            hasMore = false;
            break;
        }

        for (const loc of locations) {
            try {
                // Simulate an internal fetch of latest radar footprint for this location
                // Realistically, this would trigger radar-tracker.service to perform scanning
                // Here we evaluate existing footprint drops as requested.
                const keywords = await prisma.radarKeyword.findMany({
                    where: { locationId: String(loc.id) },
                    include: {
                        rankHistories: {
                            orderBy: { capturedAt: 'desc' },
                            take: 2
                        }
                    }
                });

                for (const kw of keywords) {
                    if (kw.rankHistories.length >= 2) {
                        const currentRank = kw.rankHistories[0].rankPlacement;
                        const previousRank = kw.rankHistories[1].rankPlacement;

                        // Check if it dropped out of the Top 3 Map-Pack
                        if (previousRank > 0 && previousRank <= 3 && (currentRank > 3 || currentRank === 0)) {
                            console.log(`[Automation Orchestrator] Signal Drop detected for Loc ${loc.id}, Keyword "${kw.keywordText}" (Rank ${previousRank} -> ${currentRank}). Triggering recovery.`);
                            
                            const competitorMap = kw.rankHistories[0].competitorMap;
                            let topCompetitorName = "a local competitor";
                            try {
                                const parsedComps = JSON.parse(competitorMap);
                                if (parsedComps.length > 0) topCompetitorName = parsedComps[0].name;
                            } catch(e) {}

                            // The specific prompt injection requested
                            const topic = `Contextual Update: The competitor "${topCompetitorName}" has shifted positions and currently ranks higher than our location for the target query "${kw.keywordText}". \n\nAction Constraint: Generate a highly relevant recovery promotional update highlighting local authority, immediate availability, and proximity proximity validation.`;

                            // Trigger Content Studio synchronously 
                            await contentStudioService.generateLocalPost(loc.id, topic);
                        }
                    }
                }
            } catch (error) {
                // Safe lock trapping
                if (error.code === 'P2034' || error.message.includes('lock') || error.message.includes('timeout')) {
                    console.warn(`[Automation Orchestrator] Write-lock intercepted on Location ${loc.id}. Skipping.`, error.message);
                } else {
                    console.error(`[Automation Orchestrator] Unexpected error on Location ${loc.id}:`, error.message);
                }
            }

            processedCount++;
            
            // Jitter spacing: 500ms - 1500ms
            await sleep(randomJitter());
        }

        cursor = locations[locations.length - 1].id;
    }

    console.log(`[Automation Orchestrator] Completed scan. Processed ${processedCount} locations.`);
}

module.exports = {
    runWeeklyRadarScan
};

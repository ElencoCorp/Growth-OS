const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy_key_to_init' });
const contentStudio = require('./content-studio.service');
const { simulateLocalSERP } = require('./serp-parser.service');
const fetch = globalThis.fetch;

async function analyzeCompetitorGap(competitorMapStr, keyword, locationName) {
    const apiKey = process.env.TEXT_API_KEY;
    if (!apiKey) {
        return "1. Monitor local review velocity.\n2. Ensure GBP profile completeness.\n3. Post consistent updates.";
    }

    const systemPrompt = `You are a Local SEO Analyst specializing in the Indian market.
STRICT COMPLIANCE RULES (Indian Data Compliance):
1. No unverified claims or guarantees of ranking.
2. Zero defamatory text vectors against competitors.
3. Keep recommendations hyper-localized and actionable.
4. Output EXACTLY 3 concise bullet points. No introductory text. No concluding text.`;

    const userPrompt = `Keyword: "${keyword}"\nLocation Context: "${locationName}"\nCompetitors Data:\n${competitorMapStr}\n\nGenerate 3 actionable local SEO optimization bullets based on the competitor landscape.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'llama3-8b-8192',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.5
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Groq HTTP error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
    } catch (error) {
        clearTimeout(timeoutId);
        console.warn('[Radar Tracker] Groq API call failed during competitor gap analysis.', error.message);
        return "1. Run a local citations audit.\n2. Increase customer review generation.\n3. Publish localized content to improve relevancy signals.";
    }
}

async function addKeyword(keywordText, locationId, organizationId) {
    return await prisma.radarKeyword.create({
        data: {
            keywordText,
            locationId: parseInt(locationId, 10),
            organizationId: parseInt(organizationId, 10)
        }
    });
}

async function listKeywords(locationId) {
    return await prisma.radarKeyword.findMany({
        where: { locationId: parseInt(locationId, 10) },
        include: {
            rankHistories: {
                orderBy: { capturedAt: 'desc' },
                take: 1
            }
        },
        orderBy: { createdAt: 'desc' }
    });
}

async function trackKeywordPlacement(keywordId) {
    const keywordRec = await prisma.radarKeyword.findUnique({
        where: { id: keywordId },
        include: { location: true }
    });

    if (!keywordRec) throw new Error('Keyword not found');

    const locationName = keywordRec.location ? keywordRec.location.name : 'Target Location';

    try {
        // Invoke parsing layer
        const serpData = simulateLocalSERP(keywordRec.keywordText, locationName);
        
        // Serialize competitor profile
        const competitorMapStr = JSON.stringify(serpData.competitors);

        // Fetch previous history to detect drop
        const lastHistory = await prisma.radarHistory.findFirst({
            where: { keywordId: keywordRec.id },
            orderBy: { capturedAt: 'desc' }
        });

        // Commit new history record
        const historyNode = await prisma.radarHistory.create({
            data: {
                keywordId: keywordRec.id,
                rankPlacement: serpData.clientRank,
                competitorMap: competitorMapStr
            }
        });

        // Trigger AI Evaluation on the map distribution
        const aiInsights = await analyzeCompetitorGap(competitorMapStr, keywordRec.keywordText, locationName);

        // AUTO-PILOT LOGIC: Detect ranking drop
        if (lastHistory && serpData.clientRank > lastHistory.rankPlacement && keywordRec.location && keywordRec.location.autoPilotEnabled) {
            console.log(`[Auto-Pilot] Ranking drop detected for location ${keywordRec.locationId}. Triggering automated recovery post.`);
            // Fire and forget
            contentStudio.createDraftPost(
                keywordRec.locationId, 
                `Our ranking for ${keywordRec.keywordText} dropped to #${serpData.clientRank}. Create an engaging post to drive local traffic and highlight our expertise in ${locationName}.`
            ).catch(err => console.error('[Auto-Pilot] Content generation failed:', err));
        }

        return {
            history: historyNode,
            insights: aiInsights
        };
    } catch (error) {
        console.error(`[Radar Tracker] Tracking failure on keyword ${keywordId}:`, error.message);
        
        // Fallback to latest historical value
        const lastHistory = await prisma.radarHistory.findFirst({
            where: { keywordId: keywordRec.id },
            orderBy: { capturedAt: 'desc' }
        });

        return {
            error: true,
            message: 'Failed to complete scan. Falling back to cached history.',
            history: lastHistory,
            insights: null
        };
    }
}

module.exports = {
    addKeyword,
    listKeywords,
    trackKeywordPlacement,
    analyzeCompetitorGap
};

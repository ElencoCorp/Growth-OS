const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fetch = globalThis.fetch;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const AI_MODEL = 'llama3-8b-8192';

async function generateSeoRecommendations(keywordText, locationName, currentRank, competitors) {
    const apiKey = process.env.TEXT_API_KEY;
    if (!apiKey) {
        return ['Optimize your GBP profile.', 'Increase weekly Google Posts.', 'Gather more positive local reviews.'];
    }

    const systemPrompt = `You are a Local SEO Expert. Given the competitor data and current ranking, provide exactly 3 actionable, highly specific bullet points to improve the map-pack ranking. DO NOT output any introductory text, only the 3 bullet points.`;
    const userPrompt = `Target Keyword: ${keywordText}\nBusiness Name: ${locationName}\nCurrent Rank: ${currentRank > 0 ? currentRank : 'Unranked'}\nCompetitors: ${JSON.stringify(competitors)}\n\nDraft the 3 actionable local SEO steps:`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: AI_MODEL,
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
        const content = data.choices[0].message.content.trim();
        return content.split('\n').filter(line => line.trim().length > 0);
    } catch (error) {
        clearTimeout(timeoutId);
        console.warn('[RadarTrackerService] Groq API call failed or timeout. Using fallback recommendations.', error.message);
        return ['Optimize your GBP profile.', 'Increase weekly Google Posts.', 'Gather more positive local reviews.'];
    }
}

async function getKeywords(locationId) {
    const keywords = await prisma.radarKeyword.findMany({
        where: { locationId: String(locationId) },
        include: {
            rankHistories: {
                orderBy: { capturedAt: 'desc' },
                take: 1
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return keywords.map(kw => ({
        id: kw.id,
        keywordText: kw.keywordText,
        currentRank: kw.rankHistories.length > 0 ? kw.rankHistories[0].rankPlacement : 0,
        lastScanned: kw.rankHistories.length > 0 ? kw.rankHistories[0].capturedAt : null
    }));
}

async function addKeyword(locationId, organizationId, keywordText) {
    const keyword = await prisma.radarKeyword.create({
        data: {
            locationId: String(locationId),
            organizationId: String(organizationId),
            keywordText
        }
    });
    return keyword;
}

// Mocks a scraper payload based on target keywords
async function mockSerpScraper(keywordText) {
    // Simulate a random delay or timeout based on env variable for testing
    if (process.env.SIMULATE_SCRAPER_TIMEOUT === 'true') {
        throw new Error('ScraperTimeout: Upstream SERP API timeout');
    }

    // Generate deterministic mock competitor data based on length of keyword
    const length = keywordText.length;
    const rankPlacement = (length % 15) + 1; // Random rank 1-15
    const competitors = [
        { name: 'Apex Dental', rank: 1, reviews: 150 },
        { name: 'Smile Studio', rank: 2, reviews: 120 },
        { name: 'Downtown Care', rank: 3, reviews: 90 }
    ];

    return { rankPlacement, competitors };
}

async function trackKeyword(keywordId) {
    const keyword = await prisma.radarKeyword.findUnique({
        where: { id: keywordId }
    });

    if (!keyword) {
        throw new Error('Keyword not found');
    }

    try {
        const { rankPlacement, competitors } = await mockSerpScraper(keyword.keywordText);

        const history = await prisma.radarHistory.create({
            data: {
                keywordId: keyword.id,
                rankPlacement,
                competitorMap: JSON.stringify(competitors)
            }
        });

        // Generate AI Recommendations
        const insights = await generateSeoRecommendations(keyword.keywordText, 'Our Business', rankPlacement, competitors);

        return { success: true, history, insights };
    } catch (error) {
        console.error('[RadarTrackerService] Scraping fault intercepted.', error.message);
        
        // Use latest valid cached node if available
        const latestHistory = await prisma.radarHistory.findFirst({
            where: { keywordId: keyword.id },
            orderBy: { capturedAt: 'desc' }
        });

        if (latestHistory) {
            return {
                success: false,
                fallback: true,
                message: 'Scraping timeout. Displaying cached results.',
                history: latestHistory,
                insights: ['Optimize your GBP profile.', 'Increase weekly Google Posts.', 'Gather more positive local reviews.']
            };
        }

        throw new Error('Upstream API failure and no cached history available.');
    }
}

module.exports = {
    getKeywords,
    addKeyword,
    trackKeyword
};

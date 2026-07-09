const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fetch = globalThis.fetch;

async function translateErrorTrace(rawErrorTrace) {
    const apiKey = process.env.TEXT_API_KEY;
    if (!apiKey) {
        return `API Error: ${rawErrorTrace}`;
    }

    const systemPrompt = `You are a DevOps assistant. Transform this cryptic raw API trace into a brief, human-readable notification snippet (e.g., "Action Required: Google Profile token disconnected for the Ravet branch"), allowing the agency to fix it instantly. Keep it under 20 words.`;
    const userPrompt = `Raw Error Trace: ${rawErrorTrace}\n\nTranslation:`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

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
                temperature: 0.3
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
        console.warn('[Post Dispatcher Worker] Groq API call failed during error translation.', error.message);
        return `API Error: ${rawErrorTrace.substring(0, 50)}...`;
    }
}

async function dispatchTarget(targetId) {
    const targetRel = await prisma.contentPieceTarget.findUnique({
        where: { id: targetId },
        include: { publishTarget: { include: { platformCredential: true } }, contentPiece: true }
    });

    if (!targetRel) throw new Error('Target not found');

    const platform = targetRel.publishTarget.platformCredential.platform;

    try {
        console.log(`[Post Dispatcher] Dispatching to ${platform} for target ${targetRel.publishTarget.platformAccountId}...`);
        
        // Simulating network call payload & random failures for testing
        if (Math.random() < 0.1 || process.env.MOCK_API_FAIL === 'true') {
            throw new Error(`OAuthTokenExpiredException: The access token for ${platform} has expired or was revoked.`);
        }
        
        await prisma.contentPieceTarget.update({
            where: { id: targetRel.id },
            data: { status: 'PUBLISHED', publishedAt: new Date(), externalPostId: `ext-${platform}-${Date.now()}` }
        });
        return { success: true };
    } catch (error) {
        console.error(`[Post Dispatcher] Network payload failed for ${platform}:`, error.message);
        
        const humanReadableError = await translateErrorTrace(error.message);
        
        await prisma.contentPieceTarget.update({
            where: { id: targetRel.id },
            data: { status: 'FAILED', errorMessage: humanReadableError }
        });
        
        return { success: false, errorMessage: humanReadableError };
    }
}

module.exports = {
    translateErrorTrace,
    dispatchTarget
};

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateText } = require('./providers/text.provider');
const { generateImage } = require('./providers/image.provider');

async function validateAndParseVariant(text, keywords) {
    try {
        let parsed = JSON.parse(text);
        let variants = parsed.variants;
        if (!variants || !Array.isArray(variants) || variants.length === 0) {
            throw new Error("No variants array found in JSON.");
        }
        
        // Validation rules
        for (let v of variants) {
            if (!v.headline || !v.body || !v.cta || !Array.isArray(v.hashtags)) {
                throw new Error("Variant missing required fields (headline, body, cta, hashtags).");
            }
            if (v.hashtags.length < 3 || v.hashtags.length > 5) {
                throw new Error("Hashtag count out of bounds (must be 3-5).");
            }
            
            // Check keywords exist (simple check)
            if (keywords) {
                const keywordArray = keywords.split(',').map(k => k.trim().toLowerCase());
                const allText = (v.headline + " " + v.body).toLowerCase();
                const hasKeyword = keywordArray.some(k => allText.includes(k));
                if (!hasKeyword) {
                    throw new Error(`Variant body missing target keywords: ${keywords}`);
                }
            }
        }
        return parsed;
    } catch (err) {
        throw err;
    }
}

/**
 * AI Generation Router & Orchestration Engine
 * Routes the task to the correct prompt constructor, calls the provider, validates, and logs execution.
 */
async function dispatchGenerationTask(taskType, payload) {
    let systemPrompt = '';
    let userPrompt = '';
    
    // Inject Global Business Memory Context
    let businessContext = '';
    let location = null;
    let userId = payload.userId || 1; // Fallback to 1 if not passed in via token

    if (payload.locationId) {
        location = await prisma.location.findUnique({
            where: { id: parseInt(payload.locationId) },
            include: { business: true }
        });
        if (location) {
            const businessName = location.business?.name || location.name;
            const category = location.categories || location.business?.category || 'Local Business';
            businessContext = `Business Name: ${businessName}\nCategory: ${category}\nAddress: ${location.address || 'Local'}\n`;
        }
    }

    if (taskType === 'GOOGLE_BUSINESS_POST') {
        const { topic, goal, tone, keywords } = payload;
        systemPrompt = `You are an expert local business copywriter and strict JSON generator. NEVER output markdown blocks or raw text outside the JSON. Return exactly ONE JSON object matching this schema: { "variants": [{ "headline": "string", "body": "string", "cta": "string", "hashtags": ["#tag1"] }] } with EXACTLY 2 distinct variants (Version A and Version B) to give users direct comparison power.`;
        userPrompt = `Global Business Context:\n${businessContext}\nTask: GOOGLE_BUSINESS_POST\nTopic: ${topic}\nGoal: ${goal}\nKeywords: ${keywords}\nTone: ${tone}\n\nWrite an enthusiastic, friendly update post. Ensure the copy contains the target keywords. Use highly engaging local marketing emojis. Include exactly 3-5 relevant business hashtags per variant. Output ONLY raw JSON matching the required schema.`;
    } else if (taskType === 'REVIEW_REPLY') {
        const { reviewText } = payload;
        systemPrompt = `You are an empathetic customer service AI. Output ONLY JSON: { "variants": [{ "headline": "string (greeting)", "body": "string (reply)", "cta": "string (signoff)", "hashtags": [] }] } with EXACTLY 2 variants.`;
        userPrompt = `Global Business Context:\n${businessContext}\nTask: REVIEW_REPLY\nCustomer Review: "${reviewText}"\n\nWrite an empathetic customer response block. Do not insert marketing links or promotional up-selling. Output ONLY raw JSON.`;
    } else {
        throw new Error(`Unsupported task type: ${taskType}`);
    }

    let validationSuccess = false;
    let parsedResult = null;
    let finalLog = { provider: 'ollama', durationMs: 0, tokenUsage: {} };

    // Generation Loop with 1 recursive fallback
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const textResult = await generateText(systemPrompt, userPrompt, { provider: 'ollama', format: 'json' });
            finalLog = textResult;
            
            parsedResult = await validateAndParseVariant(textResult.responseText, payload.keywords);
            validationSuccess = true;
            break; // Success, break loop
        } catch (error) {
            console.warn(`[Generation Router] Attempt ${attempt} failed validation: ${error.message}`);
            if (attempt === 2) {
                // If it fails twice, return a fallback structure
                validationSuccess = false;
                parsedResult = {
                    variants: [{
                        headline: "Exciting Local Update",
                        body: `We are thrilled to share our latest local updates with you! Contact ${location?.name || 'us'} today.`,
                        cta: "Call us now",
                        hashtags: ["#LocalBusiness", "#Update", "#Community"]
                    }, {
                        headline: "Special Announcement",
                        body: `Check out what's new at ${location?.name || 'our business'}! We appreciate your continued support.`,
                        cta: "Visit us",
                        hashtags: ["#LocalBusiness", "#Announcement", "#SupportLocal"]
                    }]
                };
            }
        }
    }

    // Process image concurrently if it's a post
    let imagePath = null;
    if (taskType === 'GOOGLE_BUSINESS_POST') {
        const imgResult = await generateImage(payload.topic || payload.keywords);
        imagePath = imgResult.imagePath;
    }

    // Combine result
    const resultObj = {
        variants: parsedResult.variants,
        imagePath: imagePath,
        seoKeywordsUsed: payload.keywords ? payload.keywords.split(',').map(k => k.trim()) : []
    };

    // Logging Audit Engine
    try {
        await prisma.aiActionLog.create({
            data: {
                userId: userId,
                actionType: taskType,
                promptPayload: JSON.stringify({ payload, provider: finalLog.provider, validationSuccess }),
                responseBody: JSON.stringify(resultObj),
                tokenCost: finalLog.tokenUsage?.completion || 0,
                executionTime: finalLog.durationMs || 0
            }
        });
    } catch (logErr) {
        console.error('[Generation Router] Failed to save AiActionLog:', logErr);
    }

    return resultObj;
}

module.exports = { dispatchGenerationTask };

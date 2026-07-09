const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'test_dummy_key_to_allow_init' });

class WebhookProcessorService {

    /**
     * Translates messy external platform errors into concise, user-friendly warnings
     * adhering to Indian compliance guidelines using Groq AI.
     */
    async normalizeErrorPayload(provider, rawPayload) {
        try {
            const prompt = `
            You are a system compliance and diagnostic assistant for 'Growth-OS', an enterprise local SEO platform in India.
            An external provider (${provider}) has rejected a social media or directory post.
            
            Raw Error Payload:
            ${JSON.stringify(rawPayload)}
            
            Instructions:
            - Translate this technical error into a concise (1-2 sentences), user-friendly actionable warning.
            - Ensure it adheres to Indian data compliance (no defamatory language, no unverified medical/legal claims).
            - Explain exactly what the user needs to do to fix it.
            - Return ONLY the string message, no conversational filler or markdown.
            `;

            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama3-8b-8192',
                temperature: 0.2,
                max_tokens: 150
            });

            return completion.choices[0]?.message?.content?.trim() || "An unknown external error occurred.";
        } catch (error) {
            console.error('[WebhookProcessor] Groq Translation Failed:', error.message);
            return "External provider rejected the post. Please verify your content against platform guidelines.";
        }
    }

    /**
     * Core mutation handler that asynchronously matches the external post ID and updates state.
     */
    async processStatusCallback(provider, payload) {
        try {
            // Providers typically send an external ID and a status (e.g. { id: 'ext_123', status: 'FAILED', rawError: {...} })
            // For this milestone, we expect standard standardized mapping from the fastify receiver.
            const { externalPostId, status, rawError } = payload;

            if (!externalPostId) {
                console.error(`[WebhookProcessor] Missing externalPostId in ${provider} callback payload.`);
                return;
            }

            let finalErrorMessage = null;
            let finalStatus = status === 'FAILED' || status === 'REJECTED' ? 'FAILED' : 'PUBLISHED';

            if (finalStatus === 'FAILED' && rawError) {
                finalErrorMessage = await this.normalizeErrorPayload(provider, rawError);
            }

            // Atomically update the target matching the externalPostId
            // The Fastify receiver replied 200 immediately, so this happens in the background.
            const updatedTarget = await prisma.contentPieceTarget.updateMany({
                where: { externalPostId: externalPostId },
                data: {
                    status: finalStatus,
                    errorMessage: finalErrorMessage,
                    publishedAt: finalStatus === 'PUBLISHED' ? new Date() : undefined
                }
            });

            if (updatedTarget.count > 0) {
                console.log(`[WebhookProcessor] Successfully updated ${updatedTarget.count} targets for external post ${externalPostId} to ${finalStatus}`);
            } else {
                console.warn(`[WebhookProcessor] No ContentPieceTarget matched external post ${externalPostId}`);
            }
        } catch (error) {
            console.error(`[WebhookProcessor] Critical failure processing ${provider} webhook:`, error);
        }
    }
}

module.exports = new WebhookProcessorService();

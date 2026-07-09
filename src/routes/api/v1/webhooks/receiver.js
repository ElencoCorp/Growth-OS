const crypto = require('crypto');
const webhookProcessor = require('../../../../services/webhook-processor.service');

async function webhookReceiverRoutes(fastify, options) {

    /**
     * Validates cryptographic signature payload using SHA-256 HMAC
     * matching the WEBHOOK_SECRET. Falls back to a mock secret for testing.
     */
    function verifySignature(request, payloadString) {
        const secret = process.env.WEBHOOK_SECRET || 'test_secret_123';
        
        // Different providers use different signature headers. We check common ones.
        const signature = request.headers['x-hub-signature-256'] || 
                          request.headers['x-webhook-signature'] || 
                          request.headers['x-mock-signature'];

        if (!signature) {
            return false;
        }

        const hmac = crypto.createHmac('sha256', secret);
        const digest = 'sha256=' + hmac.update(payloadString).digest('hex');

        // Allow direct string match for simpler mock test validations, or strict timingSafeEqual for prod
        try {
            if (signature.startsWith('sha256=')) {
                return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
            } else {
                // If it's a raw hex signature without sha256= prefix
                return crypto.timingSafeEqual(
                    Buffer.from(signature), 
                    Buffer.from(hmac.update(payloadString).digest('hex'))
                );
            }
        } catch (e) {
            return signature === digest || signature === digest.replace('sha256=', '');
        }
    }

    // Explicitly disabling authentication or tenant guards for this route
    // It sits on the public internet, secured ONLY by cryptographic payloads.
    fastify.post('/receiver/:provider', async (request, reply) => {
        try {
            const { provider } = request.params;
            const payloadString = JSON.stringify(request.body);

            // 1. Strict Cryptographic Signature Validation
            if (!verifySignature(request, payloadString)) {
                request.log.warn(`[WebhookReceiver] Invalid signature intercepted from provider: ${provider}`);
                return reply.code(401).send({ error: 'Unauthorized: Invalid Cryptographic Signature' });
            }

            // 2. Async Handoff
            // Push heavy parsing, Groq AI translations, and database mutations into the background 
            // to ensure this Fastify thread is immediately freed up.
            setImmediate(() => {
                webhookProcessor.processStatusCallback(provider, request.body).catch(err => {
                    request.log.error(`[WebhookReceiver] Background processing failed for ${provider}:`, err);
                });
            });

            // 3. Lightning-fast acknowledgment to prevent external vendor rate-limits or retry storming.
            return reply.code(200).send({ success: true, message: 'Webhook Accepted' });

        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error' });
        }
    });
}

module.exports = webhookReceiverRoutes;

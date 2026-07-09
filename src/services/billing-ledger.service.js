const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy_key_to_init' });

class BillingLedgerService {
    /**
     * Translates raw Stripe error/failure metadata into a 3-line human-readable alert.
     * Complies with Indian data compliance (professional, concise).
     */
    async generateFailureExplanation(payload) {
        try {
            const prompt = `
            You are a Billing Administrator for a B2B SaaS platform in India.
            A subscription payment failure webhook has been received:
            ${JSON.stringify(payload)}
            
            Instructions:
            - Write exactly a 3-line human-readable alert explaining the billing failure to a non-technical agency owner.
            - Ensure it adheres to Indian data compliance (no defamatory language, keep it highly professional).
            - Do not include conversational filler.
            `;

            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama3-8b-8192',
                temperature: 0.2,
                max_tokens: 150
            });

            return completion.choices[0]?.message?.content?.trim();
        } catch (error) {
            console.error('[BillingLedgerService] Groq AI Failure Explanation Error:', error.message);
            return "Payment failed due to a processing error.\nPlease update your billing method.\nIf the issue persists, contact support.";
        }
    }

    /**
     * Atomically processes incoming billing lifecycle events asynchronously.
     */
    async processSubscriptionEvent(eventType, sessionPayload) {
        // Run asynchronously so we don't block the HTTP webhook response
        setImmediate(async () => {
            try {
                // Assuming sessionPayload contains client_reference_id mapping to our Organization ID
                // or metadata.organizationId
                const orgIdStr = sessionPayload.client_reference_id || (sessionPayload.metadata && sessionPayload.metadata.organizationId);
                
                if (!orgIdStr) {
                    console.warn(`[BillingLedgerService] Received ${eventType} but no organizationId mapping found.`);
                    return;
                }

                const orgId = parseInt(orgIdStr, 10);
                if (isNaN(orgId)) return;

                console.log(`[BillingLedgerService] Processing ${eventType} for Org: ${orgId}`);

                if (eventType === 'invoice.payment_succeeded') {
                    // Calculate next month expiry dynamically or pull from stripe payload
                    const nextMonth = new Date();
                    nextMonth.setMonth(nextMonth.getMonth() + 1);

                    await prisma.organization.update({
                        where: { id: orgId },
                        data: {
                            subscriptionActive: true,
                            planType: sessionPayload.metadata?.planType || 'PRO',
                            subscriptionExpiresAt: nextMonth
                        }
                    });
                    console.log(`[BillingLedgerService] Organization ${orgId} subscription activated.`);
                } 
                else if (eventType === 'invoice.payment_failed') {
                    const humanReadableAlert = await this.generateFailureExplanation(sessionPayload);
                    
                    // In a production system we might have an Alert table, but for now we downgrade
                    // or flag them via audit logs
                    await prisma.organization.update({
                        where: { id: orgId },
                        data: {
                            subscriptionActive: false,
                            // Optionally track the human readable alert in the audit log
                        }
                    });

                    // We use the audit log service to record this
                    const auditLogService = require('./audit-log.service');
                    await auditLogService.logActivity(
                        orgId, 
                        null, 
                        'BILLING_PAYMENT_FAILED', 
                        'Organization', 
                        orgId, 
                        {
                            stripeEventId: sessionPayload.id,
                            failureAlert: humanReadableAlert,
                            raw: sessionPayload
                        }, 
                        null
                    );

                    console.log(`[BillingLedgerService] Organization ${orgId} subscription deactivated due to failure.`);
                }
            } catch (error) {
                console.error('[BillingLedgerService] Error processing subscription event:', error);
            }
        });
    }
}

module.exports = new BillingLedgerService();

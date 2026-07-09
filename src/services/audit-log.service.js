const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy_key_to_init' });

class AuditLogService {
    /**
     * Translates messy internal stack traces or metadata arrays into a brief, 2-line plain 
     * English explanation using Groq AI.
     */
    async generateAnomalyExplanation(action, metadataObj) {
        if (!metadataObj || Object.keys(metadataObj).length === 0) return null;
        
        try {
            const prompt = `
            You are a system diagnostic AI for "Growth-OS", an enterprise local SEO platform in India.
            An audit log action "${action}" just occurred with the following raw metadata trace:
            ${JSON.stringify(metadataObj)}
            
            Instructions:
            - Translate this complex data block into a brief, 2-line plain English explanation.
            - Ensure it adheres to Indian data compliance (no defamatory language, keep it highly professional).
            - Explain the anomaly or action so a non-technical agency owner can understand what happened.
            - Return ONLY the string explanation, no conversational filler or markdown.
            `;

            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama3-8b-8192',
                temperature: 0.2,
                max_tokens: 100
            });

            return completion.choices[0]?.message?.content?.trim();
        } catch (error) {
            console.error('[AuditLogService] Groq Anomaly Explanation Failed:', error.message);
            return "System anomaly recorded. Manual inspection of metadata is required.";
        }
    }

    /**
     * Records immutable logging paths asynchronously.
     * This method catches all its inner errors so it never blocks the primary lifecycle.
     */
    async logActivity(orgId, userId, action, entityType, entityId, metadata, ip) {
        if (!orgId) return;

        // Execute asynchronously
        setImmediate(async () => {
            try {
                let metadataPayload = metadata || {};
                
                // If it's a critical error action, append an AI explanation to the metadata
                if (action.includes('ERROR') || action.includes('FAIL') || action.includes('CRITICAL')) {
                    const aiExplanation = await this.generateAnomalyExplanation(action, metadataPayload);
                    if (aiExplanation) {
                        metadataPayload = { ...metadataPayload, aiExplanation };
                    }
                }

                await prisma.auditLog.create({
                    data: {
                        organizationId: parseInt(orgId, 10),
                        userId: userId ? String(userId) : null,
                        action: action,
                        entityType: entityType,
                        entityId: entityId ? String(entityId) : null,
                        metadata: Object.keys(metadataPayload).length > 0 ? JSON.stringify(metadataPayload) : null,
                        ipAddress: ip || null
                    }
                });

            } catch (error) {
                console.error('[AuditLogService] Critical failure writing audit log:', error);
                // Fail silently to prevent disrupting upstream user response lifecycles
            }
        });
    }

    /**
     * Retrieves paginated historical activity logs for a specific organization.
     */
    async getLogs(orgId, cursor, limit = 50, filters = {}) {
        try {
            const query = {
                where: { organizationId: parseInt(orgId, 10) },
                take: limit,
                orderBy: { createdAt: 'desc' }
            };

            if (cursor) {
                query.cursor = { id: cursor };
                query.skip = 1; // Skip the cursor element itself
            }
            
            if (filters.action) {
                query.where.action = filters.action;
            }
            if (filters.userId) {
                query.where.userId = filters.userId;
            }

            const logs = await prisma.auditLog.findMany(query);
            return logs;
        } catch (error) {
            console.error('[AuditLogService] Failed to retrieve logs:', error);
            throw error;
        }
    }
}

module.exports = new AuditLogService();

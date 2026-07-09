const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy_key_to_init' });

class WhitelabelService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Retrieves the branding configuration for an organization,
     * utilizing a fast in-memory cache.
     */
    async getBrandingConfig(orgId) {
        if (!orgId) return null;

        if (this.cache.has(orgId)) {
            return this.cache.get(orgId);
        }

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { whiteLabelSettings: true }
        });

        let config = null;
        if (org && org.whiteLabelSettings) {
            try {
                config = JSON.parse(org.whiteLabelSettings);
            } catch (error) {
                console.error(`[WhitelabelService] Failed to parse whiteLabelSettings for org ${orgId}:`, error);
            }
        }

        // Fallback to default styling
        if (!config) {
            config = {
                appTitle: 'Growth-OS',
                brandPrimaryHex: '#4F46E5',
                brandSecondaryHex: '#4338CA',
                logoUrl: null,
                supportEmail: 'support@growthos.io',
                loginGreeting: 'Welcome to Growth-OS',
                emptyStateGuide: 'Get started by connecting your platforms.'
            };
        }

        this.cache.set(orgId, config);
        return config;
    }

    /**
     * Generates branded platform copy safely using Groq AI.
     */
    async generateBrandedCopy(agencyVoice, appTitle) {
        try {
            const prompt = `
            You are a B2B SaaS copywriter. Generate two short text strings for a marketing dashboard customized for a specific agency.
            Agency Details/Voice: "${agencyVoice || 'Professional and modern'}"
            App Title: "${appTitle || 'Growth-OS'}"

            Follow Indian data compliance rules (no defamatory language, keep it highly professional).
            
            Provide the output strictly in valid JSON format with exactly two keys:
            - "loginGreeting": A 3-5 word welcoming phrase for the login screen.
            - "emptyStateGuide": A 1-2 sentence instruction for when a dashboard is empty.

            Example format:
            { "loginGreeting": "Welcome back", "emptyStateGuide": "Connect your first platform to see analytics." }
            `;

            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama3-8b-8192',
                temperature: 0.3,
                max_tokens: 150
            });

            const content = completion.choices[0]?.message?.content?.trim();
            // Try to extract JSON if there's markdown wrapping
            let jsonString = content;
            if (content.startsWith('```json')) {
                jsonString = content.split('```json')[1].split('```')[0].trim();
            } else if (content.startsWith('```')) {
                jsonString = content.split('```')[1].split('```')[0].trim();
            }

            return JSON.parse(jsonString);
        } catch (error) {
            console.error('[WhitelabelService] Groq AI Copy Generation Failed:', error.message);
            return {
                loginGreeting: `Welcome to ${appTitle}`,
                emptyStateGuide: `Get started by exploring your new dashboard.`
            };
        }
    }

    /**
     * Validates and saves branding parameters to the database.
     */
    async saveBrandingConfig(orgId, payload) {
        if (!orgId) throw new Error('Organization ID is required');

        const { appTitle, brandPrimaryHex, brandSecondaryHex, logoUrl, supportEmail, agencyVoice } = payload;

        // Basic validation
        const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
        if (brandPrimaryHex && !hexRegex.test(brandPrimaryHex)) throw new Error('Invalid primary hex color code');
        if (brandSecondaryHex && !hexRegex.test(brandSecondaryHex)) throw new Error('Invalid secondary hex color code');

        // AI Copy Generation
        const customCopy = await this.generateBrandedCopy(agencyVoice, appTitle);

        const config = {
            appTitle: appTitle || 'Growth-OS',
            brandPrimaryHex: brandPrimaryHex || '#4F46E5',
            brandSecondaryHex: brandSecondaryHex || '#4338CA',
            logoUrl: logoUrl || null,
            supportEmail: supportEmail || 'support@growthos.io',
            loginGreeting: customCopy.loginGreeting,
            emptyStateGuide: customCopy.emptyStateGuide
        };

        const configString = JSON.stringify(config);

        await prisma.organization.update({
            where: { id: orgId },
            data: { whiteLabelSettings: configString }
        });

        // Purge memory cache
        this.cache.delete(orgId);

        return config;
    }
}

module.exports = new WhitelabelService();

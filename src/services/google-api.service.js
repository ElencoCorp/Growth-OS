const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const aiService = require('./ai.service.js');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'mock_client_id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'mock_client_secret';
const REDIRECT_URI = process.env.APP_URL ? `${process.env.APP_URL}/api/v1/auth/google/callback` : 'http://127.0.0.1:3000/api/v1/auth/google/callback';

/**
 * Fat service layer for Google Business Profile integration
 */
class GoogleApiService {
    /**
     * Get the Google OAuth Authorization URL
     */
    getAuthUrl() {
        const scopes = encodeURIComponent('https://www.googleapis.com/auth/business.manage');
        return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent`;
    }

    /**
     * Exchange the authorization code for access and refresh tokens
     * @param {string} code - The OAuth authorization code
     * @param {number} orgId - The Organization ID to attach credentials to
     */
    async exchangeCodeForTokens(code, orgId) {
        try {
            let access_token, refresh_token, expires_in;
            
            // If no real Client ID exists, mock the successful token exchange
            if (GOOGLE_CLIENT_ID === 'mock_client_id') {
                access_token = 'ya29.mock_access_token_' + Date.now();
                refresh_token = '1//mock_refresh_token_' + Date.now();
                expires_in = 3600; // 1 hour
            } else {
                const response = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        code,
                        client_id: GOOGLE_CLIENT_ID,
                        client_secret: GOOGLE_CLIENT_SECRET,
                        redirect_uri: REDIRECT_URI,
                        grant_type: 'authorization_code'
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(`Google OAuth exchange failed: ${JSON.stringify(error)}`);
                }

                const data = await response.json();
                access_token = data.access_token;
                refresh_token = data.refresh_token;
                expires_in = data.expires_in;
            }

            const expiresAt = new Date(Date.now() + expires_in * 1000);

            // Upsert the PlatformCredential for this Organization
            const credential = await prisma.platformCredential.upsert({
                where: {
                    id: (await prisma.platformCredential.findFirst({
                        where: { organizationId: orgId, platform: 'GOOGLE' }
                    }))?.id || -1 
                    // Using findFirst because there isn't a unique constraint on [organizationId, platform] in the schema
                },
                update: {
                    accessToken: access_token,
                    refreshToken: refresh_token || undefined, // Keep old refresh token if not returned
                    expiresAt: expiresAt,
                    updatedAt: new Date()
                },
                create: {
                    organizationId: orgId,
                    platform: 'GOOGLE',
                    accessToken: access_token,
                    refreshToken: refresh_token,
                    expiresAt: expiresAt
                }
            });

            return credential;
        } catch (error) {
            console.error('Error exchanging Google OAuth code:', error);
            throw error;
        }
    }

    /**
     * Checks token timestamps and uses the stored refresh token to pull a fresh access token
     * @param {number} orgId 
     * @returns {string} The valid access token
     */
    async refreshExpiredToken(orgId) {
        const credential = await prisma.platformCredential.findFirst({
            where: { organizationId: orgId, platform: 'GOOGLE' }
        });

        if (!credential) {
            throw new Error('No Google credentials found for this organization.');
        }

        // If the token expires in more than 5 minutes, it's still good
        if (credential.expiresAt && credential.expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
            return credential.accessToken;
        }

        if (!credential.refreshToken) {
            throw new Error('Access token expired and no refresh token available.');
        }

        // Token is expired or about to expire, refresh it
        try {
            let access_token, expires_in;
            
            if (GOOGLE_CLIENT_ID === 'mock_client_id') {
                access_token = 'ya29.mock_refreshed_token_' + Date.now();
                expires_in = 3600;
            } else {
                const response = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id: GOOGLE_CLIENT_ID,
                        client_secret: GOOGLE_CLIENT_SECRET,
                        refresh_token: credential.refreshToken,
                        grant_type: 'refresh_token'
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to refresh Google token.');
                }

                const data = await response.json();
                access_token = data.access_token;
                expires_in = data.expires_in;
            }

            const expiresAt = new Date(Date.now() + expires_in * 1000);

            await prisma.platformCredential.update({
                where: { id: credential.id },
                data: { accessToken: access_token, expiresAt, updatedAt: new Date() }
            });

            return access_token;
        } catch (error) {
            console.error('Error refreshing token:', error);
            throw error;
        }
    }

    /**
     * Communicates with the live Google My Business endpoints to return accounts and profile array logs.
     * @param {number} orgId 
     */
    async fetchConnectedLocations(orgId) {
        const token = await this.refreshExpiredToken(orgId);
        
        let locations = [];
        
        if (GOOGLE_CLIENT_ID === 'mock_client_id') {
            // Mock API Response for Account Discovery
            locations = [
                {
                    name: 'locations/123456789',
                    title: 'Growth-OS Dental Clinic - Ravet',
                    storeCode: 'RAVET-01',
                    categories: ['Dental Clinic', 'Orthodontist']
                },
                {
                    name: 'locations/987654321',
                    title: 'Growth-OS Spa & Wellness',
                    storeCode: 'SPA-02',
                    categories: ['Massage Spa', 'Wellness Center']
                }
            ];
        } else {
            // 1. Fetch Accounts
            const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const accountsData = await accountsRes.json();
            
            if (accountsData.accounts && accountsData.accounts.length > 0) {
                // 2. Fetch Locations for the primary account
                const accountName = accountsData.accounts[0].name;
                const locsRes = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storeCode,categories`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const locsData = await locsRes.json();
                locations = locsData.locations || [];
            }
        }

        return locations;
    }

    /**
     * Integrates Groq API to automatically parse discovered location categories 
     * and return 3 highly relevant initial keyword tracking recommendations 
     * tailored to Indian market data guidelines.
     * @param {Array<string>} categories 
     */
    async generateKeywordTrackingRecommendations(categories) {
        const categoryStr = categories.join(', ');
        const prompt = `You are an expert local SEO analyst for the Indian market. 
Given a local business with the following categories: "${categoryStr}", 
generate EXACTLY 3 highly relevant, high-conversion local SEO search terms that this business should track on their Map-Pack radar. 
The keywords should be natural to how Indian consumers search (e.g. including 'near me' or specific services).
Do not provide any conversational text, just a JSON array of 3 strings. Example: ["dentist near me", "best dental clinic", "teeth whitening price"]`;

        try {
            const resultText = await aiService.generateCompletion(prompt);
            // Attempt to parse the JSON array
            const jsonMatch = resultText.match(/\[.*\]/s);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return ["local service near me", "best rated service", "service price"];
        } catch (error) {
            console.error('Error generating keyword recommendations:', error);
            // Fallback keywords
            return ["best service near me", "top rated " + (categories[0] || 'business'), "affordable " + (categories[0] || 'service')];
        }
    }
}

module.exports = new GoogleApiService();

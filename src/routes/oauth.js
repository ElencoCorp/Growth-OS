const oauthPlugin = require('@fastify/oauth2');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cryptoUtils = require('../utils/crypto');

async function oauthRoutes(fastify, options) {
    // Register Google OAuth2 plugin
    fastify.register(oauthPlugin, {
        name: 'googleOAuth2',
        credentials: {
            client: {
                id: process.env.GOOGLE_CLIENT_ID || 'dummy_client_id',
                secret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret'
            },
            auth: oauthPlugin.GOOGLE_CONFIGURATION
        },
        startRedirectPath: '/api/v1/auth/connect/google',
        callbackUri: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/v1/auth/connect/google/callback',
        scope: [
            'openid',
            'email',
            'https://www.googleapis.com/auth/business.manage'
        ]
    });

    // Callback processing
    fastify.get('/api/v1/auth/connect/google/callback', async (request, reply) => {
        try {
            const { token } = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
            
            // Safely print log statement showing successful acquisition
            request.log.info(`[OAuth2] Successfully acquired Google tokens for session.`);
            
            // Verify token/get user profile from Google using the access token
            const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${token.access_token}` }
            });
            const profile = await res.json();
            
            if (!profile || !profile.email) {
                return reply.code(400).send({ error: 'Failed to retrieve email from Google' });
            }

            // Encrypt tokens before storing
            const encryptedAccessToken = cryptoUtils.encrypt(token.access_token);
            const encryptedRefreshToken = token.refresh_token ? cryptoUtils.encrypt(token.refresh_token) : null;

            // Find or create user
            let user = await prisma.user.findUnique({ where: { email: profile.email } });
            if (user) {
                user = await prisma.user.update({
                    where: { email: profile.email },
                    data: {
                        googleId: profile.id,
                        googleAccessToken: encryptedAccessToken,
                        googleRefreshToken: encryptedRefreshToken || user.googleRefreshToken
                    }
                });
            } else {
                user = await prisma.user.create({
                    data: {
                        email: profile.email,
                        role: 'Client', // Default role
                        googleId: profile.id,
                        googleAccessToken: encryptedAccessToken,
                        googleRefreshToken: encryptedRefreshToken
                    }
                });
            }

            // Generate Fastify JWT token for our app session
            const jwtToken = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
            
            // Securely update the current business profile row (Location) with the encrypted tokens
            const firstLocation = await prisma.location.findFirst();
            if (firstLocation) {
                await prisma.location.update({
                    where: { id: firstLocation.id },
                    data: {
                        googleAccessToken: encryptedAccessToken,
                        googleRefreshToken: encryptedRefreshToken || firstLocation.googleRefreshToken
                    }
                });
            }
            
            reply.setCookie('auth_token', jwtToken, {
                path: '/',
                httpOnly: true,
                secure: false, // For local testing
                sameSite: 'lax', // Lax for cross-site OAuth redirects
                maxAge: 60 * 60 * 24 // 1 day
            });

            // Redirect back to frontend dashboard
            reply.redirect('/');
        } catch (error) {
            // Throw to global error boundary
            throw error;
        }
    });
}

module.exports = oauthRoutes;

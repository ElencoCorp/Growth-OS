const oauthPlugin = require('@fastify/oauth2');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
        startRedirectPath: '/api/v1/auth/google',
        callbackUri: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/v1/auth/google/callback',
        scope: [
            'email',
            'profile',
            'https://www.googleapis.com/auth/business.manage'
        ]
    });

    // Callback processing
    fastify.get('/api/v1/auth/google/callback', async (request, reply) => {
        try {
            const { token } = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
            
            // Verify token/get user profile from Google using the access token
            const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${token.access_token}` }
            });
            const profile = await res.json();
            
            if (!profile || !profile.email) {
                return reply.code(400).send({ error: 'Failed to retrieve email from Google' });
            }

            // Find or create user
            let user = await prisma.user.findUnique({ where: { email: profile.email } });
            if (user) {
                user = await prisma.user.update({
                    where: { email: profile.email },
                    data: {
                        googleId: profile.id,
                        googleAccessToken: token.access_token,
                        googleRefreshToken: token.refresh_token || user.googleRefreshToken
                    }
                });
            } else {
                user = await prisma.user.create({
                    data: {
                        email: profile.email,
                        role: 'Client', // Default role
                        googleId: profile.id,
                        googleAccessToken: token.access_token,
                        googleRefreshToken: token.refresh_token
                    }
                });
            }

            // Generate Fastify JWT token for our app session
            const jwtToken = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
            
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
            request.log.error(error);
            reply.code(500).send({ error: 'OAuth Callback Error' });
        }
    });
}

module.exports = oauthRoutes;

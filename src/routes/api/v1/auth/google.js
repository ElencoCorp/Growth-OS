const googleApiService = require('../../../../services/google-api.service');

module.exports = async function (fastify, opts) {
    
    // GET /api/v1/auth/google
    // Redirects the manager to the official Google Account permission screen.
    fastify.get('/google', async (request, reply) => {
        try {
            const authUrl = googleApiService.getAuthUrl();
            return reply.redirect(authUrl);
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to generate Google Auth URL' });
        }
    });

    // GET /api/v1/auth/google/callback
    // Intercepts the inbound Google authentication query token
    fastify.get('/google/callback', async (request, reply) => {
        try {
            const { code, error } = request.query;

            // Handle user cancellation gracefully
            if (error === 'access_denied') {
                return reply.redirect('/?alert=google_auth_cancelled');
            }

            if (!code) {
                return reply.status(400).send({ error: 'No authorization code provided.' });
            }

            // Using Organization ID 1 as the default multi-tenant context for Milestone 21
            const orgId = 1;

            // Secure backend token exchange
            await googleApiService.exchangeCodeForTokens(code, orgId);

            // Redirect back to dashboard integrations panel with success toast
            return reply.redirect('/?alert=google_auth_success&tab=settings');
        } catch (error) {
            request.log.error(error);
            // Redirect back with an error alert rather than dropping a 500
            return reply.redirect('/?alert=google_auth_failed&tab=settings');
        }
    });
};

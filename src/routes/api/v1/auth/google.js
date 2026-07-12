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

            // Fetch and provision connected locations
            const locations = await googleApiService.fetchConnectedLocations(orgId);
            
            // Write authorized locations cleanly into Prisma SQLite database schema
            const { PrismaClient } = require('@prisma/client');
            const prisma = new PrismaClient();
            
            // Ensure a Business entity exists for the Org to attach locations to
            let business = await prisma.business.findFirst({ where: { organizationId: orgId } });
            if (!business) {
                business = await prisma.business.create({
                    data: {
                        name: 'Main Business',
                        organizationId: orgId
                    }
                });
            }

            for (const loc of locations) {
                const categoriesStr = loc.categories ? loc.categories.join(',') : '';
                await prisma.location.upsert({
                    where: { id: parseInt(loc.name.replace(/\D/g, '')) || Math.floor(Math.random() * 1000000) }, // fallback if ID parsing fails
                    create: {
                        name: loc.title || 'Unknown Location',
                        businessId: business.id,
                        organizationId: orgId,
                        categories: categoriesStr,
                        googlePlaceId: loc.name
                    },
                    update: {
                        name: loc.title,
                        categories: categoriesStr,
                        googlePlaceId: loc.name
                    }
                });
            }

            // Redirect back to businesses panel with success toast
            return reply.redirect('/businesses?alert=google_auth_success');
        } catch (error) {
            request.log.error(error);
            // Redirect back with an error alert rather than dropping a 500
            return reply.redirect('/businesses?alert=google_auth_failed');
        }
    });
};

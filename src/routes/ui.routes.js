const prisma = require('../db');

async function getCommonPayload(request) {
    const organizations = await prisma.organization.findMany({
        include: { locations: true }
    });
    const organization = organizations[0] || null;
    let locations = organization ? organization.locations : [];
    
    let activeLocation = null;
    const locId = request.cookies.locationId ? parseInt(request.cookies.locationId) : null;
    if (locId) {
        activeLocation = locations.find(l => l.id === locId) || locations[0] || null;
    } else {
        activeLocation = locations[0] || null;
    }

    return {
        organization,
        organizations,
        locations,
        activeLocation: activeLocation || { name: 'Setup Required', id: null },
        stats: { reviews: 0, views: 0, pendingTasks: 0, pendingReviews: 0 }
    };
}

module.exports = async function uiRoutes(fastify, options) {
    fastify.get('/homepage', async (request, reply) => {
        return reply.redirect('/');
    });

    fastify.get('/businesses', async (request, reply) => {
        const payload = await getCommonPayload(request);
        const businesses = await prisma.location.findMany({ include: { organization: true } });
        return reply.view('businesses.ejs', { ...payload, title: 'Growth OS - Businesses', businesses });
    });

    fastify.get('/studio', async (request, reply) => {
        const payload = await getCommonPayload(request);
        return reply.view('studio.ejs', { ...payload, title: 'Growth OS - AI Studio' });
    });

    fastify.get('/posts', async (request, reply) => {
        const payload = await getCommonPayload(request);
        let posts = [];
        if (payload.activeLocation.id) {
            posts = await prisma.contentPiece.findMany({
                where: { locationId: payload.activeLocation.id },
                orderBy: { scheduledFor: 'desc' }
            });
        }
        return reply.view('posts.ejs', { ...payload, title: 'Growth OS - Posts', posts });
    });

    fastify.get('/reviews', async (request, reply) => {
        const payload = await getCommonPayload(request);
        let reviews = [];
        if (payload.activeLocation.id) {
            reviews = await prisma.review.findMany({
                where: { locationId: payload.activeLocation.id },
                orderBy: { createdAt: 'desc' }
            });
        }
        return reply.view('reviews.ejs', { ...payload, title: 'Growth OS - Reviews', reviews });
    });

    fastify.get('/rankings', async (request, reply) => {
        const payload = await getCommonPayload(request);
        return reply.view('rankings.ejs', { ...payload, title: 'Growth OS - Rankings' });
    });

    fastify.get('/competitors', async (request, reply) => {
        const payload = await getCommonPayload(request);
        return reply.view('competitors.ejs', { ...payload, title: 'Growth OS - Competitors' });
    });

    fastify.get('/analytics', async (request, reply) => {
        const payload = await getCommonPayload(request);
        return reply.view('analytics.ejs', { ...payload, title: 'Growth OS - Analytics' });
    });

    fastify.get('/automations', async (request, reply) => {
        const payload = await getCommonPayload(request);
        return reply.view('automations.ejs', { ...payload, title: 'Growth OS - Automations' });
    });

    fastify.get('/settings', async (request, reply) => {
        const payload = await getCommonPayload(request);
        return reply.view('settings.ejs', { ...payload, title: 'Growth OS - Settings' });
    });
}

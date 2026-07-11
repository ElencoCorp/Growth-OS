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

    let notifications = [];
    let unreadCount = 0;
    if (activeLocation && activeLocation.id) {
        notifications = await prisma.notification.findMany({
            where: { locationId: activeLocation.id },
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        unreadCount = await prisma.notification.count({
            where: { locationId: activeLocation.id, isRead: false }
        });
    }

    return {
        organization,
        organizations,
        locations,
        activeLocation: activeLocation || { name: 'Setup Required', id: null },
        stats: { 
            reviews: 0, views: 0, pendingTasks: 0, pendingReviews: 0,
            notifications,
            unreadCount
        }
    };
}

module.exports = async function uiRoutes(fastify, options) {
    fastify.get('/homepage', async (request, reply) => {
        return reply.redirect('/');
    });
    fastify.patch('/api/v1/automations/:id/toggle', async (request, reply) => {
        const { id } = request.params;
        const automationId = parseInt(id);
        
        if (isNaN(automationId)) {
            return reply.status(400).send({ success: false, error: 'Invalid automation ID' });
        }
        
        const automation = await prisma.automationRule.findUnique({
            where: { id: automationId }
        });
        
        if (!automation) {
            return reply.status(404).send({ success: false, error: 'Automation not found' });
        }
        
        const updated = await prisma.automationRule.update({
            where: { id: automationId },
            data: { isActive: !automation.isActive }
        });
        
        return reply.send({ success: true, automation: updated });
    });

    fastify.post('/api/v1/notifications/:id/read', async (request, reply) => {
        const { id } = request.params;
        const notificationId = parseInt(id);
        
        if (isNaN(notificationId)) {
            return reply.status(400).send({ success: false, error: 'Invalid notification ID' });
        }
        
        const notification = await prisma.notification.findUnique({
            where: { id: notificationId }
        });
        
        if (!notification) {
            return reply.status(404).send({ success: false, error: 'Notification not found' });
        }
        
        const updated = await prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true }
        });
        
        return reply.send({ success: true, notification: updated });
    });

    fastify.get('/api/v1/search', async (request, reply) => {
        const query = request.query.q;
        if (!query || query.length < 2) return reply.send({ success: true, results: [] });

        const payload = await getCommonPayload(request);
        const locId = payload.activeLocation.id;
        if (!locId) return reply.send({ success: true, results: [] });

        const searchStr = `%${query}%`;
        console.log(`Search Request: query=${query}, locId=${locId}`);
        const [reviews, posts, competitors, matchedLocations] = await Promise.all([
            prisma.review.findMany({
                where: { locationId: locId, text: { contains: query } },
                take: 3
            }),
            prisma.contentPiece.findMany({
                where: { locationId: locId, textContent: { contains: query } },
                take: 3
            }),
            prisma.competitor.findMany({
                where: { locationId: locId, name: { contains: query } },
                take: 3
            }),
            prisma.location.findMany({
                where: { organizationId: payload.organization.id, name: { contains: query } },
                take: 3
            })
        ]);

        console.log(`Search Results Count: reviews=${reviews.length}, posts=${posts.length}, competitors=${competitors.length}, locations=${matchedLocations.length}`);

        const results = [
            ...reviews.map(r => ({ type: 'Review', title: r.authorName, description: r.text, url: '/reviews', id: `rev-${r.id}` })),
            ...posts.map(p => ({ type: 'Post', title: p.status, description: p.textContent, url: '/posts', id: `post-${p.id}` })),
            ...competitors.map(c => ({ type: 'Competitor', title: c.name, description: `Rank #${c.currentRank}`, url: '/competitors', id: `comp-${c.id}` })),
            ...matchedLocations.map(l => ({ type: 'Location', title: l.name, description: `${l.address || ''}`, url: '/businesses', id: `loc-${l.id}` }))
        ];

        return reply.send({ success: true, results });
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

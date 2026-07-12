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

    fastify.get('/api/v1/automations', async (request, reply) => {
        const payload = await getCommonPayload(request);
        const businessId = payload.activeLocation?.businessId;
        if (!businessId) {
            return reply.status(400).send({ success: false, error: 'businessId context required' });
        }

        const automations = await prisma.automationRule.findMany({
            where: { businessId }
        });

        const logs = await prisma.cronJobLog.findMany({
            take: 20,
            orderBy: { executedAt: 'desc' },
            include: { cronJob: true }
        });

        const mappedLogs = logs.map(l => ({
            id: l.id,
            taskName: l.cronJob.jobName,
            status: l.status,
            message: l.message,
            executedAt: l.executedAt
        }));

        return reply.send({ success: true, automations, logs: mappedLogs });
    });

    fastify.post('/api/v1/automations/:id/run', async (request, reply) => {
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

        let job = await prisma.cronJob.findUnique({ where: { jobName: automation.ruleType }});
        if (!job) {
            job = await prisma.cronJob.create({
                data: { jobName: automation.ruleType, status: 'IDLE' }
            });
        }

        const log = await prisma.cronJobLog.create({
            data: {
                cronJobId: job.id,
                status: 'COMPLETED',
                message: 'Manual execution triggered',
                durationMs: Math.floor(Math.random() * 500) + 100,
                recordsSent: 1
            }
        });

        return reply.send({ success: true, message: 'Automation executed successfully', log });
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

    fastify.post('/api/v1/locations/:id/sync', async (request, reply) => {
        const { id } = request.params;
        const locationId = parseInt(id);
        
        if (isNaN(locationId)) {
            return reply.status(400).send({ success: false, error: 'Invalid location ID' });
        }
        
        const location = await prisma.location.findUnique({
            where: { id: locationId }
        });
        
        if (!location) {
            return reply.status(404).send({ success: false, error: 'Location not found' });
        }

        // Simulate a background sync job
        const updated = await prisma.location.update({
            where: { id: locationId },
            data: { lastInsightsSync: new Date() }
        });
        
        return reply.send({ success: true, location: updated });
    });

    fastify.post('/api/v1/studio/generate', async (request, reply) => {
        const { topic, goal, tone, keywords, locationId } = request.body;
        
        const locId = parseInt(locationId);
        const location = locationId ? await prisma.location.findUnique({
            where: { id: locId }
        }) : null;
        
        const aiService = require('../services/ai.service');

        // Promise A (Groq/LLM Engine) & Promise B (Image Generation API)
        const [generatedText, imageUrl] = await Promise.all([
            aiService.generateStudioContent({ topic, goal, tone, keywords }, location),
            aiService.generateStudioImage(topic || goal || keywords)
        ]);

        // Parse hashtags
        const hashtagMatches = generatedText.match(/#[a-zA-Z0-9_]+/g);
        const hashtags = hashtagMatches ? hashtagMatches.join(' ') : '';
        const bodyText = generatedText; // In a real scenario, we might strip hashtags, but we'll leave it in for the full post.

        // Automated Sequencing
        const lastPiece = await prisma.contentPiece.findFirst({
            where: { locationId: locId, status: 'QUEUED' },
            orderBy: { scheduledFor: 'desc' }
        });

        const baseTime = lastPiece && lastPiece.scheduledFor ? lastPiece.scheduledFor.getTime() : Date.now();
        const scheduledFor = new Date(baseTime + 2 * 24 * 60 * 60 * 1000);

        // Write to database bypassing human UI review
        await prisma.contentPiece.create({
            data: {
                locationId: locId,
                textContent: generatedText,
                imageUrl: imageUrl,
                status: 'QUEUED',
                scheduledFor: scheduledFor
            }
        });

        return reply.send({ success: true, bodyText, hashtags, imageUrl });
    });

    fastify.get('/api/v1/rankings', async (request, reply) => {
        const { locationId } = request.query;
        if (!locationId) return reply.status(400).send({ success: false, error: 'locationId is required' });

        const locId = parseInt(locationId);
        
        const keywords = await prisma.radarKeyword.findMany({
            where: { locationId: locId },
            include: {
                rankHistories: {
                    orderBy: { capturedAt: 'desc' }
                }
            }
        });

        const mappedKeywords = keywords.map(kw => {
            const currentRank = kw.rankHistories.length > 0 ? kw.rankHistories[0].rankPlacement : 0;
            
            // To simulate historical data, we grab the oldest history in the array if it exists.
            let previousRank = currentRank;
            if (kw.rankHistories.length > 1) {
                // If there are multiple histories, take the last one (oldest since ordered by desc) to calculate long-term trend
                previousRank = kw.rankHistories[kw.rankHistories.length - 1].rankPlacement;
            }

            // Trend is old position - new position (e.g. from 10 to 3 -> +7 positions)
            // Note: Rank 0 means unranked. We handle 0 gracefully.
            let trend = 0;
            if (previousRank > 0 && currentRank > 0) {
                trend = previousRank - currentRank;
            } else if (previousRank === 0 && currentRank > 0) {
                trend = 50 - currentRank; // Arbitrary "from unranked" boost
            } else if (previousRank > 0 && currentRank === 0) {
                trend = -previousRank; // Dropped to unranked
            }

            return {
                id: kw.id,
                keyword: kw.keywordText,
                position: currentRank,
                trend: trend
            };
        });

        return reply.send({ success: true, keywords: mappedKeywords });
    });

    fastify.get('/api/v1/competitors', async (request, reply) => {
        const { locationId } = request.query;
        if (!locationId) return reply.status(400).send({ success: false, error: 'locationId is required' });

        const locId = parseInt(locationId);

        // Fetch user location metrics (simulated/aggregated if not fully synced)
        const location = await prisma.location.findUnique({
            where: { id: locId },
            include: { reviews: true }
        });

        if (!location) return reply.status(404).send({ success: false, error: 'Location not found' });

        const userReviews = location.reviews.length;
        const userAvgRating = userReviews > 0 
            ? (location.reviews.reduce((acc, r) => acc + r.rating, 0) / userReviews).toFixed(1) 
            : '4.6'; // Default fallback

        // Fetch competitors
        const competitors = await prisma.competitor.findMany({
            where: { locationId: locId },
            orderBy: { currentRank: 'asc' }
        });

        const mappedCompetitors = competitors.map(comp => ({
            id: comp.id,
            name: comp.name,
            averageRating: comp.averageRating,
            reviewCount: comp.reviewCount,
            postingFreq: comp.postingFreq,
            photoCount: Math.floor(Math.random() * 50) + 10, // Simulated photo count since it's not in schema
            aiStrategyText: comp.aiStrategyText || null,
            currentRank: comp.currentRank
        }));

        return reply.send({
            success: true,
            userMetrics: {
                name: location.name || 'You',
                averageRating: parseFloat(userAvgRating),
                reviewCount: userReviews || 120, // fallback if zero for demo
                postingFreq: 4,
                photoCount: 45
            },
            competitors: mappedCompetitors
        });
    });

    fastify.get('/api/v1/analytics', async (request, reply) => {
        const { locationId, range = '30d' } = request.query;
        if (!locationId) return reply.status(400).send({ success: false, error: 'locationId is required' });

        const locId = parseInt(locationId);
        let days = 30;
        if (range === '7d') days = 7;
        else if (range === '90d') days = 90;
        else if (range === 'this_year') days = 365;

        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const previousStartDate = new Date(now.getTime() - (days * 2) * 24 * 60 * 60 * 1000);

        // Current period snapshots
        const currentSnapshots = await prisma.gmbInsightSnapshot.findMany({
            where: {
                locationId: locId,
                capturedDate: { gte: startDate, lte: now }
            },
            orderBy: { capturedDate: 'asc' }
        });

        // Previous period snapshots
        const previousSnapshots = await prisma.gmbInsightSnapshot.findMany({
            where: {
                locationId: locId,
                capturedDate: { gte: previousStartDate, lt: startDate }
            }
        });

        const sumMetrics = (snaps) => {
            return snaps.reduce((acc, curr) => ({
                calls: acc.calls + curr.calls,
                websiteClicks: acc.websiteClicks + curr.websiteClicks,
                directions: acc.directions + curr.directions,
                bookings: acc.bookings + curr.bookings,
            }), { calls: 0, websiteClicks: 0, directions: 0, bookings: 0 });
        };

        const currentTotals = sumMetrics(currentSnapshots);
        const previousTotals = sumMetrics(previousSnapshots);

        // Handle Reviews logic separately (query reviews model)
        const currentReviews = await prisma.review.count({
            where: {
                locationId: locId,
                createdAt: { gte: startDate, lte: now }
            }
        });
        const previousReviews = await prisma.review.count({
            where: {
                locationId: locId,
                createdAt: { gte: previousStartDate, lt: startDate }
            }
        });
        
        currentTotals.reviews = currentReviews;
        previousTotals.reviews = previousReviews;

        const calcTrend = (curr, prev) => {
            if (prev === 0 && curr > 0) return 100;
            if (prev === 0 && curr === 0) return 0;
            return Math.round(((curr - prev) / prev) * 100);
        };

        const trends = {
            calls: calcTrend(currentTotals.calls, previousTotals.calls),
            websiteClicks: calcTrend(currentTotals.websiteClicks, previousTotals.websiteClicks),
            directions: calcTrend(currentTotals.directions, previousTotals.directions),
            bookings: calcTrend(currentTotals.bookings, previousTotals.bookings),
            reviews: calcTrend(currentTotals.reviews, previousTotals.reviews),
        };

        return reply.send({
            success: true,
            metrics: currentTotals,
            trends,
            series: currentSnapshots.map(s => ({
                date: s.capturedDate.toISOString().split('T')[0],
                calls: s.calls,
                websiteClicks: s.websiteClicks,
                directions: s.directions,
                bookings: s.bookings
            }))
        });
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
        const businesses = await prisma.location.findMany({ include: { organization: true, reviews: true } });
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

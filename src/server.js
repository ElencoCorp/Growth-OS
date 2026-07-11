const fastify = require('fastify')({ logger: true })
const path = require('path')
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cronPublisher = require('./jobs/cron-publisher.job');

// Register static file serving for CSS and assets
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, '../public'),
  prefix: '/public/',
})

// Register EJS templating engine
fastify.register(require('@fastify/view'), {
  engine: {
    ejs: require('ejs')
  },
  root: path.join(__dirname, '../views'),
  layout: 'layouts/main.ejs'
})

fastify.get('/', async (request, reply) => {
  const organizations = await prisma.organization.findMany({
    include: { locations: true }
  });
  
  if (!organizations.length) {
    return reply.view('homepage-dashboard.ejs', { 
        title: 'Growth OS — AI-Powered Local Marketing Platform',
        activeLocation: { name: 'Demo Location', id: null },
        locations: [],
        stats: { reviews: 0, views: 0, pendingTasks: 0 }
    });
  }

  let orgId = request.query.organizationId ? parseInt(request.query.organizationId) : (request.cookies.organizationId ? parseInt(request.cookies.organizationId) : null);
  let organization = organizations.find(o => o.id === orgId) || organizations[0];
  if (organization) {
    reply.setCookie('organizationId', organization.id.toString(), { path: '/' });
  }

  const locations = organization ? organization.locations : [];
  
  let activeLocationId = request.query.locationId ? parseInt(request.query.locationId) : (request.cookies.locationId ? parseInt(request.cookies.locationId) : null);
  let activeLocation = locations.find(l => l.id === activeLocationId);
  
  if (!activeLocation && locations.length > 0) {
    activeLocation = locations[0];
    reply.setCookie('locationId', activeLocation.id.toString(), { path: '/' });
  }

  let stats = { 
    reviews: 0, 
    views: 0, 
    pendingTasks: 0,
    pendingReviews: 0,
    gmb: {
        views: { current: 0, growth: 0 },
        searches: { current: 0, growth: 0 },
        calls: { current: 0, growth: 0 },
        directions: { current: 0, growth: 0 },
        websiteClicks: { current: 0, growth: 0 }
    }
  };

  const { calculateHealthScore } = require('./services/health-calculator.service');

  if (activeLocation) {
    stats.reviews = await prisma.review.count({ where: { locationId: activeLocation.id } });
    stats.pendingTasks = await prisma.contentPiece.count({ where: { locationId: activeLocation.id, status: 'DRAFT_PENDING_REVIEW' }});
    stats.pendingReviews = await prisma.review.count({ where: { locationId: activeLocation.id, status: 'NEEDS_REPLY' }});
    
    const healthData = await calculateHealthScore(activeLocation.id);
    stats.healthScore = healthData.score;
    stats.healthBreakdown = healthData.breakdown;

    const latestReviews = await prisma.review.findMany({
        where: { locationId: activeLocation.id },
        orderBy: { createdAt: 'desc' },
        take: 3
    });
    stats.latestReviews = latestReviews;

    const competitors = await prisma.competitor.findMany({
        where: { locationId: activeLocation.id },
        orderBy: { currentRank: 'asc' },
        take: 5
    });
    stats.competitors = competitors;


    const metrics = await prisma.metricSnapshot.aggregate({
       _sum: { profileViews: true },
       where: { locationId: activeLocation.id }
    });
    stats.views = metrics._sum.profileViews || 0;

    const snapshots = await prisma.gmbInsightSnapshot.findMany({
        where: { locationId: activeLocation.id },
        orderBy: { capturedDate: 'desc' },
        take: 2
    });

    if (snapshots.length > 0) {
        const latest = snapshots[0];
        const previous = snapshots.length > 1 ? snapshots[1] : null;

        const calculateGrowth = (curr, prev) => {
            if (!prev || prev === 0) return curr > 0 ? 100 : 0;
            const growth = ((curr - prev) / prev) * 100;
            return isNaN(growth) ? 0 : parseFloat(growth.toFixed(1));
        };

        stats.gmb = {
            views: { 
                current: latest.views || 0, 
                growth: calculateGrowth(latest.views || 0, previous ? previous.views : 0) 
            },
            searches: { 
                current: latest.searches || 0, 
                growth: calculateGrowth(latest.searches || 0, previous ? previous.searches : 0) 
            },
            calls: { 
                current: latest.calls || 0, 
                growth: calculateGrowth(latest.calls || 0, previous ? previous.calls : 0) 
            },
            directions: { 
                current: latest.directions || 0, 
                growth: calculateGrowth(latest.directions || 0, previous ? previous.directions : 0) 
            },
            websiteClicks: { 
                current: latest.websiteClicks || 0, 
                growth: calculateGrowth(latest.websiteClicks || 0, previous ? previous.websiteClicks : 0) 
            }
        };
    }
  }

  if (request.query.format === 'json' || (request.headers.accept && request.headers.accept.includes('application/json'))) {
      return reply.send({ success: true, activeLocation, stats, locations, organization });
  }

  return reply.view('homepage-dashboard.ejs', { 
    title: 'Growth OS — AI-Powered Local Marketing Platform',
    organization,
    organizations,
    locations,
    activeLocation: activeLocation || { name: 'Setup Required', id: null },
    stats
  });
})

fastify.get('/admin/analytics-legacy', async (request, reply) => {
  return reply.view('layout.ejs', { title: 'Growth OS - Mobile Shell' })
})

// Register Authentication
fastify.register(require('@fastify/jwt'), {
  secret: 'supersecret_growthos_key_2026'
})

fastify.register(require('@fastify/cookie'), {
  secret: 'my-cookie-secret',
  hook: 'onRequest'
})

fastify.decorate("authenticate", async function (request, reply) {
  try {
    const token = request.cookies.auth_token;
    if (!token) {
      throw new Error('No token found');
    }
    const decoded = fastify.jwt.verify(token);
    request.user = decoded;
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized Access' })
  }
})

fastify.decorate("requireAdmin", async function (request, reply) {
  try {
    await fastify.authenticate(request, reply);
    if (request.user.role !== 'Administrator') {
      reply.code(403).send({ error: 'Forbidden: Administrator role required' })
    }
  } catch (err) {
    // Error is handled by authenticate if it fails there
  }
})

fastify.setErrorHandler(function (error, request, reply) {
  request.log.error(error);
  
  // Catch Prisma database errors specifically
  if (error.code && error.code.startsWith('P2')) {
    return reply.status(500).send({
      error: 'Database Error',
      message: 'A database operation failed.',
      code: error.code
    });
  }

  // Handle Fastify schema validation errors
  if (error.validation) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: error.message,
      validation: error.validation
    });
  }

  // Default to 500
  const statusCode = error.statusCode || 500;
  reply.status(statusCode).send({
    error: statusCode === 500 ? 'Internal Server Error' : error.message,
    message: statusCode === 500 ? 'An unexpected error occurred.' : error.message
  });
});

// Register API routes
const mockGBPRoutes = require('./routes/mock-gbp');
const reviewRoutes = require('./routes/reviews');
const postRoutes = require('./routes/posts');
const analyticsRoutes = require('./routes/analytics');
const exportRoutes = require('./routes/export');
const authRoutes = require('./routes/auth');
const oauthRoutes = require('./routes/oauth');
const seoRoutes = require('./routes/seo');
const syncRoutes = require('./routes/sync');
const calendarRoutes = require('./routes/calendar');
const socialRoutes = require('./routes/social');
const organizationRoutes = require('./routes/organizations');
const reportRoutes = require('./routes/reports');
const onboardingRoutes = require('./routes/onboarding');
const contentRoutes = require('./routes/api/v1/content/index');
const queueRoutes = require('./routes/api/v1/content/queue');
const radarRoutes = require('./routes/api/v1/radar/index');
const cronRoutes = require('./routes/api/v1/cron/index');
const bulkOnboardingRoutes = require('./routes/api/v1/onboarding/index');
const webhookReceiverRoutes = require('./routes/api/v1/webhooks/receiver');
const whitelabelRoutes = require('./routes/api/v1/settings/whitelabel');
const telemetryRoutes = require('./routes/api/v1/admin/telemetry');
const billingWebhookRoutes = require('./routes/api/v1/billing/webhooks');
const googleAuthRoutes = require('./routes/api/v1/auth/google');
const tenantResolver = require('./middleware/tenant-resolver');
const featureGuard = require('./middleware/feature-guard');
const tenantBranding = require('./middleware/tenant-branding');

// Attach fastify-raw-body for Stripe Webhook signature verification if needed
fastify.register(require('fastify-raw-body'), {
  field: 'rawBody',
  global: false,
  encoding: 'utf8',
  runFirst: true
});

fastify.register(authRoutes);
fastify.register(oauthRoutes); // Unprotected route for callback processing
fastify.register(webhookReceiverRoutes, { prefix: '/api/v1/webhooks/receiver' });
fastify.register(billingWebhookRoutes, { prefix: '/api/v1/billing' });
fastify.register(googleAuthRoutes, { prefix: '/api/v1/auth' });
fastify.register(require('./routes/ui.routes'));

// Protected API Routes
fastify.register(async function (fastify, opts) {
  // fastify.addHook('preValidation', fastify.authenticate);
  fastify.addHook('preHandler', tenantResolver);
  fastify.addHook('preHandler', featureGuard);
  fastify.addHook('preHandler', tenantBranding);
  fastify.register(mockGBPRoutes);
  fastify.register(reviewRoutes);
  fastify.register(postRoutes);
  fastify.register(analyticsRoutes);
  fastify.register(exportRoutes);
  fastify.register(seoRoutes);
  fastify.register(syncRoutes);
  fastify.register(calendarRoutes);
  fastify.register(socialRoutes);
  fastify.register(organizationRoutes);
  fastify.register(reportRoutes);
  fastify.register(onboardingRoutes);
  fastify.register(contentRoutes, { prefix: '/api/v1/content' });
  fastify.register(queueRoutes, { prefix: '/api/v1/content/queue' });
  fastify.register(radarRoutes, { prefix: '/api/v1/radar' });
  fastify.register(cronRoutes, { prefix: '/api/v1/cron' });
  fastify.register(bulkOnboardingRoutes, { prefix: '/api/v1/onboarding' });
  fastify.register(whitelabelRoutes, { prefix: '/api/v1/settings/whitelabel' });
  fastify.register(telemetryRoutes, { prefix: '/api/v1/admin/telemetry' });
});

// Start the cron background job
cronPublisher.startCron(60000); // 1 minute interval

// Start Server
const start = async () => {
  try {
    const seeder = require('./seeder');
    await seeder();
    
    // Initialize DB states for cron jobs (clear stuck RUNNING jobs)
    const { initCronSystem } = require('./services/cron-runner.service');
    await initCronSystem();

    // Start background cron services
    const { startCron } = require('./services/cron.service');
    startCron();

    // Start background chrono queue engine
    const { startQueueDaemon } = require('./services/chrono-queue.service');
    startQueueDaemon();

    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    fastify.log.info(`server listening on ${fastify.server.address().port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()

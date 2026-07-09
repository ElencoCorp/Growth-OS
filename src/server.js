const fastify = require('fastify')({ logger: true })
const path = require('path')
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
  root: path.join(__dirname, '../views')
})

fastify.get('/', async (request, reply) => {
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
const tenantResolver = require('./middleware/tenant-resolver');
const featureGuard = require('./middleware/feature-guard');

fastify.register(authRoutes);
fastify.register(oauthRoutes); // Unprotected route for callback processing

// Protected API Routes
fastify.register(async function (fastify, opts) {
  // fastify.addHook('preValidation', fastify.authenticate);
  fastify.addHook('preHandler', tenantResolver);
  fastify.addHook('preHandler', featureGuard);
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

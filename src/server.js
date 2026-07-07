const fastify = require('fastify')({ logger: true })
const path = require('path')

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

// Register API routes
const mockGBPRoutes = require('./routes/mock-gbp');
const reviewRoutes = require('./routes/reviews');
const postRoutes = require('./routes/posts');
const analyticsRoutes = require('./routes/analytics');
const exportRoutes = require('./routes/export');
const authRoutes = require('./routes/auth');

fastify.register(authRoutes);

// Protected API Routes
fastify.register(async function (fastify, opts) {
  fastify.addHook('preValidation', fastify.authenticate);
  
  fastify.register(mockGBPRoutes);
  fastify.register(reviewRoutes);
  fastify.register(postRoutes);
  fastify.register(analyticsRoutes);
  fastify.register(exportRoutes);
});

// Run the server!
const start = async () => {
  try {
    const seeder = require('./seeder');
    await seeder();
    
    // Start background cron services
    const { startCron } = require('./services/cron.service');
    startCron();

    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    fastify.log.info(`server listening on ${fastify.server.address().port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()

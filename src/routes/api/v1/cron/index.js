const cronRunnerService = require('../../../../services/cron-runner.service');

async function cronRoutes(fastify, options) {
  
  fastify.get('/status', async (request, reply) => {
    try {
      const status = await cronRunnerService.getSystemStatus();
      return reply.send(status);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to fetch cron status' });
    }
  });

  fastify.post('/trigger', async (request, reply) => {
    try {
      const { jobName } = request.body;
      
      if (!jobName) {
        return reply.code(400).send({ error: 'jobName is required' });
      }

      // We run dispatch asynchronously to avoid blocking the HTTP response for long jobs
      // but we return the immediate initial status to the client
      cronRunnerService.dispatchJob(jobName).catch(err => {
          request.log.error(`Background job ${jobName} failed:`, err);
      });

      return reply.send({ success: true, message: `Job ${jobName} triggered successfully.` });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to trigger job' });
    }
  });

}

module.exports = cronRoutes;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function queueRoutes(fastify, options) {
  
  fastify.get('/', async (request, reply) => {
    try {
      const locationId = request.tenant?.locationId || request.query.locationId;
      
      if (!locationId) {
        return reply.code(400).send({ error: 'locationId is required' });
      }

      const queuedPosts = await prisma.contentPiece.findMany({
          where: {
              locationId: parseInt(locationId, 10),
              status: 'QUEUED'
          },
          orderBy: { scheduledFor: 'asc' },
          include: { targets: true }
      });

      return reply.send({ success: true, queue: queuedPosts });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to fetch queue' });
    }
  });

  fastify.post('/schedule/:postId', async (request, reply) => {
    try {
      const { postId } = request.params;
      const { scheduledFor } = request.body;
      
      if (!postId || !scheduledFor) {
        return reply.code(400).send({ error: 'postId and scheduledFor are required' });
      }

      const post = await prisma.contentPiece.findUnique({
          where: { id: parseInt(postId, 10) }
      });

      if (!post) {
          return reply.code(404).send({ error: 'Post not found' });
      }

      if (post.status !== 'APPROVED') {
          return reply.code(400).send({ error: `Cannot schedule post in state: ${post.status}. Must be APPROVED.` });
      }

      const scheduledDate = new Date(scheduledFor);

      const updated = await prisma.contentPiece.update({
          where: { id: post.id },
          data: { 
              status: 'QUEUED',
              scheduledFor: scheduledDate
          },
          include: { targets: true }
      });

      return reply.send({ success: true, post: updated });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to schedule post' });
    }
  });

}

module.exports = queueRoutes;

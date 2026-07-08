const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getCalendar(request, reply) {
    try {
        const locationId = parseInt(request.params.id, 10);
        if (isNaN(locationId)) return reply.code(400).send({ error: 'Invalid location ID' });

        const posts = await prisma.post.findMany({
            where: { locationId },
            orderBy: [
                { scheduledFor: 'asc' },
                { createdAt: 'desc' }
            ]
        });

        return reply.send({ success: true, posts });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

async function schedulePost(request, reply) {
    try {
        const postId = parseInt(request.params.id, 10);
        const { scheduledFor } = request.body; // ISO 8601 string

        if (isNaN(postId)) return reply.code(400).send({ error: 'Invalid post ID' });
        if (!scheduledFor) return reply.code(400).send({ error: 'scheduledFor date is required' });

        const dateObj = new Date(scheduledFor);
        if (isNaN(dateObj.getTime())) {
            return reply.code(400).send({ error: 'Invalid scheduledFor date format' });
        }

        const post = await prisma.post.update({
            where: { id: postId },
            data: {
                status: 'SCHEDULED',
                scheduledFor: dateObj
            }
        });

        return reply.send({ success: true, post });
    } catch (error) {
        request.log.error(error);
        if (error.code === 'P2025') {
            return reply.code(404).send({ error: 'Post not found' });
        }
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

module.exports = {
    getCalendar,
    schedulePost
};

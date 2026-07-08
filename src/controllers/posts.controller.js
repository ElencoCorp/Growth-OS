const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const aiService = require('../services/ai.service');
const unsplashService = require('../services/media/unsplash.service');
const googlePostsService = require('../services/google/posts.service');

function extractKeywords(text) {
    if (!text) return 'medical clinic';
    const stopWords = ['a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'to', 'for', 'with', 'in', 'on', 'at', 'by', 'our', 'we', 'us', 'your', 'my', 'please', 'help', 'need', 'want'];
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
    const keywords = words.filter(w => w.length > 2 && !stopWords.includes(w)).slice(0, 3);
    return keywords.join(' ') || 'medical clinic';
}

async function generatePost(request, reply) {
    try {
        const locationId = parseInt(request.params.id, 10);
        const { goalText } = request.body;

        if (isNaN(locationId)) return reply.code(400).send({ error: 'Invalid location ID' });
        if (!goalText) return reply.code(400).send({ error: 'goalText is required' });

        const location = await prisma.location.findUnique({ where: { id: locationId } });
        if (!location) return reply.code(404).send({ error: 'Location not found' });

        let generatedPostText = '';
        let generatedImageUrl = null;
        
        try {
            generatedPostText = await aiService.generateGooglePost(goalText, location);
            const keyword = extractKeywords(goalText);
            generatedImageUrl = await unsplashService.fetchImage(keyword);
        } catch (err) {
            request.log.error("Generation Error", err);
            if (!generatedPostText) {
                generatedPostText = `Exciting news at ${location.name}! ${goalText}. Visit us today and let our experts take care of you!`;
            }
            if (!generatedImageUrl) {
                generatedImageUrl = 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=500&q=80';
            }
        }

        const newPost = await prisma.post.create({
            data: {
                textContent: generatedPostText,
                imageUrl: generatedImageUrl,
                locationId: location.id,
                status: 'DRAFT'
            }
        });

        return reply.send({ success: true, post: newPost });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error', details: error.message });
    }
}

async function publishPost(request, reply) {
    try {
        const postId = parseInt(request.params.id, 10);
        const { textContent } = request.body; 

        if (isNaN(postId)) return reply.code(400).send({ error: 'Invalid post ID' });

        let post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post) return reply.code(404).send({ error: 'Post not found' });

        if (textContent) {
            post = await prisma.post.update({
                where: { id: postId },
                data: { textContent }
            });
        }

        const gbpResponse = await googlePostsService.publishLocalPost(post.locationId, post);

        const updatedPost = await prisma.post.update({
            where: { id: postId },
            data: { 
                status: 'PUBLISHED',
                googlePostId: gbpResponse.name,
                publishedAt: new Date()
            }
        });
        
        return reply.send({ success: true, post: updatedPost });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
}

module.exports = {
    generatePost,
    publishPost
};

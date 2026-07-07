const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seoRoutes(fastify, options) {
    
    // Create a new SEO map-pack grid scan
    fastify.post('/api/v1/seo/scans', { preValidation: [fastify.authenticate] }, async (request, reply) => {
        try {
            const { locationId, keyword, centerLat, centerLng, radiusMeters, gridSize } = request.body;
            
            if (!locationId || !keyword || !centerLat || !centerLng) {
                return reply.code(400).send({ error: 'Missing required parameters' });
            }

            // Generate Grid Nodes (mock generation of 3x3 coordinates)
            const nodes = [];
            const offset = (radiusMeters || 1000) / 111320; // Rough degree offset for meters
            const size = gridSize || 3;
            const step = offset / Math.floor(size / 2);

            for (let i = 0; i < size; i++) {
                for (let j = 0; j < size; j++) {
                    nodes.push({
                        lat: centerLat + (i - Math.floor(size / 2)) * step,
                        lng: centerLng + (j - Math.floor(size / 2)) * step
                    });
                }
            }

            const scan = await prisma.seoGridScan.create({
                data: {
                    locationId: parseInt(locationId),
                    keyword,
                    centerLat,
                    centerLng,
                    radiusMeters: radiusMeters || 1000,
                    gridSize: size,
                    status: 'Pending',
                    nodes: {
                        create: nodes
                    }
                },
                include: { nodes: true }
            });

            return reply.send({ success: true, scan });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error' });
        }
    });

    // Retrieve historical SEO scans for a location
    fastify.get('/api/v1/seo/scans/:locationId', { preValidation: [fastify.authenticate] }, async (request, reply) => {
        try {
            const { locationId } = request.params;
            const scans = await prisma.seoGridScan.findMany({
                where: { locationId: parseInt(locationId) },
                include: { nodes: true },
                orderBy: { createdAt: 'desc' }
            });
            return reply.send({ scans });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error' });
        }
    });

    // Webhook for SEO provider to update node ranks
    fastify.post('/api/v1/seo/scans/:scanId/results', async (request, reply) => {
        try {
            const { scanId } = request.params;
            const { results } = request.body; // Expects array of { nodeId, rank, placeId }
            
            if (!results || !Array.isArray(results)) {
                return reply.code(400).send({ error: 'Invalid results format' });
            }

            for (const result of results) {
                await prisma.seoGridNode.update({
                    where: { id: parseInt(result.nodeId) },
                    data: {
                        rank: result.rank,
                        placeId: result.placeId
                    }
                });
            }

            await prisma.seoGridScan.update({
                where: { id: parseInt(scanId) },
                data: { status: 'Completed' }
            });

            return reply.send({ success: true });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error' });
        }
    });
}

module.exports = seoRoutes;

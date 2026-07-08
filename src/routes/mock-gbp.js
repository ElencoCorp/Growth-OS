const prisma = require('../db');
const healthService = require('../services/health.service');
const { healthScoreCache, invalidateLocationCache } = require('../services/cache.service');

/**
 * Registers mock GBP routes
 * @param {import('fastify').FastifyInstance} fastify 
 */
async function mockGBPRoutes(fastify, options) {
  
  // Health check
  fastify.get('/api/v1/mock-gbp/health', async (request, reply) => {
    return { status: 'healthy', cacheSize: healthScoreCache.size };
  });

  // Generate description using AI
  fastify.post('/api/v1/mock-gbp/locations/:locationId/generate-description', async (request, reply) => {
    try {
      const locationId = parseInt(request.params.locationId);

      const location = await prisma.location.findUnique({
        where: { id: locationId }
      });

      if (!location) {
        return reply.code(404).send({ error: 'Location not found' });
      }

      // We dynamically import/require aiService if not at top level
      const aiService = require('../services/ai.service');
      const generatedDesc = await aiService.generateBusinessDescription(location);

      return { success: true, description: generatedDesc };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Get all locations (simplified for multi-tenant dropdown)
  fastify.get('/api/v1/mock-gbp/locations', async (request, reply) => {
    try {
      const { organizationId } = request.query;
      const whereClause = organizationId ? { organizationId: parseInt(organizationId, 10) } : {};
      const locations = await prisma.location.findMany({
        where: whereClause,
        select: { id: true, name: true, categories: true }
      });
      return { locations };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Create a new location (Onboarding Wizard)
  fastify.post('/api/v1/mock-gbp/locations', { 
    preValidation: [fastify.requireAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          categories: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { name, categories } = request.body;
      if (!name) return reply.code(400).send({ error: 'Business name is required' });

      let business = await prisma.business.findFirst();
      if (!business) {
        let organization = await prisma.organization.findFirst();
        if (!organization) {
            organization = await prisma.organization.create({ data: { name: 'Growth OS Organization' } });
        }
        business = await prisma.business.create({ data: { name: 'Growth OS Default', organizationId: organization.id } });
      }

      const location = await prisma.location.create({
        data: {
          name,
          categories: JSON.stringify([categories]),
          businessId: business.id
        }
      });
      
      return { success: true, location };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });


  // Get specific location details
  fastify.get('/api/v1/mock-gbp/locations/:locationId', async (request, reply) => {
    try {
      const locationId = parseInt(request.params.locationId);
      
      // Check memory cache
      if (healthScoreCache.has(locationId)) {
        return { location: healthScoreCache.get(locationId) };
      }
      
      const location = await prisma.location.findUnique({
        where: { id: locationId },
        include: { posts: true }
      });

      if (!location) {
        return reply.code(404).send({ error: 'Location not found' });
      }

      // Calculate health score dynamically
      const evaluation = healthService.calculateHealthScore(location);
      
      // Add fake competitors for the radar
      const competitors = [
        { id: 1, name: `Top ${location.categories || 'Local'} in Area`, reviewCount: 154, averageRating: 4.8, postingFreq: 4 },
        { id: 2, name: `Cheap ${location.categories || 'Local'} Nearby`, reviewCount: 82, averageRating: 4.1, postingFreq: 1 }
      ];

      const locationData = {
        ...location,
        healthScore: evaluation.score,
        actions: evaluation.actions,
        competitors
      };

      // Set memory cache
      healthScoreCache.set(locationId, locationData);

      return { location: locationData };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Update specific location (simulating tasks)
  fastify.post('/api/v1/mock-gbp/locations/:locationId/updates', {
    schema: {
      body: {
        type: 'object',
        required: ['task'],
        properties: {
          task: { type: 'string', minLength: 1 },
          value: { type: 'string' }
        }
      },
      params: {
        type: 'object',
        properties: {
          locationId: { type: ['string', 'integer'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const locationId = parseInt(request.params.locationId);
      const { task, value } = request.body;

      const location = await prisma.location.findUnique({
        where: { id: locationId }
      });

      if (!location) {
        return reply.code(404).send({ error: 'Location not found' });
      }

      const updateData = {};
      if (task === 'Add Business Hours') {
        updateData.hours = value;
      } else if (task === 'Add Phone Number') {
        updateData.phone = value;
      } else if (task === 'Add Website') {
        updateData.website = value;
      } else if (task === 'Description is missing') {
        updateData.description = value;
      } else {
        return reply.code(400).send({ error: 'Unknown task' });
      }

      const updatedLocation = await prisma.location.update({
        where: { id: locationId },
        data: updateData
      });

      // Invalidate cache
      invalidateLocationCache(locationId);

      return { success: true, location: updatedLocation };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Reset location data (for settings) - FULL WIPE
  fastify.post('/api/v1/mock-gbp/locations/:locationId/reset', { preValidation: [fastify.requireAdmin] }, async (request, reply) => {
    try {
      const locationId = parseInt(request.params.locationId);
      
      // Delete all reviews, posts, competitors associated with this location
      await prisma.review.deleteMany({ where: { locationId } });
      await prisma.post.deleteMany({ where: { locationId } });
      
      // We also need to delete the location entirely so the onboarding wizard shows
      await prisma.location.delete({
        where: { id: locationId }
      });
      
      // Invalidate cache
      invalidateLocationCache(locationId);
      
      return { success: true };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Pilot Simulator - Inject Traffic
  fastify.post('/api/v1/mock-gbp/locations/:locationId/simulate-traffic', { preValidation: [fastify.requireAdmin] }, async (request, reply) => {
    try {
      const locationId = parseInt(request.params.locationId);
      let finalLocationId = locationId;
      let fallbackCreated = false;

      if (!finalLocationId || isNaN(finalLocationId)) {
        let business = await prisma.business.findFirst();
        if (!business) {
            let organization = await prisma.organization.findFirst();
            if (!organization) organization = await prisma.organization.create({ data: { name: 'Growth OS Organization' } });
            business = await prisma.business.create({ data: { name: 'Growth OS Default', organizationId: organization.id } });
        }
        
        const fallbackLocation = await prisma.location.create({
          data: { name: 'Default Dental Clinic', categories: JSON.stringify(['Dentist']), businessId: business.id }
        });
        finalLocationId = fallbackLocation.id;
        fallbackCreated = true;
      } else {
        const locationExists = await prisma.location.findUnique({ where: { id: finalLocationId } });
        if (!locationExists) {
          let business = await prisma.business.findFirst();
          if (!business) {
              let organization = await prisma.organization.findFirst();
              if (!organization) organization = await prisma.organization.create({ data: { name: 'Growth OS Organization' } });
              business = await prisma.business.create({ data: { name: 'Growth OS Default', organizationId: organization.id } });
          }
          
          const fallbackLocation = await prisma.location.create({
            data: { name: 'Default Dental Clinic', categories: JSON.stringify(['Dentist']), businessId: business.id }
          });
          finalLocationId = fallbackLocation.id;
          fallbackCreated = true;
        }
      }
      
      const mockReviews = [
        { authorName: "Sarah M.", rating: 5, text: "Absolutely wonderful experience! Highly recommended." },
        { authorName: "John D.", rating: 4, text: "Good service overall, but took a little longer than expected." },
        { authorName: "Mike R.", rating: 1, text: "Terrible. I am never coming back here again." },
        { authorName: "Emily W.", rating: 5, text: "The staff was incredibly friendly and helpful!" },
        { authorName: "David L.", rating: 3, text: "It was okay, nothing special but not bad either." },
        { authorName: "Jessica T.", rating: 5, text: "Best in town! Exceeded my expectations." },
        { authorName: "Chris B.", rating: 2, text: "Not impressed. Quality has gone down recently." },
        { authorName: "Amanda K.", rating: 4, text: "Very solid service, I'll definitely return." },
        { authorName: "Robert P.", rating: 5, text: "Incredible attention to detail. 5 stars!" },
        { authorName: "Lisa F.", rating: 1, text: "Waited for an hour and no one helped me." },
        { authorName: "Kevin S.", rating: 4, text: "Pretty good value for the price." },
        { authorName: "Michelle H.", rating: 5, text: "Will tell all my friends about this place." },
        { authorName: "Brian J.", rating: 3, text: "Average experience. Room for improvement." },
        { authorName: "Stephanie N.", rating: 5, text: "Flawless execution! Very happy customer." },
        { authorName: "Daniel G.", rating: 2, text: "Staff seemed stressed and unorganized." }
      ];

      const reviewData = mockReviews.map(r => ({
        locationId: finalLocationId,
        authorName: r.authorName,
        rating: r.rating,
        text: r.text
      }));

      await prisma.review.createMany({ data: reviewData });
      
      // Invalidate cache
      invalidateLocationCache(finalLocationId);
      
      return { success: true, fallbackCreated, locationId: finalLocationId };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

}

module.exports = mockGBPRoutes;

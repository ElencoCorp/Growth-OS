const onboardingService = require('../services/google/onboarding.service');

async function getAccountLocations(request, reply) {
    try {
        // In a real application, this would call the Google Business Profile API using the user's OAuth token
        // For this milestone, we return a mock array of locations available to the account
        
        const mockLocations = [
            { googlePlaceId: 'ChIJ1', name: 'Apex Dental Partners', address: '123 Main St', categories: 'Dentist', googleVerificationStatus: 'VERIFIED' },
            { googlePlaceId: 'ChIJ2', name: 'Bright Smile Dentistry', address: '456 Oak Ave', categories: 'Dentist', googleVerificationStatus: 'VERIFIED' },
            { googlePlaceId: 'ChIJ3', name: 'Curo Dental Clinic', address: '789 Pine Rd', categories: 'Dental Clinic', googleVerificationStatus: 'UNVERIFIED' },
            { googlePlaceId: 'ChIJ4', name: 'Downtown Dental Care', address: '101 City Center', categories: 'Dentist', googleVerificationStatus: 'VERIFIED' },
            { googlePlaceId: 'ChIJ5', name: 'Family First Smiles', address: '202 Suburb Ln', categories: 'Pediatric Dentist', googleVerificationStatus: 'UNVERIFIED' }
        ];

        return reply.send({ success: true, locations: mockLocations });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Failed to fetch account locations' });
    }
}

async function bulkImportLocations(request, reply) {
    try {
        const { locations } = request.body;
        
        if (!locations || !Array.isArray(locations) || locations.length === 0) {
            return reply.code(400).send({ error: 'An array of locations is required' });
        }

        // Get organizationId from tenant context (populated by tenant-resolver or passed in body)
        const organizationId = request.tenant?.organizationId || request.body.organizationId;
        
        if (!organizationId) {
            return reply.code(400).send({ error: 'organizationId is required' });
        }

        // We will collect the results from the generator
        const results = [];
        const generator = onboardingService.importLocationsInBulk(organizationId, locations);
        
        for await (const result of generator) {
            results.push(result);
        }

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        return reply.send({ 
            success: true, 
            message: `Processed ${results.length} locations. ${successful} imported, ${failed} failed or skipped.`,
            results 
        });

    } catch (error) {
        request.log.error(error);
        
        // Handle specific limit errors
        if (error.message.includes('License limit exceeded')) {
            return reply.code(403).send({ error: error.message });
        }
        
        return reply.code(500).send({ error: 'Internal Server Error during bulk import', details: error.message });
    }
}

module.exports = {
    getAccountLocations,
    bulkImportLocations
};

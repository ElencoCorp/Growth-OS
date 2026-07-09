const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PLAN_LIMITS = {
    'FREE': 1,
    '3_MONTHS': 50,
    '6_MONTHS': 100,
    '1_YEAR': 500
};

/**
 * Async generator to process location imports in batches/streams.
 * Yields progress for each location processed.
 */
async function* importLocationsInBulk(organizationId, locationsData) {
    if (!organizationId) throw new Error("Organization ID is required");
    if (!locationsData || !Array.isArray(locationsData) || locationsData.length === 0) {
        throw new Error("Invalid or empty locations array");
    }

    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { planType: true }
    });

    if (!org) throw new Error("Organization not found");

    const limit = PLAN_LIMITS[org.planType] || 1;
    
    // Check current location count
    const currentCount = await prisma.location.count({
        where: { organizationId }
    });

    if (currentCount + locationsData.length > limit) {
        throw new Error(`License limit exceeded. Plan '${org.planType}' allows up to ${limit} locations. You have ${currentCount} and are trying to add ${locationsData.length}.`);
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create a default business if none exists for the organization
    let business = await prisma.business.findFirst({
        where: { organizationId }
    });

    if (!business) {
        business = await prisma.business.create({
            data: {
                name: 'Default Business',
                organizationId
            }
        });
    }

    for (let i = 0; i < locationsData.length; i++) {
        const loc = locationsData[i];
        
        try {
            // Check if place already exists for this org to prevent duplicate inserts
            // We use googlePlaceId if available, otherwise just name (basic unique check for mock)
            const existing = await prisma.location.findFirst({
                where: {
                    organizationId,
                    OR: [
                        { googlePlaceId: loc.googlePlaceId },
                        { name: loc.name }
                    ]
                }
            });

            if (existing) {
                yield { index: i, success: false, name: loc.name, error: 'Location already exists' };
                continue;
            }

            const created = await prisma.location.create({
                data: {
                    name: loc.name,
                    address: loc.address || null,
                    phone: loc.phone || null,
                    website: loc.website || null,
                    categories: loc.categories || null,
                    googlePlaceId: loc.googlePlaceId || null,
                    googleVerificationStatus: loc.googleVerificationStatus || 'UNVERIFIED',
                    onboardedBatchId: batchId,
                    organizationId,
                    businessId: business.id
                }
            });

            yield { index: i, success: true, name: loc.name, id: created.id };
        } catch (error) {
            yield { index: i, success: false, name: loc.name, error: error.message };
        }
    }
}

module.exports = {
    importLocationsInBulk,
    PLAN_LIMITS
};

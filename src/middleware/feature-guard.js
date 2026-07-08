const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Feature-guard middleware for manual B2B licensing.
 * Checks if the organization has an active, non-expired subscription.
 * Returns 402 Payment Required if access is denied.
 */
async function featureGuard(request, reply) {
    try {
        // Resolve organizationId from tenant context (set by tenant-resolver),
        // or from query/body/params
        let orgId = request.tenant?.organizationId;

        if (!orgId) {
            if (request.query.organizationId) orgId = parseInt(request.query.organizationId, 10);
            else if (request.body?.organizationId) orgId = parseInt(request.body.organizationId, 10);
            else if (request.params.organizationId) orgId = parseInt(request.params.organizationId, 10);
        }

        // If we can resolve orgId from a locationId
        if (!orgId) {
            let locId = request.query.locationId || request.body?.locationId || request.params.locationId;
            if (locId) {
                locId = parseInt(locId, 10);
                const location = await prisma.location.findUnique({
                    where: { id: locId },
                    select: { organizationId: true }
                });
                if (location?.organizationId) {
                    orgId = location.organizationId;
                }
            }
        }

        // No org context — allow passthrough (public routes, auth, etc.)
        if (!orgId) return;

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: {
                subscriptionActive: true,
                subscriptionExpiresAt: true,
                planType: true
            }
        });

        if (!org) {
            return reply.code(404).send({
                error: 'Organization not found',
                message: 'The specified organization does not exist.'
            });
        }

        // FREE tier always passes (basic access)
        if (org.planType === 'FREE') return;

        // Check subscription gate
        const now = new Date();
        const isExpired = org.subscriptionExpiresAt && new Date(org.subscriptionExpiresAt) < now;

        if (!org.subscriptionActive || isExpired) {
            return reply.code(402).send({
                error: 'License Expired',
                message: 'Your organization\'s license has expired or is inactive. Please contact your account manager to renew.',
                planType: org.planType,
                expiresAt: org.subscriptionExpiresAt
            });
        }

        // Attach license info to request for downstream use
        request.license = {
            planType: org.planType,
            active: org.subscriptionActive,
            expiresAt: org.subscriptionExpiresAt
        };

    } catch (error) {
        request.log.error(error);
        // Don't block on guard errors — fail open with a log
        console.error('[Feature Guard] Error checking subscription:', error.message);
    }
}

module.exports = featureGuard;

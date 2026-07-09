const whitelabelService = require('../services/whitelabel.service');

async function tenantBranding(request, reply) {
    // If we're at this point, tenantResolver should have populated request.tenant 
    // or organizationId is available in query/body.
    let orgId = request.tenant?.organizationId;
    
    if (!orgId) {
        if (request.query.organizationId) orgId = parseInt(request.query.organizationId, 10);
        else if (request.body?.organizationId) orgId = parseInt(request.body.organizationId, 10);
    }

    if (orgId) {
        try {
            const brandingConfig = await whitelabelService.getBrandingConfig(orgId);
            request.branding = brandingConfig;
        } catch (err) {
            request.log.error(`[TenantBranding] Failed to attach branding for org ${orgId}:`, err);
            // We attach a safe fallback so views won't crash
            request.branding = await whitelabelService.getBrandingConfig(null); 
        }
    } else {
        // Fallback for non-tenant routes
        request.branding = await whitelabelService.getBrandingConfig(null);
    }
}

module.exports = tenantBranding;

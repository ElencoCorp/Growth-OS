const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const emailService = require('../communication/email.service');
const groqService = require('../ai/groq.service');
const ejs = require('ejs');
const path = require('path');

async function generateLocationReport(locationId, orgId) {
    try {
        console.log(`[Aggregator] Generating report for Location ${locationId}`);
        
        // 1. Fetch Location and Org data
        const location = await prisma.location.findUnique({
            where: { id: locationId },
            include: { organization: true }
        });
        if (!location) throw new Error('Location not found');
        
        // 2. Fetch last 30 days metrics
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const metrics = await prisma.metricSnapshot.findMany({
            where: {
                locationId: locationId,
                date: { gte: thirtyDaysAgo }
            },
            orderBy: { date: 'asc' }
        });
        
        const reviews = await prisma.review.count({
            where: {
                locationId: locationId,
                createdAt: { gte: thirtyDaysAgo }
            }
        });
        
        const totalViews = metrics.reduce((sum, m) => sum + m.profileViews, 0);
        const totalQueries = metrics.reduce((sum, m) => sum + m.searchQueries, 0);
        const totalInteractions = metrics.reduce((sum, m) => sum + m.interactions, 0);
        
        // 3. AI Summary
        const prompt = `You are a local SEO expert. Write a short, encouraging 2-sentence summary of the following monthly performance metrics for ${location.name}: Profile Views: ${totalViews}, Search Queries: ${totalQueries}, Interactions: ${totalInteractions}, New Reviews: ${reviews}.`;
        
        // Use groq service
        let summary = "Your local presence is growing! We've seen a solid increase in visibility this month.";
        try {
            summary = await groqService.generateReply(prompt);
        } catch (aiErr) {
            console.log('[Aggregator] Groq failed, using fallback summary.');
        }
        
        // 4. Load branding
        let branding = {
            agencyName: location.organization?.name || 'Growth-OS',
            logoUrl: 'https://via.placeholder.com/150x50?text=Agency+Logo',
            primaryColor: '#3b82f6'
        };
        if (location.organization?.whiteLabelSettings) {
            try {
                branding = { ...branding, ...JSON.parse(location.organization.whiteLabelSettings) };
            } catch(e) {}
        }
        
        // 5. Compile EJS Template
        const templatePath = path.join(__dirname, '../../../views/email-templates/monthly-report.ejs');
        const html = await ejs.renderFile(templatePath, {
            locationName: location.name,
            month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
            metrics: {
                views: totalViews,
                queries: totalQueries,
                interactions: totalInteractions,
                reviews: reviews
            },
            summary: summary,
            branding: branding
        });
        
        // 6. Save Snapshot
        const reportData = JSON.stringify({
            metrics: { views: totalViews, queries: totalQueries, interactions: totalInteractions, reviews },
            summary,
            branding
        });
        
        const snapshot = await prisma.reportSnapshot.create({
            data: {
                locationId: location.id,
                organizationId: orgId,
                dateRange: 'Last 30 Days',
                reportData: reportData,
                status: 'SENT'
            }
        });
        
        // 7. Dispatch Email (Mock)
        await emailService.sendReportEmail('client@example.com', `Monthly Performance Report: ${location.name}`, html);
        
        console.log(`[Aggregator] Successfully generated and sent report for Location ${locationId}`);
        return snapshot;
        
    } catch (error) {
        console.error('[Aggregator] Error generating report:', error);
        throw error;
    }
}

module.exports = {
    generateLocationReport
};

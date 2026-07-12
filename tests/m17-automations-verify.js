const { chromium } = require('playwright');
const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
    let browser;
    try {
        console.log('🚀 Initiating Milestone 17 Automations Studio Verification...');
        
        const business = await prisma.business.findFirst();
        if (!business) throw new Error('No business found for testing');
        
        const location = await prisma.location.findFirst({ where: { businessId: business.id } });
        if (!location) throw new Error('No location found for testing');

        console.log('Seeding mock AutomationRule...');
        const rule = await prisma.automationRule.create({
            data: {
                businessId: business.id,
                ruleType: 'DAILY_POST_GENERATOR',
                isActive: true,
                configPayload: JSON.stringify({ tone: 'Professional', frequency: 'Daily' })
            }
        });

        // Seed a mock log
        let job = await prisma.cronJob.findUnique({ where: { jobName: 'DAILY_POST_GENERATOR' } });
        if (!job) {
            job = await prisma.cronJob.create({
                data: { jobName: 'DAILY_POST_GENERATOR', status: 'IDLE' }
            });
        }
        
        const log = await prisma.cronJobLog.create({
            data: {
                cronJobId: job.id,
                status: 'COMPLETED',
                message: 'Test log execution',
                durationMs: 150,
                recordsSent: 1
            }
        });

        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            ignoreHTTPSErrors: true
        });
        
        await context.addCookies([{
            name: 'locationId',
            value: location.id.toString(),
            domain: '127.0.0.1',
            path: '/'
        }]);

        const page = await context.newPage();
        
        console.log('Navigating to /automations endpoint...');
        await page.goto('http://127.0.0.1:3000/automations');
        await page.waitForLoadState('networkidle');
        
        console.log('Asserting Matrix and Execution Logs...');
        const heading = await page.locator('h1:has-text("AI Automations Control Grid")');
        assert.ok(await heading.isVisible(), 'Automations heading should be visible.');
        
        // Wait for Alpine initialization and fetch
        await page.waitForTimeout(1000);
        
        // Check for the rendered workflow card
        const workflowName = await page.locator('h3:has-text("Daily Post Generator")').first();
        assert.ok(await workflowName.isVisible(), 'Mock workflow card should render properly.');

        // Test the Pause/Resume Switch Toggle
        console.log('Simulating Workflow Toggle...');
        const toggleBtn = page.locator('button[title="Pause / Resume"]').first();
        await toggleBtn.click();
        
        await page.waitForTimeout(1000); // Wait for background PATCH
        
        // Assert the badge turned to "Paused"
        const pausedBadge = page.locator('span:has-text("Paused")').first();
        await pausedBadge.waitFor({ state: 'visible', timeout: 5000 });
        assert.ok(await pausedBadge.isVisible(), 'Status badge should dynamically update to Paused.');

        // Test the Run Now trigger
        console.log('Simulating Run Now manual execution...');
        const runBtn = page.locator('button[title="Run Now"]').first();
        await runBtn.click();
        
        await page.waitForTimeout(1500); // Wait for background POST and log refetch simulation
        
        // The new log should appear in the audit vault
        const runLogText = await page.locator('p:has-text("Manual execution triggered")').first();
        assert.ok(await runLogText.isVisible(), 'Execution audit vault should dynamically prepend new execution logs.');

        console.log('Cleaning up mock data...');
        await prisma.automationRule.delete({ where: { id: rule.id } });
        await prisma.cronJobLog.delete({ where: { id: log.id } });

        console.log('🎉 Verification Pass: Milestone 17 (Automations Studio) pipeline is fully operational.');
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
        await prisma.$disconnect();
    }
})();

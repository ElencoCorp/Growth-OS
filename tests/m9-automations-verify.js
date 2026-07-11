const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
    console.log('=== Testing Milestone 9: AI Automations Grid ===');
    const browser = await chromium.launch();
    
    try {
        console.log('\n1. Preparing Test Data...');
        const org = await prisma.organization.findFirst();
        if (!org) throw new Error('No organization found');
        
        let business = await prisma.business.findFirst({ where: { organizationId: org.id }});
        if (!business) {
            business = await prisma.business.create({
                data: { name: 'Test Business', organizationId: org.id }
            });
        }

        let loc = await prisma.location.findFirst({ where: { businessId: business.id }});
        if (!loc) {
            loc = await prisma.location.create({
                data: { name: 'Test Location', businessId: business.id, organizationId: org.id }
            });
        }
        
        let automation = await prisma.automationRule.findFirst({ where: { businessId: business.id }});
        if (!automation) {
            automation = await prisma.automationRule.create({
                data: {
                    businessId: business.id,
                    ruleType: 'REVIEW_AUTO_REPLY',
                    isActive: true,
                    configPayload: '{}'
                }
            });
        }
        
        console.log(`✓ Data ready. Location ID: ${loc.id}, Automation ID: ${automation.id}`);
        
        const context = await browser.newContext();
        await context.addCookies([
            {
                name: 'locationId',
                value: String(loc.id),
                domain: '127.0.0.1',
                path: '/'
            }
        ]);

        const page = await context.newPage();
        
        console.log('\n2. Navigating to Dashboard...');
        const response = await page.goto(`http://127.0.0.1:3000/?locationId=${loc.id}`, { waitUntil: 'networkidle' });
        if (response.status() !== 200) throw new Error('Failed to load page: HTTP ' + response.status());
        
        console.log('\n3. Asserting UI Render...');
        await page.waitForSelector('#card-automations');
        const automationsText = await page.textContent('#card-automations');
        if (!automationsText.includes('REVIEW AUTO REPLY')) {
            throw new Error('Automation rule type did not render correctly in the UI.');
        }
        console.log('✓ UI successfully hydrated with backend records.');

        console.log('\n4. Simulating Zero-Reload Toggle Switch...');
        const initialActiveState = automation.isActive;

        const toggleResponsePromise = page.waitForResponse(response => 
            response.url().includes(`/api/v1/automations/${automation.id}/toggle`) && response.status() === 200
        );

        await page.click('#card-automations button[role="switch"]');

        const toggleResponse = await toggleResponsePromise;
        const toggleData = await toggleResponse.json();
        
        if (toggleData.success !== true) {
            throw new Error('Toggle endpoint returned failure.');
        }

        console.log(`✓ Toggle successfully fired and returned 200 OK.`);
        console.log(`✓ State Transition: ${initialActiveState} -> ${toggleData.automation.isActive}`);
        
        const checkDb = await prisma.automationRule.findUnique({ where: { id: automation.id }});
        if (checkDb.isActive === initialActiveState) {
            throw new Error('Database was not updated by the toggle endpoint.');
        }
        console.log('✓ Database confirmed updated in real-time.');
        
        console.log('\n=== Milestone 9 Tests Passed Successfully ===\n');

    } catch (e) {
        console.error('Test Failed:', e);
        process.exit(1);
    } finally {
        await browser.close();
        await prisma.$disconnect();
    }
}

runTest();

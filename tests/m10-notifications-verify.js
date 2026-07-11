const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
    console.log('=== Testing Milestone 10: Real-Time Notifications Engine ===');
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
        } else if (!loc.organizationId) {
            loc = await prisma.location.update({
                where: { id: loc.id },
                data: { organizationId: org.id }
            });
        }
        
        let notification = await prisma.notification.findFirst({ where: { locationId: loc.id }});
        if (!notification) {
            notification = await prisma.notification.create({
                data: {
                    locationId: loc.id,
                    title: 'Test Notification',
                    message: 'This is a test notification for M10.',
                    isRead: false
                }
            });
        } else {
            notification = await prisma.notification.update({
                where: { id: notification.id },
                data: { isRead: false }
            });
        }
        
        console.log(`✓ Data ready. Location ID: ${loc.id}, Notification ID: ${notification.id}`);
        
        const context = await browser.newContext();
        await context.addCookies([
            {
                name: 'organizationId',
                value: String(org.id),
                domain: '127.0.0.1',
                path: '/'
            },
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
        await page.waitForSelector('#notification-bell-btn');
        
        const pageStats = await page.evaluate(() => {
            // Find the Alpine data
            const el = document.querySelector('body');
            return el.__x ? el.__x.$data.stats : null;
        });
        console.log('Alpine stats object:', pageStats);
        
        // Wait for unread count pill
        await page.waitForSelector('#notification-bell-btn span.bg-red-500', { state: 'attached' });
        const unreadPillText = await page.textContent('#notification-bell-btn span.bg-red-500');
        console.log(`Unread pill text from DOM: "${unreadPillText}"`);
        if (parseInt(unreadPillText) < 1) {
            throw new Error('Unread counter pill did not render correctly in the UI.');
        }
        console.log(`✓ Unread counter pill visible (Count: ${unreadPillText}).`);

        console.log('\n4. Simulating Zero-Reload Read Toggle...');
        
        // Click the bell
        await page.click('#notification-bell-btn');
        console.log('✓ Bell clicked, dropdown opened.');
        
        const readResponsePromise = page.waitForResponse(response => 
            response.url().includes(`/api/v1/notifications/${notification.id}/read`) && response.status() === 200
        );

        // Click the notification row
        // The notification row has @click="markNotificationRead(notif)"
        // Let's find the specific one by its title or just the first unread one
        await page.waitForSelector(`text=Test Notification`, { state: 'visible' });
        await page.click(`text=Test Notification`);

        const readResponse = await readResponsePromise;
        const readData = await readResponse.json();
        
        if (readData.success !== true) {
            throw new Error('Read endpoint returned failure.');
        }

        console.log(`✓ Read toggle successfully fired and returned 200 OK.`);
        
        const checkDb = await prisma.notification.findUnique({ where: { id: notification.id }});
        if (checkDb.isRead !== true) {
            throw new Error('Database was not updated by the read endpoint.');
        }
        console.log('✓ Database confirmed updated to isRead = true in real-time.');
        
        console.log('\n=== Milestone 10 Tests Passed Successfully ===\n');

    } catch (e) {
        console.error('Test Failed:', e);
        process.exit(1);
    } finally {
        await browser.close();
        await prisma.$disconnect();
    }
}

runTest();

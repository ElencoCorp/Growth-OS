const { chromium } = require('playwright');
const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
    let browser;
    try {
        console.log('🚀 Initiating Milestone 13 Reviews Hub Verification...');
        
        // Seed mock review for testing action
        const location = await prisma.location.findFirst();
        if (!location) throw new Error('No location found for seeding tests');

        const mockReview = await prisma.review.upsert({
            where: { googleReviewId: 'mock-review-verify-13' },
            create: {
                authorName: 'Test Reviewer',
                rating: 5,
                text: 'Great service!',
                status: 'NEEDS_REPLY',
                aiSuggestedReply: 'Thank you for your feedback! We appreciate it.',
                googleReviewId: 'mock-review-verify-13',
                locationId: location.id
            },
            update: {
                status: 'NEEDS_REPLY',
                aiSuggestedReply: 'Thank you for your feedback! We appreciate it.',
                publishedReply: null
            }
        });

        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            ignoreHTTPSErrors: true
        });
        
        // Mock a cookie to simulate having an active location
        await context.addCookies([{
            name: 'locationId',
            value: location.id.toString(),
            domain: '127.0.0.1',
            path: '/'
        }]);

        const page = await context.newPage();
        
        console.log('Navigating to /reviews endpoint...');
        await page.goto('http://127.0.0.1:3000/reviews');
        await page.waitForLoadState('networkidle');
        
        console.log('Asserting dual-column workspace rendering (Tabs & Inbox)...');
        const heading = await page.locator('h1:has-text("Extended Reviews Hub")');
        assert.ok(await heading.isVisible(), 'Reviews heading should be visible.');
        
        // Wait for Alpine initialization
        await page.waitForTimeout(1000);

        console.log('Simulating rapid clicks across the sentiment filter tabs...');
        await page.click('button:has-text("Positive")');
        await page.waitForTimeout(500); // Allow API fetch to resolve
        
        await page.click('button:has-text("Needs Reply")');
        await page.waitForTimeout(500);
        
        await page.click('button:has-text("Pending Approval")');
        await page.waitForTimeout(500);

        // Go back to "All" to find our mock review easily
        await page.click('button:has-text("All")');
        await page.waitForTimeout(1000); // Allow API fetch to resolve
        
        console.log('Programmatically interacting with an "Approve Response" button...');
        // Find the "Approve Response" button specifically within our mock review's text block or generally the first one
        const approveBtn = await page.locator('button:has-text("Approve Response")').first();
        assert.ok(await approveBtn.isVisible(), 'Approve Response button should be visible.');
        
        await approveBtn.click();
        
        // Wait for optimistic UI update and network response
        await page.waitForTimeout(1000);
        
        console.log('Confirming database commit via Prisma...');
        const updatedReview = await prisma.review.findUnique({
            where: { id: mockReview.id }
        });
        
        assert.strictEqual(updatedReview.status, 'PENDING_PUBLISH', 'Status should be transitioned to PENDING_PUBLISH.');
        
        console.log('Confirming Publish Live transition...');
        const publishBtn = await page.locator('button:has-text("Publish Live")').first();
        await publishBtn.click();
        
        await page.waitForTimeout(1000);

        const finalizedReview = await prisma.review.findUnique({
            where: { id: mockReview.id }
        });
        
        assert.strictEqual(finalizedReview.status, 'REPLIED', 'Status should be transitioned to REPLIED.');
        assert.strictEqual(finalizedReview.publishedReply, 'Thank you for your feedback! We appreciate it.', 'Published reply should be populated.');
        
        console.log('🎉 Verification Pass: Milestone 13 (Reviews Hub) logic works perfectly with 0 exceptions.');
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
        await prisma.$disconnect();
    }
})();

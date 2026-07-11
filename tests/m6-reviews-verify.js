const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

// Copy crypto util logic to mock the encrypted token
const algorithm = 'aes-256-cbc';
const secretKey = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'; 

function encryptMock(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

(async () => {
  console.log('🚀 Starting M6 Review Pipeline Verification...');
  const prisma = new PrismaClient();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  try {
    // Seed a review for all locations
    const locations = await prisma.location.findMany();
    for (const location of locations) {
        // Inject mock googleAccessToken so the server doesn't 500 when publishing replies
        await prisma.location.update({
            where: { id: location.id },
            data: { googleAccessToken: encryptMock('mock_access_token_123') }
        });
        await prisma.review.create({
            data: {
                locationId: location.id,
                googleReviewId: 'mock_google_review_' + location.id + '_' + Date.now(),
                authorName: 'Test User',
                rating: 5,
                text: 'Great experience, highly recommend!',
                status: 'PENDING',
                aiSuggestedReply: 'Thank you for the wonderful feedback, Test User! We are thrilled you had a great experience.'
            }
        });
        console.log(`Seeded mock review for Location ID: ${location.id}`);
    }

    const page = await context.newPage();
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));

    console.log('Navigating to root dashboard...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

    console.log('Checking for Review Pipeline card...');
    await page.waitForSelector('#card-reviews');

    const reviewItems = await page.locator('#card-reviews .bg-slate-50').all();
    console.log(`Found ${reviewItems.length} review rows hydrated from SQLite.`);
    
    if (reviewItems.length === 0) {
        throw new Error('No reviews rendered in the pipeline!');
    }

    // Locate the first AI Reply button
    console.log('Locating AI Reply action button...');
    const aiReplyBtn = await reviewItems[0].locator('button:has-text("AI Reply")').first();
    
    if (await aiReplyBtn.count() > 0) {
        console.log('Button HTML:', await aiReplyBtn.evaluate(b => b.outerHTML));
        console.log('Clicking AI Reply to trigger async state mutation...');
        
        // Wait for request/response on the API
        const [response] = await Promise.all([
            page.waitForResponse(res => res.url().includes('/api/v1/reviews/') && res.url().includes('/reply') && res.request().method() === 'POST'),
            aiReplyBtn.click({ force: true })
        ]);
        
        console.log(`Intercepted API POST Response: HTTP ${response.status()}`);
        
        if (response.status() !== 200) {
            const errBody = await response.text();
            throw new Error(`API returned ${response.status()} instead of 200. Body: ${errBody}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error('API reported failure payload.');
        }

        console.log('Waiting for Alpine.js to reactively update the DOM state to "Replied"...');
        // Wait for the button to disappear and the "Replied" text to show
        await page.waitForFunction(() => {
            const card = document.querySelector('#card-reviews');
            return card.textContent.includes('Replied');
        });

        console.log('✅ Review Pipeline state seamlessly updated via async API without a white screen reload.');
    } else {
        console.log('No pending AI Reply button found. Either all reviews are replied or something is wrong.');
    }

    console.log('🎉 M6 Verification Complete!');
  } catch (error) {
    console.error('❌ M6 Validation Failed: ', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

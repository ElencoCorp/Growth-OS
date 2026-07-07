const prisma = require('../src/db');
const { processUnhandledReviews } = require('../src/services/cron.service');

async function runTests() {
  console.log('--- Starting Milestone 6 Validation ---');
  try {
    console.log('[Test 1] Testing Automated AI Background Cron Process...');
    
    // 1. Ensure we have a location
    const location = await prisma.location.findFirst();
    if (!location) throw new Error('No mock location found.');

    // 2. Insert a new unhandled mock review
    const newReview = await prisma.review.create({
        data: {
            authorName: 'Test Automation User',
            rating: 2,
            text: 'This is a test review for the cron processor.',
            locationId: location.id
        }
    });
    console.log(`  -> Inserted unhandled mock review (ID: ${newReview.id})`);

    // 3. Directly invoke the cron processing function (to bypass 60s wait)
    console.log('  -> Triggering background processor...');
    await processUnhandledReviews();

    // 4. Query the DB to check if the reply was generated and saved
    const processedReview = await prisma.review.findUnique({
        where: { id: newReview.id }
    });

    if (processedReview.reply && processedReview.reply.length > 5) {
        console.log(`  -> Success! Cron job detected the review and automatically appended AI reply.`);
        console.log(`     Generated Reply: "${processedReview.reply}"`);
    } else {
        throw new Error('Cron job failed to update the review with an AI reply.');
    }

    // Clean up test data
    await prisma.review.delete({
        where: { id: newReview.id }
    });

    console.log('--- Milestone 6 Validation Completed Successfully ---');
    mockServer.kill();
    process.exit(0);
  } catch (error) {
    console.error('\nMilestone 6 Validation Failed:', error.message);
    mockServer.kill();
    process.exit(1);
  }
}

// Start mock server before running tests
const { spawn } = require('child_process');
const mockServer = spawn('node', ['tests/mock-ollama.js']);

mockServer.stdout.on('data', (data) => {
    if (data.toString().includes('Server running')) {
        runTests();
    }
});

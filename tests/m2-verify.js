require('dotenv').config();
const prisma = require('../src/db');
const aiService = require('../src/services/ai.service');

async function runTests() {
  console.log('--- Starting Milestone 2 Validation ---');
  try {
    // 1. Seed a mock review for testing
    console.log('[Test 1] Finding or creating mock review...');
    let location = await prisma.location.findFirst();
    if (!location) {
        const org = await prisma.organization.create({
            data: { name: 'Test Org' }
        });
        const biz = await prisma.business.create({
            data: { name: 'Test Biz', organizationId: org.id }
        });
        location = await prisma.location.create({
            data: { name: 'Test Loc', businessId: biz.id }
        });
    }

    const review = await prisma.review.create({
      data: {
        authorName: 'Jane Smith',
        rating: 1,
        text: 'The plumber arrived 2 hours late and was very rude. Do not recommend.',
        locationId: location.id
      }
    });
    console.log(`  -> Mock review created (ID: ${review.id})`);

    // 2. Test the AI generation logic directly
    console.log('[Test 2] Connecting to Local Ollama AI Engine...');
    console.log('  -> Sending request to llama3.2:1b...');
    
    // NOTE: This will fail if Ollama is not running locally on 11434 with llama3.2:1b
    const draft = await aiService.generateReviewReply(review.text);
    
    console.log('\n--- Generated Draft ---');
    console.log(draft);
    console.log('-----------------------\n');

    if (draft && draft.length > 10) {
      console.log('  -> Success! AI generated a clean string response.');
    } else {
      throw new Error('AI response was empty or too short.');
    }

    console.log('--- Milestone 2 Validation Completed Successfully ---');
    process.exit(0);
  } catch (error) {
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.error('\n[ERROR] Ollama is not running or unreachable on http://localhost:11434.');
      console.error('Please ensure Ollama is installed and run `ollama run llama3.2:1b`.');
    }
    console.error('\nMilestone 2 Validation Failed:', error.message);
    process.exit(1);
  }
}

runTests();

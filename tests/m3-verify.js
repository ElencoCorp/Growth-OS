const { calculateHealthScore } = require('../src/services/health.service');

async function runTests() {
  console.log('--- Starting Milestone 3 Validation ---');
  try {
    console.log('[Test 1] Auditing Mock Profile...');
    
    // Create an incomplete profile mock (simulating what the DB/Mock API would return)
    const mockProfile = {
      name: 'Delhi Plumbing Services',
      address: '123 Fake Street',
      phone: null, // missing
      website: 'https://example.com',
      categories: [], // missing
      hours: null // missing
    };

    console.log(`  -> Profile loaded with missing attributes: phone, categories, hours.`);
    
    const result = calculateHealthScore(mockProfile);
    
    console.log(`\n  -> Business Health Score calculated: ${result.score}/100`);
    console.log(`  -> Actions Stack Generated: ${result.actions.length} tasks`);
    
    // Assertions
    // Phone (-15), Categories (-20), Hours (-15) = -50
    // 100 - 50 = 50
    if (result.score !== 50) {
      throw new Error(`Expected score 50, got ${result.score}`);
    }

    if (result.actions.length !== 3) {
      throw new Error(`Expected exactly 3 action tasks, got ${result.actions.length}`);
    }

    // Verify task content
    const taskTitles = result.actions.map(a => a.title);
    if (!taskTitles.includes('Add Business Phone Number')) {
      throw new Error('Expected "Add Business Phone Number" task in stack');
    }

    console.log('\n--- Generated Actions Stack ---');
    result.actions.forEach((action, i) => {
        console.log(` ${i + 1}. [Priority ${action.priority}] ${action.title} - ${action.description}`);
    });
    console.log('-------------------------------\n');

    console.log('  -> Success! Health Score logic accurately decreases score and pushes tasks.');
    console.log('--- Milestone 3 Validation Completed Successfully ---');
    process.exit(0);
  } catch (error) {
    console.error('\nMilestone 3 Validation Failed:', error.message);
    process.exit(1);
  }
}

runTests();

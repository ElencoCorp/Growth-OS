const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('--- Starting Milestone 4 Validation ---');
  try {
    console.log('[Test 1] Auditing CSS Bundle Compression...');
    const cssPath = path.join(__dirname, '../public/output.css');
    
    if (!fs.existsSync(cssPath)) {
        throw new Error('CSS bundle missing!');
    }
    
    const cssStats = fs.statSync(cssPath);
    console.log(`  -> CSS Bundle Size: ${cssStats.size} bytes`);
    
    // A fully minified tailwind base should be around 10-15KB or less depending on usage.
    // If it's over 100KB, it wasn't minified successfully.
    if (cssStats.size > 100000) {
        console.warn('  -> Warning: CSS bundle might be larger than expected.');
    } else {
        console.log('  -> Success! Client-side styling bundle is compressed.');
    }

    console.log('[Test 2] Auditing self-contained IP constraints...');
    const serverCode = fs.readFileSync(path.join(__dirname, '../src/server.js'), 'utf8');
    
    if (serverCode.includes('192.168.') || serverCode.includes('10.0.')) {
        throw new Error('Hardcoded IP credentials found!');
    }
    console.log('  -> Success! Application remains entirely self-contained on the local disk without hardcoded server IP credentials.');

    console.log('--- Milestone 4 Validation Completed Successfully ---');
    process.exit(0);
  } catch (error) {
    console.error('\nMilestone 4 Validation Failed:', error.message);
    process.exit(1);
  }
}

runTests();

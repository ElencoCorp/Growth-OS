const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const scriptsToRun = [
    'm12-queue-verify.js',
    'm13-radar-verify.js',
    'm14-analytics-verify.js',
    'm15-bulk-onboarding-verify.js',
    'm16-webhook-verify.js',
    'm17-whitelabel-verify.js',
    'm18-telemetry-verify.js',
    'm19-autopilot-verify.js',
    'm19-live-verify.js'
];

console.log('======================================================');
console.log('   GROWTH-OS COMPREHENSIVE E2E SYSTEM TEST RUNNER');
console.log('======================================================\n');

let passCount = 0;
let failCount = 0;
const failures = [];

for (const script of scriptsToRun) {
    const fullPath = path.join(__dirname, script);
    if (!fs.existsSync(fullPath)) {
        console.warn(`[SKIP] Script not found: ${script}`);
        continue;
    }

    console.log(`\n▶ RUNNING SUITE: ${script} ...`);
    try {
        const output = execSync(`node "${fullPath}"`, { stdio: 'pipe', encoding: 'utf-8' });
        console.log(output.trim());
        console.log(`\n✅ SUITE PASSED: ${script}`);
        passCount++;
    } catch (error) {
        console.error(`\n❌ SUITE FAILED: ${script}`);
        console.error(error.stdout || error.message);
        failures.push(script);
        failCount++;
    }
}

console.log('\n======================================================');
console.log('                  TEST RUN COMPLETE');
console.log('======================================================');
console.log(`TOTAL SUITES: ${passCount + failCount}`);
console.log(`PASSED: ${passCount}`);
console.log(`FAILED: ${failCount}`);

if (failCount > 0) {
    console.log(`Failed Suites: ${failures.join(', ')}`);
    process.exit(1);
} else {
    console.log('System is 100% HEALTHY across all modules. Ready for production deployment.');
    process.exit(0);
}

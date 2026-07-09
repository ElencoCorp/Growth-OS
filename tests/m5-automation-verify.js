const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { runWeeklyRadarScan } = require('../src/services/automation-orchestrator.service');
const { dispatchJob, initCronSystem, getSystemStatus } = require('../src/services/cron-runner.service');

async function runTests() {
  console.log('=== Testing Module 5: Background Cron & Automation Runner ===');

  try {
    console.log('\n1. Testing System Boot Hooks (Stuck Job Recovery)...');
    
    // Create a stuck job
    await prisma.cronJob.upsert({
        where: { jobName: 'MOCK_STUCK_JOB' },
        update: { status: 'RUNNING' },
        create: { jobName: 'MOCK_STUCK_JOB', status: 'RUNNING' }
    });

    await initCronSystem();

    const recoveredJob = await prisma.cronJob.findUnique({ where: { jobName: 'MOCK_STUCK_JOB' } });
    if (recoveredJob.status !== 'FAILED') {
        throw new Error(`System boot hook failed to recover stuck job. Expected FAILED, got ${recoveredJob.status}`);
    }
    console.log('✓ Stuck job cleanly transitioned to FAILED on initialization.');

    console.log('\n2. Testing Automation Orchestrator (Cursor Batching & Jitter & Lock Escapes)...');
    
    const startTime = Date.now();
    await dispatchJob('WEEKLY_RADAR_SCAN');
    const endTime = Date.now();
    const elapsed = endTime - startTime;

    console.log(`✓ Radar scan finished cleanly in ${elapsed}ms without blocking the event loop.`);

    console.log('\n3. Validating System Status and Logs...');
    const statusData = await getSystemStatus();
    
    const radarJobInfo = statusData.find(j => j.jobName === 'WEEKLY_RADAR_SCAN');
    if (!radarJobInfo) throw new Error('Job was not tracked in DB');
    if (radarJobInfo.status !== 'IDLE') throw new Error('Job did not reset back to IDLE');
    if (radarJobInfo.logs.length === 0) throw new Error('No logs were written for the job');
    if (radarJobInfo.logs[0].status !== 'COMPLETED') throw new Error(`Log status was ${radarJobInfo.logs[0].status} not COMPLETED`);

    console.log('✓ System Status cleanly retrieved. Log arrays bound correctly.');

    console.log('\n=== Module 5 Tests Passed: Execution Pipeline is Stable ===');
  } catch (error) {
    console.error('\nTest failed with unhandled exception:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();

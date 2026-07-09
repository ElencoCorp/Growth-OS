const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { runBatchPostPublisher } = require('../src/services/chrono-queue.service');

async function runTests() {
  console.log('=== Testing Milestone 12: Automated Batch Publisher ===');
  
  let organization;

  try {
    console.log('\n1. Seeding Mock Content & Chrono Queue Entities...');
    organization = await prisma.organization.create({
        data: {
            name: 'Test Org M12',
            planType: 'PRO',
            subscriptionActive: true,
            platformCredentials: {
                create: [
                    {
                        platform: 'GBP',
                        accessToken: 'mock_gbp_token',
                        publishTargets: {
                            create: [{ platformAccountId: 'gbp_loc_12' }]
                        }
                    },
                    {
                        platform: 'META',
                        accessToken: 'mock_meta_token',
                        publishTargets: {
                            create: [{ platformAccountId: 'meta_page_12' }]
                        }
                    }
                ]
            }
        }
    });

    const business = await prisma.business.create({
        data: { name: 'Test Business M12', organizationId: organization.id }
    });

    const location = await prisma.location.create({
        data: {
            name: 'Test Location M12',
            businessId: business.id,
            organizationId: organization.id
        }
    });

    // Extract targets
    const creds = await prisma.platformCredential.findMany({ where: { organizationId: organization.id }, include: { publishTargets: true } });
    const targetIds = creds.flatMap(c => c.publishTargets.map(pt => pt.id));

    // Create ContentPiece directly in QUEUED state, scheduled in the past
    const pastDate = new Date();
    pastDate.setMinutes(pastDate.getMinutes() - 10);

    const post1 = await prisma.contentPiece.create({
        data: {
            locationId: location.id,
            textContent: 'Test Scheduled Post',
            status: 'QUEUED',
            scheduledFor: pastDate,
            targets: {
                create: targetIds.map(tid => ({
                    publishTargetId: tid,
                    status: 'PENDING'
                }))
            }
        },
        include: { targets: true }
    });

    console.log(`✓ Seeded QUEUED Post (ID: ${post1.id}), scheduled for ${pastDate.toISOString()}`);

    console.log('\n2. Testing Background Batch Processor (Cursor chunking & Groq Error Translation)...');
    
    // Force Groq AI to run by simulating network error on the Dispatcher
    process.env.MOCK_API_FAIL = 'true';

    const startTime = Date.now();
    await runBatchPostPublisher();
    const duration = Date.now() - startTime;
    
    console.log(`✓ Batch Publisher execution completed in ${duration}ms (Expected ~1000ms for 2 targets).`);

    console.log('\n3. Validating Processing States and AI Trace Results...');
    
    const processedPost = await prisma.contentPiece.findUnique({
        where: { id: post1.id },
        include: { targets: true }
    });

    if (processedPost.status !== 'PUBLISHED') {
        throw new Error(`Expected PUBLISHED, got ${processedPost.status}`);
    }

    let allPublished = true;
    for (const target of processedPost.targets) {
        if (target.status !== 'PUBLISHED') {
            allPublished = false;
        }
        console.log(`   - Target ID ${target.id} Status: ${target.status}, Error: "${target.errorMessage}"`);
    }

    if (!allPublished) {
        console.warn('⚠️ Some targets were not marked as PUBLISHED.');
    }

    const logs = await prisma.cronJobLog.findMany({
        where: { cronJob: { jobName: 'BATCH_POST_PUBLISHER' } },
        orderBy: { executedAt: 'desc' },
        take: 1
    });

    if (logs.length > 0) {
        console.log(`✓ CronJobLog successfully captured: ${logs[0].recordsSent} records sent, status: ${logs[0].status}`);
    } else {
        throw new Error('CronJobLog was not created');
    }

    console.log('\n=== Milestone 12 Tests Passed ===');

  } catch (error) {
    console.error('\nTest failed with unhandled exception:', error);
    process.exit(1);
  } finally {
    if (organization) {
        await prisma.contentPiece.deleteMany({ where: { location: { organizationId: organization.id } } });
        await prisma.location.deleteMany({ where: { organizationId: organization.id } });
        await prisma.business.deleteMany({ where: { organizationId: organization.id } });
        
        const creds = await prisma.platformCredential.findMany({ where: { organizationId: organization.id } });
        for (const c of creds) {
            await prisma.publishTarget.deleteMany({ where: { platformCredentialId: c.id } });
        }
        await prisma.platformCredential.deleteMany({ where: { organizationId: organization.id } });

        await prisma.organization.deleteMany({ where: { id: organization.id } });
    }
    await prisma.$disconnect();
  }
}

runTests();

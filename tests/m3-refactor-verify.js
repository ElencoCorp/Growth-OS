const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { createDraftPost, approveContentPiece, publishContentPiece } = require('../src/services/content-studio.service');

async function runTests() {
  console.log('=== Testing Module 3: Content Studio Refactor ===');
  
  let location;
  let organization;

  try {
    console.log('\n1. Seeding Mock Fan-Out Credentials & Targets...');
    organization = await prisma.organization.create({
        data: {
            name: 'Test Org M3',
            planType: 'PRO',
            subscriptionActive: true,
            platformCredentials: {
                create: [
                    {
                        platform: 'GBP',
                        accessToken: 'mock_gbp_token',
                        publishTargets: {
                            create: [{ platformAccountId: 'gbp_loc_1' }]
                        }
                    },
                    {
                        platform: 'META',
                        accessToken: 'mock_meta_token',
                        publishTargets: {
                            create: [{ platformAccountId: 'meta_page_1' }]
                        }
                    }
                ]
            }
        }
    });

    const business = await prisma.business.create({
        data: { name: 'Test Business M3', organizationId: organization.id }
    });

    location = await prisma.location.create({
        data: {
            name: 'Test Location M3',
            businessId: business.id,
            organizationId: organization.id
        }
    });

    console.log(`✓ Seeded Location (ID: ${location.id}) with GBP and META targets.`);

    console.log('\n2. Testing Post Generation (Draft State)...');
    
    // Test Unsplash query router format
    const contentPiece = await createDraftPost(location.id, 'Summer Dental Sale', 'dentist');
    
    if (contentPiece.status !== 'DRAFT_PENDING_REVIEW') {
        throw new Error(`Expected DRAFT_PENDING_REVIEW, got ${contentPiece.status}`);
    }
    if (!contentPiece.imageUrl.includes('&w=800&h=600&fit=crop') && !contentPiece.imageUrl.includes('fallback')) {
        throw new Error('Unsplash query router failed to append structural parameters');
    }
    if (contentPiece.targets.length !== 2) {
        throw new Error(`Expected 2 fan-out targets to be created, got ${contentPiece.targets.length}`);
    }

    console.log(`✓ Post generated in DRAFT_PENDING_REVIEW state (ID: ${contentPiece.id})`);
    console.log(`✓ Unsplash Image URL Formatted: ${contentPiece.imageUrl}`);
    console.log(`✓ Text Generated: ${contentPiece.textContent}`);

    console.log('\n3. Testing Approval State Transition...');
    
    const approvedPiece = await approveContentPiece(contentPiece.id);
    if (approvedPiece.status !== 'APPROVED') {
        throw new Error(`Expected APPROVED, got ${approvedPiece.status}`);
    }
    
    console.log(`✓ Post advanced to APPROVED state`);

    console.log('\n4. Testing Fan-Out Publish & Token Bucket Integration...');
    
    const publishedPiece = await publishContentPiece(approvedPiece.id);
    
    if (publishedPiece.status !== 'PUBLISHED') {
        throw new Error(`Expected PUBLISHED, got ${publishedPiece.status}`);
    }

    const successfulTargets = publishedPiece.targets.filter(t => t.status === 'PUBLISHED');
    if (successfulTargets.length !== 2) {
        throw new Error('Not all targets were successfully published');
    }

    console.log(`✓ Post fan-out successfully completed.`);
    console.log(`✓ Post Parent marked as PUBLISHED`);
    for (const target of publishedPiece.targets) {
        console.log(`   - Target ID ${target.id} marked as ${target.status} with ExtID: ${target.externalPostId}`);
    }

    console.log('\n=== Module 3 Refactor Tests Passed: State Machine & Fan-Out is Stable ===');

  } catch (error) {
    console.error('\nTest failed with unhandled exception:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (location) {
        await prisma.contentPiece.deleteMany({ where: { locationId: location.id } });
        await prisma.location.deleteMany({ where: { organizationId: organization.id } });
        await prisma.business.deleteMany({ where: { organizationId: organization.id } });
        
        // Clean up platform credentials which point to Organization
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

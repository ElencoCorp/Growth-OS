const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const radarTrackerService = require('../src/services/radar-tracker.service');

async function runTests() {
  console.log('=== Testing Milestone 13: Competitor Intelligence Radar ===');
  
  let organization;
  let location;

  try {
    console.log('\n1. Seeding Mock Radar Entities...');
    organization = await prisma.organization.create({
        data: {
            name: 'Test Org M13',
            planType: 'PRO',
            subscriptionActive: true
        }
    });

    const business = await prisma.business.create({
        data: { name: 'Test Business M13', organizationId: organization.id }
    });

    location = await prisma.location.create({
        data: {
            name: 'Test Location M13',
            businessId: business.id,
            organizationId: organization.id
        }
    });

    console.log(`✓ Seeded Location (ID: ${location.id})`);

    console.log('\n2. Testing Radar Keyword Addition...');
    const keyword = await radarTrackerService.addKeyword('Local Dentist', location.id, organization.id);
    console.log(`✓ Added keyword "${keyword.keywordText}" (ID: ${keyword.id})`);

    console.log('\n3. Testing SERP Parsing and AI Insight Synthesis...');
    const result = await radarTrackerService.trackKeywordPlacement(keyword.id);

    if (result.error) {
        throw new Error('Tracking failed: ' + result.message);
    }

    console.log(`✓ Successfully simulated SERP array and extracted competitive rank!`);
    console.log(`   - Client Position: Rank ${result.history.rankPlacement}`);
    console.log(`   - Competitor Footprint Captured: ${JSON.parse(result.history.competitorMap).length} competitors`);
    console.log(`\n🤖 Groq AI Strategy Insights:\n${result.insights}`);

    console.log('\n4. Validating Keyword List History Aggregation...');
    const list = await radarTrackerService.listKeywords(location.id);
    if (list.length !== 1 || list[0].rankHistories.length !== 1) {
        throw new Error('Keyword history aggregation failed.');
    }
    console.log(`✓ Keyword list correctly joins latest rank: ${list[0].rankHistories[0].rankPlacement}`);

    console.log('\n=== Milestone 13 Tests Passed ===');

  } catch (error) {
    console.error('\nTest failed with unhandled exception:', error);
    process.exit(1);
  } finally {
    if (organization) {
        await prisma.radarHistory.deleteMany({ where: { keyword: { locationId: location.id } } });
        await prisma.radarKeyword.deleteMany({ where: { locationId: location.id } });
        await prisma.location.deleteMany({ where: { organizationId: organization.id } });
        await prisma.business.deleteMany({ where: { organizationId: organization.id } });
        await prisma.organization.deleteMany({ where: { id: organization.id } });
    }
    await prisma.$disconnect();
  }
}

runTests();

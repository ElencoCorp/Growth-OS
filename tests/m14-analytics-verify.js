const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const analyticsEngine = require('../src/services/analytics-engine.service');

async function runTests() {
  console.log('=== Testing Milestone 14: Multi-Tenant Analytics Engine ===');
  
  let organization;

  try {
    console.log('\n1. Seeding Analytics Mock Entities...');
    organization = await prisma.organization.create({
        data: { name: 'Analytics Org M14', planType: 'PRO', subscriptionActive: true }
    });

    const business = await prisma.business.create({
        data: { name: 'Analytics Business M14', organizationId: organization.id }
    });

    const location1 = await prisma.location.create({
        data: { name: 'Location Alpha', businessId: business.id, organizationId: organization.id }
    });

    const location2 = await prisma.location.create({
        data: { name: 'Location Beta', businessId: business.id, organizationId: organization.id }
    });

    console.log(`✓ Seeded Locations Alpha (${location1.id}) and Beta (${location2.id})`);

    // Seed Reviews
    await prisma.review.create({
        data: { locationId: location1.id, googleReviewId: 'test1', authorName: 'John', rating: 5, text: 'Great', reply: 'Thanks' }
    });
    await prisma.review.create({
        data: { locationId: location1.id, googleReviewId: 'test2', authorName: 'Jane', rating: 3, text: 'Ok', reply: null }
    });

    // Seed Radar Keyword and History
    const keyword = await prisma.radarKeyword.create({
        data: { keywordText: 'Clinic', locationId: location2.id, organizationId: organization.id }
    });
    await prisma.radarHistory.create({
        data: { keywordId: keyword.id, rankPlacement: 4, competitorMap: '[]' }
    });

    console.log('\n2. Testing compileOrganizationOverview()...');
    const overview = await analyticsEngine.compileOrganizationOverview(organization.id);
    
    if (overview.totalLocations !== 2) throw new Error('Expected 2 locations');
    if (overview.totalReviews !== 2) throw new Error('Expected 2 total reviews');
    if (overview.averageRating !== 4.0) throw new Error(`Expected avg 4.0 rating, got ${overview.averageRating}`);
    if (overview.averageMapPackPosition !== 4.0) throw new Error('Expected avg map pack 4.0');
    if (overview.responseRate !== 50) throw new Error('Expected 50% response rate');
    
    console.log('✓ Successfully aggregated network metrics across locations!');
    console.log(`   - Total Reviews: ${overview.totalReviews}`);
    console.log(`   - Network Avg Rating: ${overview.averageRating}`);
    console.log(`   - Network Avg Rank: ${overview.averageMapPackPosition}`);
    console.log(`   - Response Rate: ${overview.responseRate}%`);
    console.log(`   - Health Score: ${overview.healthScore}`);

    console.log('\n3. Testing generateExecutiveReport() with AI Integration...');
    const report = await analyticsEngine.generateExecutiveReport(location1.id, 'Last 30 Days');
    
    const parsedData = JSON.parse(report.reportData);
    if (parsedData.totalReviews !== 2) throw new Error('Expected 2 total reviews for location Alpha');
    
    console.log('✓ Report Snapshot Successfully Captured:');
    console.log(`   - Status: ${report.status}`);
    console.log(`   - Cached AI Summary: \n${parsedData.executiveSummary}`);

    console.log('\n=== Milestone 14 Tests Passed ===');

  } catch (error) {
    console.error('\nTest failed with exception:', error);
    process.exit(1);
  } finally {
    if (organization) {
        await prisma.reportSnapshot.deleteMany({ where: { organizationId: organization.id } });
        await prisma.radarHistory.deleteMany({ where: { keyword: { organizationId: organization.id } } });
        await prisma.radarKeyword.deleteMany({ where: { organizationId: organization.id } });
        await prisma.review.deleteMany({ where: { location: { organizationId: organization.id } } });
        await prisma.location.deleteMany({ where: { organizationId: organization.id } });
        await prisma.business.deleteMany({ where: { organizationId: organization.id } });
        await prisma.organization.deleteMany({ where: { id: organization.id } });
    }
    await prisma.$disconnect();
  }
}

runTests();

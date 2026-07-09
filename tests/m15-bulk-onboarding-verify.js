const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bulkImporter = require('../src/services/bulk-importer.service');

async function runTests() {
  console.log('=== Testing Milestone 15: Bulk Account Location Onboarding Gateway ===');
  
  let organization;

  try {
    console.log('\n1. Seeding Bulk Onboarding Mock Entities...');
    organization = await prisma.organization.create({
        data: { name: 'Bulk Org M15', planType: 'PRO', subscriptionActive: true }
    });

    const business = await prisma.business.create({
        data: { name: 'Bulk Business M15', organizationId: organization.id }
    });

    console.log(`✓ Seeded Organization (ID: ${organization.id}) and Business (ID: ${business.id})`);

    console.log('\n2. Testing getOrganizationCapacity()...');
    const capacity = await bulkImporter.getOrganizationCapacity(organization.id);
    
    if (capacity.maxCapacity !== 50) throw new Error('PRO plan should have 50 limit');
    if (capacity.currentCount !== 0) throw new Error('Expected 0 current locations');
    if (capacity.availableSlots !== 50) throw new Error('Expected 50 available slots');
    
    console.log('✓ Successfully retrieved capacity block limits!');
    console.log(`   - Max Limit: ${capacity.maxCapacity}`);
    console.log(`   - Available Slots: ${capacity.availableSlots}`);

    console.log('\n3. Testing executeBulkImport() with Messy Header Data Translation...');
    
    // Simulate messy headers without explicit 'name', 'address', 'phone'
    const messyLocations = [
        { 'Clinic_Name': 'Alpha Health', 'Street_Address': '123 Main St', 'Contact_Num': '555-1001' },
        { 'Clinic_Name': 'Beta Wellness', 'Street_Address': '456 East Ave', 'Contact_Num': '555-2002' },
        { 'Clinic_Name': 'Gamma Care', 'Street_Address': '789 West Blvd', 'Contact_Num': '555-3003' }
    ];

    // Note: since AI mapping requires an API key, our fallback or AI should map these.
    // For test stability, we'll explicitly pass mappedKeys that AI would resolve, 
    // or rely on fallback. If fallback fails, it maps by index.
    const mappedKeys = { name: 'Clinic_Name', address: 'Street_Address', phone: 'Contact_Num' };

    const result = await bulkImporter.executeBulkImport(organization.id, business.id, messyLocations, mappedKeys);
    
    if (result.totalProcessed !== 3) throw new Error(`Expected 3 processed, got ${result.totalProcessed}`);
    if (result.successful !== 3) throw new Error(`Expected 3 successful, got ${result.successful}`);
    
    console.log('✓ Bulk Import Processed Successfully!');
    console.log(`   - Batch ID Assigned: ${result.batchId}`);
    console.log(`   - Successfully Ingested: ${result.successful}`);
    console.log(`   - Skipped Errors: ${result.failed}`);

    console.log('\n4. Validating SQLite Database Persistence...');
    const locations = await prisma.location.findMany({
        where: { organizationId: organization.id }
    });

    if (locations.length !== 3) throw new Error('Expected 3 locations created in DB');
    
    let verifiedCount = 0;
    locations.forEach(loc => {
        if (loc.googleVerificationStatus === 'UNVERIFIED') verifiedCount++;
    });

    if (verifiedCount !== 3) throw new Error('Expected UNVERIFIED status constraint mapping');

    console.log('✓ SQLite locations verified correctly under structural limits.');

    console.log('\n5. Testing License Breaching Protection Limit...');
    try {
        const hugeArray = new Array(60).fill({ name: 'Overflow', address: '123 Test', phone: '000' });
        await bulkImporter.executeBulkImport(organization.id, business.id, hugeArray);
        throw new Error('Should have thrown capacity exception');
    } catch (e) {
        if (e.message.includes('Operational capacity exception')) {
            console.log('✓ Active limit overflow caught properly. (403 Forbidden Simulation)');
        } else {
            throw e;
        }
    }

    console.log('\n=== Milestone 15 Tests Passed ===');

  } catch (error) {
    console.error('\nTest failed with exception:', error);
    process.exit(1);
  } finally {
    if (organization) {
        await prisma.location.deleteMany({ where: { organizationId: organization.id } });
        await prisma.business.deleteMany({ where: { organizationId: organization.id } });
        await prisma.organization.deleteMany({ where: { id: organization.id } });
    }
    await prisma.$disconnect();
  }
}

runTests();

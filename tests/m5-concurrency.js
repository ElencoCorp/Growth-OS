// Using native fetch in node > 18


async function runConcurrencyTest() {
  console.log('--- Starting Multi-Tenant Concurrency Simulation ---');
  
  // We'll simulate 5 locations
  const locations = [1, 2, 3, 4, 5];
  
  // First, verify these locations exist or mock them.
  // Actually, we'll just query the actual local server.
  
  // Fetch existing reviews to reply to, or mock reviews directly by calling the API
  
  const tasks = [];
  const TOTAL_REVIEWS_PER_TENANT = 4; // 5 tenants * 4 = 20 reviews total

  let reviewCounter = 1000; // Fake review IDs or real ones.
  // Since we need to test auto-reply, we need to create reviews first or hit a mock endpoint.
  // Wait, the auto-reply endpoint takes `reviewId`. We can create fake reviews in DB first.
  
  console.log('Setting up fake reviews in DB...');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  const createdReviews = [];
  
  try {
    // Create an organization and business first for test data
    let testOrg = await prisma.organization.findFirst();
    if (!testOrg) {
        testOrg = await prisma.organization.create({ data: { name: 'Test Org' } });
    }
    let testBusiness = await prisma.business.findFirst({ where: { organizationId: testOrg.id } });
    if (!testBusiness) {
        testBusiness = await prisma.business.create({ data: { name: 'Test Business', organizationId: testOrg.id } });
    }

    for (const locId of locations) {
      // Ensure location exists (mocking if not)
      let loc = await prisma.location.findUnique({ where: { id: locId } });
      if (!loc) {
          loc = await prisma.location.create({
              data: {
                  id: locId,
                  name: `Test Business ${locId}`,
                  businessId: testBusiness.id,
                  categories: JSON.stringify([locId % 2 === 0 ? 'Dental Clinic' : 'Retail Shop'])
              }
          });
      }

      for (let i = 0; i < TOTAL_REVIEWS_PER_TENANT; i++) {
        const review = await prisma.review.create({
          data: {
            authorName: `Customer ${locId}-${i}`,
            rating: 5,
            text: `Great experience at this ${locId % 2 === 0 ? 'Dental Clinic' : 'Retail Shop'}! Highly recommend.`,
            locationId: locId
          }
        });
        createdReviews.push(review);
      }
    }
    
    console.log(`Created ${createdReviews.length} reviews. Starting concurrent AI processing...`);
    
    // Fire all requests concurrently
    const startTime = Date.now();
    const promises = createdReviews.map(async (review) => {
        try {
            const res = await fetch('http://127.0.0.1:3000/api/v1/reviews/auto-reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reviewId: review.id })
            });
            const data = await res.json();
            return { review, data, success: res.ok };
        } catch (e) {
            return { review, error: e.message, success: false };
        }
    });
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    console.log(`Finished processing in ${endTime - startTime}ms.`);
    
    let successCount = 0;
    let dataLeakCount = 0;

    for (const res of results) {
        if (res.success && res.data && res.data.draft) {
            successCount++;
            const draft = res.data.draft.toLowerCase();
            const businessType = res.review.locationId % 2 === 0 ? 'dental' : 'retail';
            const wrongType = res.review.locationId % 2 === 0 ? 'retail' : 'dental';
            
            // Check for data leakage
            if (draft.includes(wrongType)) {
                dataLeakCount++;
                console.error(`DATA LEAK DETECTED! Tenant ${res.review.locationId} got response for ${wrongType}: ${draft}`);
            }
        } else {
            console.error(`Failed request for review ${res.review.id}:`, res.error || res.data);
        }
    }
    
    console.log(`\n--- Test Results ---`);
    console.log(`Total Requests: ${createdReviews.length}`);
    console.log(`Successful Replies: ${successCount}`);
    console.log(`Cross-Tenant Leaks: ${dataLeakCount}`);
    
    if (dataLeakCount === 0 && successCount === createdReviews.length) {
        console.log(`\n✅ Concurrency and Isolation Test PASSED.`);
    } else {
        console.error(`\n❌ Concurrency Test FAILED.`);
    }
    
  } catch (error) {
    console.error('Test script error:', error);
  } finally {
    // Cleanup
    await prisma.review.deleteMany({
        where: {
            id: { in: createdReviews.map(r => r.id) }
        }
    });
    await prisma.$disconnect();
  }
}

runConcurrencyTest();

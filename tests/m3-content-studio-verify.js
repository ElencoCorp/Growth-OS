const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateLocalPost, publishLocalPost } = require('../src/services/content-studio.service');

async function runTests() {
  console.log('=== Testing Module 3: Content Studio ===');
  
  // Save original env vars
  const originalGroqKey = process.env.TEXT_API_KEY;
  const originalUnsplashKey = process.env.UNSPLASH_API_KEY;

  try {
    console.log('\n1. Setting up test data...');
    
    // Create Org & Location
    const org = await prisma.organization.create({
        data: {
            name: 'Studio Test Org',
            ownerId: 'studio_user',
            members: { create: { userId: 'studio_user', role: 'ADMIN' } },
            businesses: { create: { name: 'Studio Test Business' } }
        },
        include: { businesses: true }
    });
    
    const loc = await prisma.location.create({
        data: {
            name: 'Studio Test Location',
            categories: JSON.stringify(['Test Category']),
            organizationId: org.id,
            businessId: org.businesses[0].id
        }
    });

    console.log(`Created Test Location (ID: ${loc.id})`);

    // 2. Test Fallback Behavior (Simulating API Failures/Timeouts)
    console.log('\n2. Testing Generation Fallback Behavior (Missing API Keys)...');
    
    // Nullify keys to trigger exceptions in internal HTTP requests
    process.env.TEXT_API_KEY = '';
    process.env.UNSPLASH_API_KEY = '';

    console.log('Generating LocalPost without API keys...');
    
    const draftPost = await generateLocalPost(loc.id, 'Summer Promotion');
    
    if (!draftPost) {
        throw new Error('generateLocalPost returned null/undefined');
    }

    console.log(`Successfully generated draft post (ID: ${draftPost.id})`);
    
    // Validate Fallback Text Content
    if (!draftPost.textContent.includes('Check out our latest offerings at')) {
        throw new Error('Groq fallback failed. Expected default copy was not used.');
    }
    console.log('✓ Groq fallback validated successfully');

    // Validate Fallback Image URL with crop parameters
    const expectedImage = 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&h=600&fit=crop';
    if (draftPost.imageUrl !== expectedImage) {
        throw new Error(`Unsplash fallback failed. Expected ${expectedImage} but got ${draftPost.imageUrl}`);
    }
    console.log('✓ Unsplash fallback & 4:3 strict aspect ratio validated successfully');

    // 3. Test Publishing
    console.log('\n3. Testing Post Publishing...');
    
    const publishedPost = await publishLocalPost(draftPost.id);
    
    if (publishedPost.status !== 'PUBLISHED') {
        throw new Error(`Expected status to be PUBLISHED, got ${publishedPost.status}`);
    }
    if (!publishedPost.publishedAt) {
        throw new Error('publishedAt was not set');
    }
    
    console.log('✓ Post successfully transitioned to PUBLISHED state');
    
    console.log('\n=== Module 3 Tests Passed: Resilient Service Infrastructure ===');

  } catch (error) {
    console.error('\nTest failed with unhandled exception:', error);
    process.exit(1);
  } finally {
    // Restore original keys
    process.env.TEXT_API_KEY = originalGroqKey;
    process.env.UNSPLASH_API_KEY = originalUnsplashKey;
    await prisma.$disconnect();
  }
}

runTests();

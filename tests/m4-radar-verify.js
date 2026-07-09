const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { trackKeyword, addKeyword, getKeywords } = require('../src/services/radar-tracker.service');

async function runTests() {
  console.log('=== Testing Module 4: Competitor Intelligence Radar ===');
  
  const originalGroqKey = process.env.TEXT_API_KEY;
  const originalSimulateTimeout = process.env.SIMULATE_SCRAPER_TIMEOUT;

  try {
    console.log('\n1. Setting up Test Database Structure...');
    
    const locId = `loc_${Date.now()}`;
    const orgId = `org_${Date.now()}`;
    const keywordText = 'Dentist in Ravet';

    const keyword = await addKeyword(locId, orgId, keywordText);
    console.log(`Created Target Keyword (ID: ${keyword.id})`);

    console.log('\n2. Testing Standard Scraping Run...');
    process.env.SIMULATE_SCRAPER_TIMEOUT = 'false';
    const trackResult = await trackKeyword(keyword.id);

    if (!trackResult.success) {
        throw new Error('Standard scraping run failed unexpectedly.');
    }
    
    if (trackResult.history.rankPlacement < 1 || trackResult.history.rankPlacement > 15) {
        throw new Error('Invalid rank placement generated.');
    }

    if (!trackResult.insights || trackResult.insights.length !== 3) {
        throw new Error('Groq AI failed to synthesize exactly 3 insights.');
    }
    console.log(`✓ Successful Scan (Rank: ${trackResult.history.rankPlacement})`);
    console.log(`✓ AI Insights Generated:`, trackResult.insights);

    console.log('\n3. Testing Service Cache Read (GET /keywords behavior)...');
    const keywordsList = await getKeywords(locId);
    if (keywordsList.length === 0 || keywordsList[0].currentRank !== trackResult.history.rankPlacement) {
        throw new Error('Service read failed to return the updated placement.');
    }
    console.log(`✓ Keywords accurately joined with latest node historical states.`);

    console.log('\n4. Testing Mock Scraper Timeout (Fallback Mechanisms)...');
    process.env.SIMULATE_SCRAPER_TIMEOUT = 'true';
    
    // Kill Groq API to ensure we don't hang or crash on AI parsing fallback either
    process.env.TEXT_API_KEY = ''; 

    const timeoutResult = await trackKeyword(keyword.id);
    
    if (timeoutResult.success !== false || timeoutResult.fallback !== true) {
        throw new Error('Service did not safely intercept and fallback on timeout.');
    }

    if (timeoutResult.history.id !== trackResult.history.id) {
        throw new Error('Service did not correctly pull the latest historical node from DB cache.');
    }

    console.log('✓ Timeout Safely Caught. Database Cache Displayed.');
    console.log('✓ Fallback UI Message Generated:', timeoutResult.message);
    console.log('✓ Fallback AI Insights Used:', timeoutResult.insights);

    console.log('\n=== Module 4 Tests Passed: Decoupled Rank Cache is Stable ===');

  } catch (error) {
    console.error('\nTest failed with unhandled exception:', error);
    process.exit(1);
  } finally {
    process.env.TEXT_API_KEY = originalGroqKey;
    process.env.SIMULATE_SCRAPER_TIMEOUT = originalSimulateTimeout;
    await prisma.$disconnect();
  }
}

runTests();

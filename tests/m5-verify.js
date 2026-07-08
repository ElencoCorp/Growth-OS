const fetch = globalThis.fetch;

async function runTests() {
    console.log('=== Testing Milestone 5: SEO Radar ===');
    const locationId = 1; 

    try {
        // 1. Add Keyword
        console.log(`\n1. Testing POST /api/v1/seo/keywords`);
        const kwRes = await fetch(`http://127.0.0.1:3000/api/v1/seo/keywords`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locationId, term: 'dentist near me' })
        });
        
        console.log(`Add Keyword Status: ${kwRes.status}`);
        if (!kwRes.ok) throw new Error('Failed to add keyword');
        const kwData = await kwRes.json();
        console.log(`Added keyword ID: ${kwData.keyword.id}`);

        // 2. Trigger Sync
        console.log(`\n2. Testing POST /api/v1/sync/rankings/${locationId}`);
        const syncRes = await fetch(`http://127.0.0.1:3000/api/v1/sync/rankings/${locationId}`, {
            method: 'POST'
        });
        
        console.log(`Sync Status: ${syncRes.status}`);
        if (syncRes.status !== 202) throw new Error('Sync failed to return 202');

        console.log('Waiting 3 seconds for background job to complete...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 3. Fetch Competitors
        console.log(`\n3. Testing GET /api/v1/seo/competitors/${locationId}`);
        const getRes = await fetch(`http://127.0.0.1:3000/api/v1/seo/competitors/${locationId}`);
        
        console.log(`Get Competitors Status: ${getRes.status}`);
        const getData = await getRes.json();
        
        if (getRes.status !== 200 || !getData.success) throw new Error('Get Competitors failed');
        
        console.log(`Tracked Keywords Count: ${getData.trackedKeywords.length}`);
        
        const trackedKw = getData.trackedKeywords.find(k => k.term === 'dentist near me');
        if (!trackedKw) throw new Error('Keyword not found in payload');
        if (!trackedKw.rank) throw new Error('Rank not populated');
        if (!trackedKw.topCompetitors) throw new Error('Top competitors not populated');

        console.log(`- Term: ${trackedKw.term}`);
        console.log(`- Rank: ${trackedKw.rank}`);
        console.log(`- Top Competitors: ${trackedKw.topCompetitors}`);

        console.log('\n=== Milestone 5 Tests Passed ===');
        
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

runTests();

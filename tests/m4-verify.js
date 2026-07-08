const fetch = globalThis.fetch;

async function runTests() {
    console.log('=== Testing Milestone 4 ===');
    const locationId = 1; // Assuming location 1 exists

    try {
        // 1. Trigger Sync
        console.log(`\n1. Testing POST /api/v1/sync/insights/${locationId}`);
        const syncRes = await fetch(`http://127.0.0.1:3000/api/v1/sync/insights/${locationId}`, {
            method: 'POST'
        });
        
        console.log(`Sync Response Status: ${syncRes.status}`);
        const syncData = await syncRes.json();
        console.log(`Sync Data:`, syncData);
        
        if (syncRes.status !== 202) {
            throw new Error('Sync failed to return 202');
        }

        console.log('Waiting 3 seconds for background job to complete...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 2. Fetch Analytics
        console.log(`\n2. Testing GET /api/v1/analytics/${locationId}`);
        const getRes = await fetch(`http://127.0.0.1:3000/api/v1/analytics/${locationId}`);
        
        console.log(`Get Analytics Response Status: ${getRes.status}`);
        const getData = await getRes.json();
        console.log(`Get Analytics Data:`);
        console.log(`- Success: ${getData.success}`);
        console.log(`- Health Score: ${getData.healthScore}`);
        console.log(`- Snapshots count: ${getData.snapshots.length}`);
        console.log(`- Exec Summary: ${getData.executiveSummary}`);
        
        if (getRes.status !== 200 || !getData.success || getData.snapshots.length === 0) {
            throw new Error('Get Analytics failed or returned no snapshots');
        }

        console.log('\n=== Milestone 4 Tests Passed ===');
        
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

runTests();

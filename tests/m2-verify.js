async function run() {
    console.log("-> Hitting POST /api/v1/reviews/1/generate...");
    const genRes = await fetch('http://127.0.0.1:3000/api/v1/reviews/1/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
    });

    console.log("HTTP Status:", genRes.status);
    const body = await genRes.text();
    try {
        console.log("Response Body:", JSON.stringify(JSON.parse(body), null, 2));
    } catch(e) {
        console.log("Response Body (Raw):", body);
    }
}

run().catch(console.error);

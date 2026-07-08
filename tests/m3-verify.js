

async function runTests() {
    try {
        console.log("=== Testing Milestone 3 ===");

        // 1. Test Generate Post
        console.log("1. Testing /api/v1/locations/1/posts/generate");
        const generateResponse = await fetch('http://127.0.0.1:3000/api/v1/locations/1/posts/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goalText: 'Promote our new dental whitening service.' })
        });

        const generateData = await generateResponse.json();
        console.log("Generate Response Status:", generateResponse.status);
        console.log("Generate Data:", generateData);

        if (!generateData.success || !generateData.post.id) {
            throw new Error("Generation failed.");
        }

        const postId = generateData.post.id;
        console.log(`Generated Post ID: ${postId}`);

        // 2. Test Publish Post
        console.log(`2. Testing /api/v1/posts/${postId}/publish`);
        const publishResponse = await fetch(`http://127.0.0.1:3000/api/v1/posts/${postId}/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ textContent: generateData.post.textContent + ' (Edited before publish)' })
        });

        const publishData = await publishResponse.json();
        console.log("Publish Response Status:", publishResponse.status);
        console.log("Publish Data:", publishData);

        if (!publishData.success || publishData.post.status !== 'PUBLISHED') {
            throw new Error("Publishing failed.");
        }

        console.log("=== Milestone 3 Tests Passed ===");
    } catch (e) {
        console.error("Test failed:", e);
    }
}

runTests();

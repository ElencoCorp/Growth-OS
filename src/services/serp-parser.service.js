/**
 * SERP PARSING INFRASTRUCTURE
 * Simulates a local map search query to return competitive rank metrics.
 */

function simulateLocalSERP(keywordText, targetLocationName) {
    console.log(`[SERP Parser] Simulating map scraper for keyword: "${keywordText}" around "${targetLocationName}"`);

    // We simulate the client's rank floating randomly between 1 and 7
    const clientRank = Math.floor(Math.random() * 7) + 1;

    // Generate 5 competitive profiles
    const competitors = [
        { name: `${targetLocationName} Premium Care`, rating: 4.8, reviews: 142 },
        { name: `The Local ${targetLocationName} Hub`, rating: 4.6, reviews: 89 },
        { name: `${targetLocationName} Family Services`, rating: 4.9, reviews: 312 },
        { name: `Citywide ${targetLocationName} Pros`, rating: 4.3, reviews: 45 },
        { name: `Advanced ${targetLocationName} Solutions`, rating: 4.7, reviews: 204 }
    ];

    // Shuffle competitors to simulate dynamic map-pack shifts
    for (let i = competitors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [competitors[i], competitors[j]] = [competitors[j], competitors[i]];
    }

    // Map array into a structured position set
    const mapPack = competitors.map((comp, index) => ({
        position: index + 1, // Ignore client rank for this specific struct; we track it separately below
        name: comp.name,
        rating: comp.rating,
        reviews: comp.reviews
    }));

    return {
        clientRank,
        competitors: mapPack
    };
}

module.exports = {
    simulateLocalSERP
};

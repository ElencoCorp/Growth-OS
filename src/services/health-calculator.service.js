const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Calculates the dynamic Visibility Health Score for a given location.
 * @param {number} locationId 
 * @returns {Promise<{score: number, breakdown: Array}>}
 */
async function calculateHealthScore(locationId) {
    if (!locationId) return { score: 0, breakdown: [] };

    // Fetch necessary data
    const location = await prisma.location.findUnique({
        where: { id: locationId }
    });

    const reviews = await prisma.review.findMany({
        where: { locationId }
    });

    // 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPosts = await prisma.contentPiece.count({
        where: {
            locationId,
            status: 'PUBLISHED',
            scheduledFor: { gte: thirtyDaysAgo }
        }
    });

    const keywordRankings = await prisma.radarKeyword.findMany({
        where: { locationId },
        include: { rankHistories: { orderBy: { capturedAt: 'desc' }, take: 1 } }
    });

    let breakdown = [];
    let totalScore = 0;

    // 1. Rating (Weight: 20 points)
    let avgRating = 0;
    if (reviews.length > 0) {
        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        avgRating = totalRating / reviews.length;
    }
    let ratingScore = 0;
    let ratingStatus = 'Needs Focus';
    if (avgRating >= 4.5) { ratingScore = 20; ratingStatus = 'Optimal'; }
    else if (avgRating >= 4.0) { ratingScore = 15; ratingStatus = 'Stable'; }
    else if (avgRating > 0) { ratingScore = 5; }

    breakdown.push({
        name: 'Rating',
        value: avgRating.toFixed(1) + ' Stars',
        score: ratingScore,
        maxScore: 20,
        status: ratingStatus
    });
    totalScore += ratingScore;

    // 2. Reviews Volume (Weight: 20 points)
    let reviewsVolume = reviews.length;
    let reviewScore = 0;
    let reviewStatus = 'Needs Focus';
    if (reviewsVolume >= 50) { reviewScore = 20; reviewStatus = 'Optimal'; }
    else if (reviewsVolume >= 10) { reviewScore = 15; reviewStatus = 'Stable'; }
    else if (reviewsVolume > 0) { reviewScore = 5; }

    breakdown.push({
        name: 'Reviews',
        value: reviewsVolume.toString(),
        score: reviewScore,
        maxScore: 20,
        status: reviewStatus
    });
    totalScore += reviewScore;

    // 3. Posts Frequency (Weight: 15 points)
    let postsScore = 0;
    let postsStatus = 'Needs Focus';
    if (recentPosts >= 4) { postsScore = 15; postsStatus = 'Optimal'; }
    else if (recentPosts >= 1) { postsScore = 10; postsStatus = 'Stable'; }

    breakdown.push({
        name: 'Posts',
        value: `${recentPosts} (Last 30d)`,
        score: postsScore,
        maxScore: 15,
        status: postsStatus
    });
    totalScore += postsScore;

    // 4. Photos Upload Velocity (Weight: 10 points)
    // No native DB table for photos yet. Using mock weight based on profile completion proxy.
    let photosScore = 0;
    let photosStatus = 'Needs Focus';
    if (location && location.googlePlaceId) {
        photosScore = 10; // Assume good if PlaceId exists (connected)
        photosStatus = 'Optimal';
    }

    breakdown.push({
        name: 'Photos',
        value: location && location.googlePlaceId ? 'Active' : 'Missing',
        score: photosScore,
        maxScore: 10,
        status: photosStatus
    });
    totalScore += photosScore;

    // 5. Keywords (Weight: 10 points)
    let keywordsCount = keywordRankings.length;
    let keywordScore = 0;
    let keywordStatus = 'Needs Focus';
    if (keywordsCount >= 5) { keywordScore = 10; keywordStatus = 'Optimal'; }
    else if (keywordsCount >= 1) { keywordScore = 5; keywordStatus = 'Stable'; }

    breakdown.push({
        name: 'Keywords',
        value: keywordsCount.toString() + ' tracked',
        score: keywordScore,
        maxScore: 10,
        status: keywordStatus
    });
    totalScore += keywordScore;

    // 6. Q&A (Weight: 10 points)
    // No native DB table for QA. Using mock for now.
    let qaScore = 10;
    let qaStatus = 'Optimal';
    breakdown.push({
        name: 'Q&A',
        value: '3 Answered',
        score: qaScore,
        maxScore: 10,
        status: qaStatus
    });
    totalScore += qaScore;

    // 7. Rankings (Weight: 15 points)
    let top10Count = 0;
    keywordRankings.forEach(kw => {
        if (kw.rankHistories && kw.rankHistories.length > 0) {
            if (kw.rankHistories[0].rank <= 10 && kw.rankHistories[0].rank > 0) top10Count++;
        }
    });

    let rankScore = 0;
    let rankStatus = 'Needs Focus';
    if (top10Count >= 3) { rankScore = 15; rankStatus = 'Optimal'; }
    else if (top10Count >= 1) { rankScore = 10; rankStatus = 'Stable'; }

    breakdown.push({
        name: 'Rankings',
        value: top10Count.toString() + ' in Top 10',
        score: rankScore,
        maxScore: 15,
        status: rankStatus
    });
    totalScore += rankScore;

    return {
        score: totalScore,
        breakdown: breakdown
    };
}

module.exports = {
    calculateHealthScore
};

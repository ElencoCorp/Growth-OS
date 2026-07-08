/**
 * Calculates a 0-100 health score based on recent reviews and metrics.
 * Pure function: No DB calls, just logic.
 * 
 * @param {Array} recentReviews - Array of recent review objects.
 * @param {Array} metricSnapshots - Array of MetricSnapshot objects, sorted latest first.
 * @returns {number} Integer between 0 and 100.
 */
function calculateHealthScore(recentReviews, metricSnapshots) {
    let score = 50; // Base score

    // 1. Review Factor (up to +30, down to -20)
    if (recentReviews && recentReviews.length > 0) {
        const avgRating = recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length;
        if (avgRating >= 4.5) score += 30;
        else if (avgRating >= 4.0) score += 20;
        else if (avgRating >= 3.0) score += 5;
        else if (avgRating < 2.0) score -= 20;
    }

    // 2. Momentum Factor (up to +20, down to -10)
    if (metricSnapshots && metricSnapshots.length >= 2) {
        const latest = metricSnapshots[0];
        const previous = metricSnapshots[1];
        
        const viewsMomentum = latest.profileViews - previous.profileViews;
        if (viewsMomentum > 0) score += 10;
        else if (viewsMomentum < -10) score -= 5;

        const interactionsMomentum = latest.interactions - previous.interactions;
        if (interactionsMomentum > 0) score += 10;
        else if (interactionsMomentum < -5) score -= 5;
    } else if (metricSnapshots && metricSnapshots.length === 1) {
        // If only 1 snapshot, slight bonus for just having data
        score += 10;
    }

    // Clamp score between 0 and 100
    return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = {
    calculateHealthScore
};

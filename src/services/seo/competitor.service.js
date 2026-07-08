/**
 * Extracts the top competitors from SERP data.
 * 
 * @param {Object} serpData The structured SERP data returned from rank-tracker
 * @returns {string} Comma-separated string of the top 3 competitors (excluding own business)
 */
function extractTopCompetitors(serpData) {
    if (!serpData || !serpData.results) return '';

    // Filter out our own business
    const competitors = serpData.results.filter(r => !r.isOwnBusiness);
    
    // Take the top 3
    const top3 = competitors.slice(0, 3).map(c => c.name);
    
    return top3.join(', ');
}

module.exports = {
    extractTopCompetitors
};

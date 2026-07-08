/**
 * Simulates fetching local map-pack rankings for a keyword.
 * In a real application, this would call an API like DataForSEO or a custom SERP scraper.
 * 
 * @param {string} term The keyword term
 * @param {number} lat Latitude
 * @param {number} lng Longitude
 * @returns {Promise<Object>} Mock SERP data containing rank and competitors
 */
async function fetchKeywordRanking(term, lat, lng) {
    try {
        // Simulating a network call to a SERP API
        await new Promise(resolve => setTimeout(resolve, 800));

        // Generate a mock rank between 1 and 20
        const mockRank = Math.floor(Math.random() * 20) + 1;
        
        // Mock SERP results
        const mockSerpResults = [
            { name: 'Curo Dental Clinic', isOwnBusiness: true },
            { name: 'Bright Smile Dentistry', isOwnBusiness: false },
            { name: 'Downtown Dental Care', isOwnBusiness: false },
            { name: 'Apex Dental Partners', isOwnBusiness: false },
            { name: 'Family First Smiles', isOwnBusiness: false }
        ];

        // Ensure the own business is at the mockRank (1-indexed)
        const adjustedResults = mockSerpResults.filter(r => !r.isOwnBusiness);
        adjustedResults.splice(mockRank - 1, 0, { name: 'Curo Dental Clinic', isOwnBusiness: true });

        return {
            keyword: term,
            rank: mockRank,
            results: adjustedResults
        };
    } catch (error) {
        console.error(`[Rank Tracker Service] Failed to fetch ranking for ${term}`, error);
        throw error;
    }
}

module.exports = {
    fetchKeywordRanking
};

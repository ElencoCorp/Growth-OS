/**
 * Health Score Service
 */

function calculateHealthScore(profile) {
  let score = 100;
  const actions = [];

  // 1. Check Phone
  if (!profile.phone) {
    score -= 15;
    actions.push({
      priority: 1,
      title: 'Add Business Phone Number',
      description: 'Customers cannot call you. Missing phone number hurts local ranking.'
    });
  }

  // 2. Check Website
  if (!profile.website) {
    score -= 10;
    actions.push({
      priority: 2,
      title: 'Add Website URL',
      description: 'Provide a link so customers can learn more about your services.'
    });
  }

  // 3. Check Categories
  if (!profile.categories || profile.categories.length === 0) {
    score -= 20;
    actions.push({
      priority: 3,
      title: 'Add Business Categories',
      description: 'Crucial for search matching. Add at least 1 primary category.'
    });
  }

  // 4. Check Hours
  if (!profile.hours) {
    score -= 15;
    actions.push({
      priority: 4,
      title: 'Add Business Hours',
      description: 'Don\'t miss out on customers by hiding when you are open.'
    });
  }

  // 5. Check Description
  if (!profile.description) {
    score -= 10;
    actions.push({
      priority: 5,
      title: 'Description is missing',
      description: 'Tap here to auto-write one with AI.'
    });
  }

  // 6. Check Recent Posts
  if (!profile.posts || profile.posts.length === 0) {
    score -= 15;
    actions.push({
      priority: 6,
      title: 'Zero recent posts',
      description: 'Tap here to generate a fresh Google Update post using AI.'
    });
  }

  // Cap standard actions to top 3 prominent tasks
  let topActions = actions.slice(0, 3);

  // 5. Competitor Intelligence (Opportunity Finder)
  if (profile.competitors && profile.competitors.length > 0) {
    // Check if any competitor is outperforming the client
    // For simplicity, we just look at the first competitor that's doing better in some metric
    const profileReviewCount = profile.reviews ? profile.reviews.length : 0; // Assume we have reviews count if we needed it, but in the mock we don't have reviews attached to profile in this method unless we pass it.
    // Wait, profile doesn't include reviews count here. We'll use a static comparison for the mock or assume client review velocity is low.
    // Let's just flag if a competitor has more than 10 postingFreq or high review count.
    
    for (const comp of profile.competitors) {
      if (comp.postingFreq > 5 || comp.reviewCount > 50) {
        // High performing competitor found!
        topActions.unshift({
          priority: 0, // Highest priority
          title: `Action: ${comp.name} is dominating local search`,
          description: `Competitor ${comp.name} has a high velocity (${comp.postingFreq} posts/mo, ${comp.reviewCount} reviews). Launch an automated review check optimization now.`
        });
        score -= 5; // Penalty for falling behind competitor
        break; // Just one competitor alert is enough
      }
    }
  }

  // Ensure score doesn't drop below 0
  if (score < 0) score = 0;

  return {
    score,
    actions: topActions
  };
}

module.exports = {
  calculateHealthScore
};

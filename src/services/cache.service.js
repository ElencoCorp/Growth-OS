const { LRUCache } = require('lru-cache');

// Max 50 items to strictly limit memory usage (< 50MB typically)
const healthScoreCache = new LRUCache({
  max: 50,
  ttl: 1000 * 60 * 5, // 5 minute TTL
});

const reviewsCache = new LRUCache({
  max: 50,
  ttl: 1000 * 60 * 5, // 5 minute TTL
});

/**
 * Invalidates cache for a specific location
 * @param {number} locationId 
 */
function invalidateLocationCache(locationId) {
  healthScoreCache.delete(locationId);
  reviewsCache.delete(locationId);
}

module.exports = {
  healthScoreCache,
  reviewsCache,
  invalidateLocationCache
};

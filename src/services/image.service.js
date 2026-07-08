const UNSPLASH_API_URL = 'https://api.unsplash.com/search/photos';

/**
 * Generates an image using Unsplash API and returns the URL.
 * @param {string} keyword 
 * @returns {Promise<string>} The remote URL path of the image.
 */
async function acquireImage(keyword) {
  const apiKey = process.env.UNSPLASH_API_KEY;
  if (!apiKey) {
    console.warn('[Image Service Warning] UNSPLASH_API_KEY is missing or empty. Returning premium pre-baked placeholder.');
    return 'https://images.unsplash.com/photo-1556761175-5973dc0f32d7?auto=format&fit=crop&q=80&w=800';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const url = `${UNSPLASH_API_URL}?query=${encodeURIComponent(keyword)}&per_page=1&orientation=landscape`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Client-ID ${apiKey}`
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Unsplash HTTP error: ${response.status}`);
    }

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].urls.regular;
    }
    
    // Fallback if no images found
    throw new Error('No images found on Unsplash for keyword: ' + keyword);
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[Image Service Error] Failed to acquire image from Unsplash: ${error.message}. Returning fallback.`);
    return 'https://images.unsplash.com/photo-1556761175-5973dc0f32d7?auto=format&fit=crop&q=80&w=800';
  }
}

module.exports = {
  acquireImage
};

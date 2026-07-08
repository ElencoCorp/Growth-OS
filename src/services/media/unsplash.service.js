const fetch = globalThis.fetch;

async function fetchImage(keywords) {
    try {
        const apiKey = process.env.UNSPLASH_API_KEY;
        if (!apiKey) {
            console.warn('[Unsplash Service] UNSPLASH_API_KEY is missing. Returning fallback image.');
            return 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=500&q=80';
        }

        const query = encodeURIComponent(keywords);
        // orientation=landscape generally satisfies the 4:3 ratio required by GBP
        const response = await fetch(`https://api.unsplash.com/photos/random?query=${query}&orientation=landscape`, {
            headers: {
                'Authorization': `Client-ID ${apiKey}`
            }
        });

        if (!response.ok) {
            console.warn(`[Unsplash Service] API returned status ${response.status}. Returning fallback image.`);
            return 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=500&q=80';
        }

        const data = await response.json();
        return data.urls.regular || 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=500&q=80';
    } catch (error) {
        console.error('[Unsplash Service] Error fetching image:', error);
        return 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=500&q=80';
    }
}

module.exports = {
    fetchImage
};

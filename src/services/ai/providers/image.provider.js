const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

/**
 * Modular Provider-Agnostic Image Generation Matrix
 * Generates an image via external API, downloads the buffer, and writes natively to disk.
 */
async function generateImage(topic, options = {}) {
    const { provider = 'unsplash' } = options;
    const startTime = Date.now();
    let imageUrl = '';

    const query = topic ? topic.replace(/\s+/g, ',') : 'business';
    
    if (provider === 'unsplash') {
        const accessKey = process.env.UNSPLASH_ACCESS_KEY;
        if (!accessKey) {
            console.warn('[AI Service Warning] Missing UNSPLASH_ACCESS_KEY. Using dynamic Unsplash source fallback.');
            imageUrl = `https://source.unsplash.com/featured/800x600/?${encodeURIComponent(query)}`;
        } else {
            try {
                const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(topic)}&orientation=landscape`;
                const response = await fetch(url, {
                    headers: { 'Authorization': `Client-ID ${accessKey}` }
                });
                
                if (!response.ok) throw new Error(`Unsplash API error: ${response.status}`);
                const data = await response.json();
                imageUrl = `${data.urls.raw}&w=800&h=600&fit=crop`;
            } catch (error) {
                console.error('[AI Service Warning] Unsplash fault intercepted:', error.message);
                imageUrl = `https://source.unsplash.com/featured/800x600/?${encodeURIComponent(query)}`;
            }
        }
    } else {
        throw new Error(`Unsupported image provider: ${provider}`);
    }

    // Stage 2 & 3: Download and write file buffer natively
    try {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'generated');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileName = `asset-${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
        const filePath = path.join(uploadDir, fileName);

        const imgResponse = await fetch(imageUrl);
        if (!imgResponse.ok) throw new Error(`Failed to fetch image from ${imageUrl}`);
        
        await pipeline(imgResponse.body, fs.createWriteStream(filePath));
        
        const durationMs = Date.now() - startTime;
        return { 
            imagePath: `/uploads/generated/${fileName}`, 
            durationMs, 
            provider 
        };
    } catch (downloadError) {
        console.error('[Image Provider] Failed to download and save image:', downloadError);
        // Fallback if writing fails
        return { 
            imagePath: imageUrl, 
            durationMs: Date.now() - startTime, 
            provider 
        };
    }
}

module.exports = { generateImage };

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Generates an image using Pollinations AI free endpoint and saves it locally.
 * @param {string} prompt 
 * @returns {Promise<string>} The local URL path of the generated image.
 */
async function generateLocalImage(prompt) {
  try {
    // Pollinations AI uses a simple GET request with the prompt encoded in the URL
    // Adding random seed to avoid caching
    const seed = Math.floor(Math.random() * 1000000);
    const encodedPrompt = encodeURIComponent(`${prompt} - high quality professional business promotional banner`);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=800&height=800&nologo=true`;

    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to generate image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ensure directory exists
    const publicDir = path.join(process.cwd(), 'public');
    const generatedDir = path.join(publicDir, 'generated-images');
    
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }

    // Save image to local disk
    const fileName = `banner-${crypto.randomBytes(6).toString('hex')}.png`;
    const filePath = path.join(generatedDir, fileName);
    
    fs.writeFileSync(filePath, buffer);

    return `/public/generated-images/${fileName}`;
  } catch (error) {
    console.error('[Image Service Error] Failed to generate local image:', error);
    return null;
  }
}

module.exports = {
  generateLocalImage
};

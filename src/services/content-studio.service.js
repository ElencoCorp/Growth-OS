const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fetch = globalThis.fetch;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const AI_MODEL = 'llama3-8b-8192';

async function callGroqAPI(systemPrompt, userPrompt, temperature = 0.8) {
  const apiKey = process.env.TEXT_API_KEY;
  if (!apiKey) {
    throw new Error('TEXT_API_KEY is missing or empty.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: temperature
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Groq HTTP error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function generatePromotionalCopy(location, topic) {
  const businessName = location?.name || 'our local business';
  let categories = 'Local Business';
  if (location?.categories) {
    try {
      const cats = JSON.parse(location.categories);
      categories = cats.join(', ');
    } catch(e) {
      categories = location.categories;
    }
  }

  const systemPrompt = `You are an elite AI Marketing Assistant for a local business. Draft hyper-localized, highly engaging promotional copy.`;
  const prompt = `Business: ${businessName}\nCategory: ${categories}\nTopic: ${topic}\n\nWrite a 2-3 paragraph promotional post. Focus on local community engagement. Include 3 localized hashtags at the end.`;

  try {
    return await callGroqAPI(systemPrompt, prompt, 0.85);
  } catch (error) {
    console.warn('[Content Studio Service] Groq API call failed or key missing. Returning default fallback copy.', error.message);
    return `Check out our latest offerings at ${businessName}! We are proud to serve our local community with top-tier services. Drop by today to see what's new. #LocalBusiness #${businessName.replace(/\s+/g, '')} #CommunityFirst`;
  }
}

async function fetchUnsplashAsset(keywords) {
  try {
    const apiKey = process.env.UNSPLASH_API_KEY;
    if (!apiKey) {
      throw new Error('UNSPLASH_API_KEY missing');
    }

    const query = encodeURIComponent(keywords);
    // Fetch random photo matching the query
    const response = await fetch(`https://api.unsplash.com/photos/random?query=${query}`, {
      headers: {
        'Authorization': `Client-ID ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`);
    }

    const data = await response.json();
    // Append strict 4:3 cropping parameters directly to the raw unsplash asset URL
    const rawUrl = data.urls.raw;
    return `${rawUrl}&w=800&h=600&fit=crop`;
  } catch (error) {
    console.warn('[Content Studio Service] Unsplash fetch failed. Using fallback imagery rules.', error.message);
    // Graceful fallback to default category imagery rule with strict 4:3 ratio
    return 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&h=600&fit=crop';
  }
}

async function generateLocalPost(locationId, topic) {
  const location = await prisma.location.findUnique({
    where: { id: parseInt(locationId, 10) }
  });

  if (!location) {
    throw new Error('Location not found');
  }

  // Parallel generation of copy and asset
  const [textContent, imageUrl] = await Promise.all([
    generatePromotionalCopy(location, topic),
    fetchUnsplashAsset(topic || location.categories || 'business')
  ]);

  const post = await prisma.localPost.create({
    data: {
      locationId: location.id,
      textContent,
      imageUrl,
      status: 'DRAFT'
    }
  });

  return post;
}

async function publishLocalPost(postId) {
  const post = await prisma.localPost.update({
    where: { id: parseInt(postId, 10) },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date()
    }
  });
  return post;
}

module.exports = {
  generateLocalPost,
  publishLocalPost,
  generatePromotionalCopy,
  fetchUnsplashAsset
};

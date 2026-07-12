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

async function generateReviewReply(reviewText, location) {
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

  const systemPrompt = `You are the official AI Marketing Assistant for the business. Respond directly, professionally, and concisely as the business owner. Never include conversational meta-commentary, preambles, or explanations of what you can or cannot find. Output ONLY the final response.`;
  const prompt = `Business Name: ${businessName}\nCategory/Location: ${categories}\nCustomer Review: "${reviewText}"\n\nDraft a highly contextual and unique reply to this review (max 3 sentences). Address specific points mentioned by the customer. Append 2-3 localized hashtags at the end:`;

  try {
    return await callGroqAPI(systemPrompt, prompt, 0.8);
  } catch (error) {
    console.warn('[AI Service Warning] Groq API call failed or key missing. Returning pre-baked reply.', error.message);
    return `Thank you for your fantastic review! We are thrilled to hear you had a great experience with our local team. Hope to see you again soon!`;
  }
}

async function generateGooglePost(goalText, location) {
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

  let systemPrompt = `You are the official AI Marketing Assistant for the business. Respond directly, professionally, and concisely as the business owner. Never include conversational meta-commentary, preambles, or explanations of what you can or cannot find. Output ONLY the final response.`;
  
  let prompt = `Business Name: ${businessName}\nCategory/Location: ${categories}\nTopic/Promo Goal: ${goalText}\n\nWrite a highly creative, unique, and engaging Google Business post description of close to 1500 characters.\nCRITICAL PROHIBITION: Never start the post with generic phrases like 'Big news for the neighborhood' or 'We are thrilled to announce'. Craft a professional hook that changes dynamically based on the requested goal, and smoothly integrate localized hashtags at the bottom.\n\nDraft the optimized Google Post:`;

  let retryCount = 0;
  const MAX_RETRIES = 1;

  while (retryCount <= MAX_RETRIES) {
    try {
      let resultText = await callGroqAPI(systemPrompt, prompt, 0.85);
      
      const hashtagCount = (resultText.match(/#/g) || []).length;
      if (resultText.length < 500 || hashtagCount < 3) {
          console.warn(`[AI Validator] Post failed checks. Initiating self-healing loop...`);
          if (retryCount < MAX_RETRIES) {
              retryCount++;
              systemPrompt = `CRITICAL DIRECTIVE: Your previous response was either too short (under 500 chars) or missing hashtags. You MUST write a detailed Google Post exceeding 500 characters. You MUST explicitly include at least 5 hashtags at the very end. HARDCODED INSTRUCTION: Append exactly these fragments at the end: #LocalBusiness #CustomerAppreciation #ServiceUpdate #LocalExpert #${businessName.replace(/\s+/g, '')}`;
              continue;
          }
      }
      
      return resultText;
    } catch (error) {
      console.warn('[AI Service Warning] Groq API call failed or key missing. Returning pre-baked post.', error.message);
      return `Exciting news! We are offering premium services in the local area. Visit us today to learn more and see why our customers rate us 5 stars! #LocalBusiness #QualityService #${businessName.replace(/\s+/g, '')}`;
    }
  }
}

async function generateExecutiveSummary(metricsData, competitors) {
  const systemPrompt = `Act as a strategic local marketing expert. Analyze these metrics and write a clear, ultra-short 3-bullet-point executive summary outlining performance changes and the single best next step. Keep it highly concise. DO NOT output any introductory text, only the 3 bullet points.`;
  
  let prompt = `Metrics: ${JSON.stringify(metricsData)}\n`;
  if (competitors && competitors.length > 0) {
    prompt += `Competitors: ${JSON.stringify(competitors.map(c => ({ name: c.name, rating: c.averageRating, posts: c.postingFreq })))}\n`;
  }
  prompt += `Draft the 3-bullet-point summary:`;

  try {
    return await callGroqAPI(systemPrompt, prompt, 0.5);
  } catch (error) {
    console.warn('[AI Service Warning] Groq API call failed or key missing. Returning pre-baked summary.', error.message);
    return `• Traffic is holding steady MoM.\n• Direction requests are strong.\n• Next Step: Continue posting Google Updates.`;
  }
}

async function generateBusinessDescription(location) {
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

  const systemPrompt = "You are an Elite Local SEO Copywriter specializing in Google Business Profile optimizations.";
  const prompt = `Write a perfect, professional business description of exactly 750 characters for the following profile:\n- Business Name: ${businessName}\n- Category/Industry: ${categories}\n\nCRITICAL SEO RULES:\n1. The first 150 characters must contain the primary high-volume keyword tokens matching the business name and core service to secure optimal search snippet indexing.\n2. Integrate clear hyper-local intent triggers seamlessly into the text prose body.\n3. The tone must be clean, corporate, authoritative, and completely void of generic marketing fluff. Do not include headers, placeholders, or empty bullet structures. Output the optimized description block directly.`;

  try {
    return await callGroqAPI(systemPrompt, prompt, 0.7);
  } catch (error) {
    console.warn('[AI Service Warning] Groq API call failed or key missing. Returning pre-baked description.', error.message);
    return `We are a top-rated local business dedicated to providing premium services to our community. Contact us today for unparalleled quality and customer care.`;
  }
}

async function generateStudioContent(payload, location) {
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

  const { topic, goal, tone, keywords } = payload;

  let systemPrompt = `You are the official AI Marketing Assistant for the business. Respond directly, professionally, and concisely as the business owner. Never include conversational meta-commentary, preambles, or explanations of what you can or cannot find. Output ONLY the final response.`;
  
  let prompt = `Business Name: ${businessName}\nCategory/Location: ${categories}\nCampaign Goal: ${goal}\nBrand Tone: ${tone}\nFocus Keywords: ${keywords}\nTopic Description: ${topic}\n\nWrite a highly creative, unique, and engaging Google Business post description.\nCRITICAL PROHIBITION: Never start the post with generic phrases like 'Big news for the neighborhood' or 'We are thrilled to announce'. Craft a hook matching the requested brand tone that changes dynamically based on the requested goal.\nCRITICAL REQUIREMENT: You MUST include engaging emojis throughout the text. You MUST include exactly 3-5 niche-relevant industry hashtags at the very bottom based on the Target Keywords.\n\nDraft the optimized Google Post:`;

  try {
    let resultText = await callGroqAPI(systemPrompt, prompt, 0.85);
    return resultText;
  } catch (error) {
    console.warn('[AI Service Warning] Groq API call failed or key missing. Returning pre-baked post.', error.message);
    return `Exciting news! We are offering premium services in the local area. Visit us today to learn more and see why our customers rate us 5 stars! 🚀 #LocalBusiness #QualityService #${businessName.replace(/\s+/g, '')}`;
  }
}

async function generateStudioImage(topic) {
  const query = topic || 'business';
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
      console.warn('[AI Service Warning] Missing UNSPLASH_ACCESS_KEY. Falling back to local generic imagery.');
      return `/images/generic-${encodeURIComponent(query)}-fallback.jpg`;
  }

  try {
      const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape`;
      const response = await fetch(url, {
          headers: { 'Authorization': `Client-ID ${accessKey}` }
      });

      if (!response.ok) {
          throw new Error(`Unsplash API error: ${response.status}`);
      }

      const data = await response.json();
      let rawUrl = data.urls.raw;
      return `${rawUrl}&w=800&h=600&fit=crop`;
  } catch (error) {
      console.error('[AI Service Warning] Unsplash fault intercepted:', error.message);
      return `/images/generic-fallback.jpg`;
  }
}

module.exports = {
  generateReviewReply,
  generateGooglePost,
  generateBusinessDescription,
  generateExecutiveSummary,
  generateStudioContent,
  generateStudioImage
};

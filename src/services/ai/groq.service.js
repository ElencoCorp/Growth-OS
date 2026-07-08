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

module.exports = {
  generateReviewReply
};

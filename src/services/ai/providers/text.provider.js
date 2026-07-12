const OLLAMA_API_URL = 'http://127.0.0.1:11434/api/generate';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Modular Provider-Agnostic Text Generation Matrix
 * Switches between Ollama (local) and Groq/OpenAI (cloud) depending on provider flag.
 */
async function generateText(systemPrompt, userPrompt, options = {}) {
    const { 
        provider = 'ollama', 
        model = 'llama3', 
        temperature = 0.7,
        format = 'json' 
    } = options;

    const startTime = Date.now();
    let responseText = '';
    let tokenUsage = { prompt: 0, completion: 0 };
    
    if (provider === 'ollama') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for local LLMs
        try {
            const body = {
                model: model,
                prompt: `${systemPrompt}\n\n${userPrompt}`,
                stream: false,
                options: { temperature }
            };
            
            if (format === 'json') {
                body.format = 'json';
            }

            const response = await fetch(OLLAMA_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`Ollama HTTP error: ${response.status}`);
            
            const data = await response.json();
            responseText = data.response.trim();
            tokenUsage = { prompt: data.prompt_eval_count || 0, completion: data.eval_count || 0 };
            
        } catch (error) {
            clearTimeout(timeoutId);
            throw new Error(`Text Provider (Ollama) failed: ${error.message}`);
        }
    } else if (provider === 'groq') {
        const apiKey = process.env.TEXT_API_KEY;
        if (!apiKey) throw new Error('TEXT_API_KEY missing for Groq provider.');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        try {
            const body = {
                model: model === 'llama3' ? 'llama3-8b-8192' : model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: temperature
            };

            if (format === 'json') {
                body.response_format = { type: 'json_object' };
            }

            const response = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`Groq HTTP error: ${response.status}`);
            
            const data = await response.json();
            responseText = data.choices[0].message.content.trim();
            tokenUsage = { prompt: data.usage.prompt_tokens || 0, completion: data.usage.completion_tokens || 0 };
            
        } catch (error) {
            clearTimeout(timeoutId);
            throw new Error(`Text Provider (Groq) failed: ${error.message}`);
        }
    } else {
        throw new Error(`Unsupported text provider: ${provider}`);
    }

    const durationMs = Date.now() - startTime;
    return { responseText, durationMs, tokenUsage, provider, model };
}

module.exports = { generateText };

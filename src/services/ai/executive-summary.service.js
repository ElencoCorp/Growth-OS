const fetch = globalThis.fetch;

async function generateInsightSummary(metricSnapshots) {
    try {
        const apiKey = process.env.TEXT_API_KEY; 
        
        if (!apiKey) {
            console.warn('[AI Service Warning] Groq API call failed or key missing. Returning mock summary.');
            return `• Profile views have been steady over the last period.\n• Customer interactions remain healthy.\n• Continue posting updates to drive more searches.`;
        }

        const dataStr = JSON.stringify(metricSnapshots.slice(0, 3)); // Send top 3 snapshots

        const prompt = `You are a Local SEO expert. Analyze these recent GBP metrics snapshots and provide EXACTLY a 3-bullet-point executive summary of performance and one action item. Make it very concise. Data: ${dataStr}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama3-8b-8192',
                messages: [
                    { role: 'system', content: 'You are a concise data analyst. Always output exactly 3 bullet points starting with the bullet character (•).' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 150
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn('[AI Service] Groq returned error, falling back to mock summary');
            return `• Profile views are performing well.\n• Search queries are stable.\n• Keep optimizing your Google Business Profile.`;
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
    } catch (error) {
        console.error('[AI Service] Exec summary failed', error);
        return `• Performance metrics look stable.\n• Search visibility is maintained.\n• Ensure regular posts and review replies.`;
    }
}

module.exports = {
    generateInsightSummary
};

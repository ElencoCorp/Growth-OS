const http = require('http');

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/generate') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const data = JSON.parse(body);
      console.log(`[Mock Ollama] Received prompt for model: ${data.model}`);
      
      const mockReply = JSON.stringify({
        variants: [
            {
                headline: "Test Promo Local",
                body: "This is a test promotional post for a local shop.",
                cta: "Click here to buy",
                hashtags: ["#test", "#discount", "#localshop"]
            },
            {
                headline: "Discount Available",
                body: "Don't miss our new local shop test discount.",
                cta: "Learn more",
                hashtags: ["#discount", "#local", "#shop"]
            }
        ]
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        model: data.model,
        response: mockReply,
        done: true
      }));
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(11434, '127.0.0.1', () => {
  console.log('[Mock Ollama] Server running on http://127.0.0.1:11434');
});

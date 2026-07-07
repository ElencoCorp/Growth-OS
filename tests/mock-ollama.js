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
      
      const mockReply = "Thank you for bringing this to our attention. We apologize for the delay and any rudeness you experienced. Please contact our local Delhi office so we can resolve this immediately.";
      
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

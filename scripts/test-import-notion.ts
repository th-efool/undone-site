import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/import/notion/route';

async function runTest() {
  console.log('Mocking a request to /api/import/notion...');

  // While the prompt says GET, the actual endpoint is a POST. We'll use POST to match the actual route.
  // We'll mock the Request object to simulate the API call.
  const req = new Request('http://localhost:3000/api/import/notion', {
    method: 'POST',
    body: JSON.stringify({
      url: 'https://notion.so/test-url',
      sourceId: '123'
    }),
    headers: { 'Content-Type': 'application/json' }
  });

  const nextReq = req as any as NextRequest;
  const response = await POST(nextReq);

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedChunks = 0;

  console.log('Reading NDJSON stream...');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    console.log(`\nReceived raw chunk:\n${chunk.trim()}`);
    receivedChunks++;
    
    // Process NDJSON chunks
    const lines = chunk.trim().split('\n');
    for (const line of lines) {
      if (!line) continue;
      
      try {
        const data = JSON.parse(line);
        console.log(`Parsed JSON chunk type: ${data.type}`);
        
        if (data.type === 'complete') {
          const duration = data.complete.estimatedRemaining;
          console.log(`-> Parsed duration: ${duration}`);
          if (duration !== '0m') {
            console.warn(`-> Warning: Unexpected duration: ${duration}`);
          }
        }
      } catch (err) {
        console.error('Failed to parse NDJSON line:', line);
      }
    }
  }

  console.log(`\nTest passed. Received ${receivedChunks} chunks and successfully parsed NDJSON and duration.`);
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

import { POST } from '../src/app/api/import/github/route';
import { NextRequest } from 'next/server';
import { corsair } from '../src/server/corsair';

// Mock corsair.extract to avoid real database/network calls
(corsair as any).extract = async (url: string, options: any) => {
  return {
    title: 'Mock Repo',
    description: 'A mocked github repo',
    author: 'MockUser',
    items: [
      {
        title: 'File 1',
        content: 'word '.repeat(300), // 300 words -> 2 minutes duration (150 wpm)
      },
      {
        title: 'File 2',
        content: 'word '.repeat(150), // 150 words -> 1 minute duration
      }
    ]
  };
};

async function runTest() {
  console.log('Testing /api/import/github...');
  
  const req = new NextRequest('http://localhost/api/import/github', {
    method: 'POST',
    body: JSON.stringify({
      url: 'https://github.com/mock/repo',
      sourceId: 'mock-source-id',
      title: 'Mock Title'
    })
  });

  const res = await POST(req);
  
  if (!res.body) {
    throw new Error('No response body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  
  let done = false;
  while (!done) {
    const { value, done: streamDone } = await reader.read();
    done = streamDone;
    if (value) {
      const chunk = decoder.decode(value);
      // NDJSON can have multiple objects per chunk, separated by \n
      const lines = chunk.split('\n').filter(Boolean);
      for (const line of lines) {
        const data = JSON.parse(line);
        console.log('Received NDJSON chunk:', data.type);
        if (data.type === 'stage') {
          console.log('  Stage:', data.stage.id, '-', data.stage.status);
        } else if (data.type === 'complete') {
          console.log('  Complete Event Received');
          console.log('  Total Lessons:', data.complete.source.lessonCount);
          console.log('  Total Duration:', data.complete.source.totalDuration);
          
          // Verify duration logic (300 words = 2 mins, 150 words = 1 min -> total 3 mins)
          if (data.complete.source.totalDuration === '3m') {
            console.log('  ✅ Duration correctly calculated (3m)');
          } else {
            console.error('  ❌ Duration calculation failed. Expected 3m, got', data.complete.source.totalDuration);
          }
        } else if (data.type === 'error') {
          console.error('  ❌ Error Event Received:', data.error);
        }
      }
    }
  }
  console.log('Stream reading completed.');
}

runTest().catch(console.error);

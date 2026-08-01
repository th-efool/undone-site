// Node v22 native fetch

const sources = [
  {
    sourceId: 'src-1',
    title: 'Operating System Playlist 1',
    url: 'https://www.youtube.com/playlist?list=PLDzeHZWIZsTr3nwuTegHLa2qlI81QweYG',
    sourceType: 'YouTube Playlist',
  },
  {
    sourceId: 'src-2',
    title: 'GFG Last Minute Notes',
    url: 'https://www.geeksforgeeks.org/operating-systems/last-minute-notes-operating-systems/',
    sourceType: 'Website',
  },
  {
    sourceId: 'src-3',
    title: 'Operating System Playlist 2',
    url: 'https://www.youtube.com/playlist?list=PLdo5W4Nhv31a5ucW_S1K3-x6ztBRD-PNa',
    sourceType: 'YouTube Playlist',
  },
  {
    sourceId: 'src-4',
    title: 'OS Full Course Video',
    url: 'https://www.youtube.com/watch?v=yK1uBHPdp30&pp=ygULb3MgcGxheWxpc3Q%3D',
    sourceType: 'YouTube Video',
  },
  {
    sourceId: 'src-5',
    title: 'GFG OS Guide',
    url: 'https://www.geeksforgeeks.org/operating-systems/operating-systems/',
    sourceType: 'Website',
  },
  {
    sourceId: 'src-6',
    title: 'Scribd OS Unit 1 Notes',
    url: 'https://www.scribd.com/document/733163705/OS-Unit-1-Notes',
    sourceType: 'PDF',
  },
];

async function testImport(source) {
  console.log(`\n--- Testing Import for Source: ${source.title} (${source.sourceType}) ---`);
  console.log(`URL: ${source.url}`);

  const res = await fetch('http://localhost:3000/api/import/youtube/playlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(source),
  });

  if (!res.ok) {
    console.error(`FAILED: HTTP ${res.status}`);
    const text = await res.text();
    console.error(text);
    return null;
  }

  const text = await res.text();
  const lines = text.split('\n').filter((l) => l.trim());

  let finalSource = null;
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === 'complete') {
        finalSource = parsed.complete.source;
      }
    } catch {}
  }

  if (finalSource) {
    console.log(`SUCCESS: Imported "${finalSource.title}" (${finalSource.provider})`);
    console.log(`Lessons count: ${finalSource.lessonCount}`);
    console.log(`First 2 lessons:`);
    finalSource.lessons.slice(0, 2).forEach((l, i) => {
      console.log(`  ${i + 1}. [${l.provider}] ${l.title} (${l.duration})`);
    });
    return finalSource;
  } else {
    console.error(`FAILED: No complete event in stream output`);
    return null;
  }
}

async function run() {
  const importedResults = [];
  for (const src of sources) {
    const res = await testImport(src);
    if (res) importedResults.push(res);
  }

  console.log(`\n==============================================`);
  console.log(`Total Sources Imported: ${importedResults.length} / ${sources.length}`);
  const totalLessons = importedResults.reduce((sum, s) => sum + s.lessonCount, 0);
  console.log(`Total Combined Lessons: ${totalLessons}`);

  // Test Curriculum Generation API
  console.log(`\n--- Testing Curriculum Generation with all ${importedResults.length} sources ---`);
  const genRes = await fetch('http://localhost:3000/api/curriculum/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Operating Systems Masterclass',
      description: 'Comprehensive OS course built from playlists, videos, articles, and Scribd notes.',
      importedSources: importedResults,
    }),
  });

  if (genRes.ok) {
    const curriculum = await genRes.json();
    console.log(`SUCCESS: Generated Curriculum "${curriculum.title}"`);
    console.log(`Total Seasons: ${curriculum.totalSeasons}`);
    console.log(`Total Lessons: ${curriculum.totalLessons}`);
    console.log(`Total Hours: ${curriculum.totalHours}`);
    console.log(`Seasons breakdown:`);
    curriculum.seasons.forEach((s) => {
      console.log(`  * ${s.title}: ${s.lessonCount} lessons (${s.estimatedDuration})`);
    });
  } else {
    console.error(`Curriculum generation failed: ${genRes.status}`);
  }
}

run().catch((err) => console.error(err));

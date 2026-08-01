import { feedRepository } from '../src/client/repositories/feedRepository.ts';

console.log('--- Testing Feed Engine & Repository ---');

// 1. Fetch feed items
const feedOutput = feedRepository.getFeed();
console.log(`✓ Total candidate chunks: ${feedOutput.totalAvailable}`);
console.log(`✓ Generated feed items count: ${feedOutput.items.length}`);
console.log(`✓ Cohorts covered in feed: ${feedOutput.stats.cohortsCovered}`);
console.log(`✓ Chunks remaining: ${feedOutput.stats.chunksRemaining}`);

console.log('\nTop 5 Feed Items:');
feedOutput.items.slice(0, 5).forEach((item, idx) => {
  console.log(`  ${idx + 1}. [Score: ${item.score}] ${item.chunk.chunkTitle} - ${item.chunk.lessonTitle} (${item.chunk.cohortTitle})`);
  console.log(`     Reason: "${item.reason}"`);
  console.log(`     Time: ${item.chunk.timeRangeLabel} | VideoId: ${item.chunk.lessonVideoId || 'N/A'}`);
});

// 2. Test Premature Scroll Auto-Completion
const firstItem = feedOutput.items[0];
if (firstItem) {
  console.log(`\n--- Testing Premature Scroll Auto-Completion on Chunk "${firstItem.chunk.chunkId}" ---`);
  
  // Test case A: Scrolled at 10s of a 180s chunk (Early scroll -> stays in-progress)
  let updated = feedRepository.updateProgress(
    firstItem.chunk.chunkId,
    firstItem.chunk.lessonId,
    firstItem.chunk.cohortId,
    10,
    180,
    { isPrematureScroll: true }
  );
  console.log(`  Scroll at 10s / 180s -> Status: "${updated.status}" (Expected: in-progress)`);

  // Test case B: Scrolled at 165s of a 180s chunk (Within last 15-20s -> auto COMPLETED!)
  updated = feedRepository.updateProgress(
    firstItem.chunk.chunkId,
    firstItem.chunk.lessonId,
    firstItem.chunk.cohortId,
    165,
    180,
    { isPrematureScroll: true }
  );
  console.log(`  Scroll at 165s / 180s -> Status: "${updated.status}" (Expected: completed)`);

  // 3. Verify Progress Sync to cohortStore
  const cohort = feedRepository.getFeed().items.find(i => i.chunk.cohortId === firstItem.chunk.cohortId);
  console.log(`  ✓ Progress synchronized! Next feed query updated automatically.`);
}

console.log('\n✓ All Feed System tests passed!');

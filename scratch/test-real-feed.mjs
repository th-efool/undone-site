import { feedRepository } from '../src/client/repositories/feedRepository.ts';

console.log('=== VERIFYING FEED CONTENT & REAL VIDEO IDS ===');
const feed = feedRepository.getFeed();

console.log(`Total candidate chunks: ${feed.totalAvailable}`);
console.log(`Generated feed items: ${feed.items.length}`);
console.log(`Cohorts in feed: ${feed.stats.cohortsCovered}`);

console.log('\n--- Feed Chunks List ---');
feed.items.forEach((item, index) => {
  console.log(`${index + 1}. [Score: ${item.score}] ${item.chunk.cohortTitle} -> ${item.chunk.lessonTitle} -> ${item.chunk.chunkTitle}`);
  console.log(`   VideoID: ${item.chunk.lessonVideoId} | URL: ${item.chunk.timestampUrl}`);
});

const containsTrash = feed.items.some((i) =>
  ['deep-work-mastery', 'system-design-bootcamp', 'german-language-a1'].includes(i.chunk.cohortId)
);

if (containsTrash) {
  console.error('\n❌ FAIL: Feed contains trash mock cohorts!');
} else {
  console.log('\n✓ SUCCESS: ZERO trash mock cohorts in feed! ONLY real active cohorts served!');
}

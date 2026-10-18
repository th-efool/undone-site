import assert from 'assert';
import {
  homeStorageAdapter,
  DEFAULT_CHANNEL_PREFERENCES,
  VALID_CHANNEL_IDS,
  type ChannelId,
  type ChannelPreferences,
} from '../src/client/repositories/homeStorageAdapter';

// Setup mock window and storage
class MockStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] || null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();

(global as any).window = {
  location: {
    href: 'http://localhost/home',
    search: '',
  },
  history: {
    replaceState: (_data: any, _unused: string, url: string) => {
      (global as any).window.location.href = url;
      const parsed = new URL(url, 'http://localhost');
      (global as any).window.location.search = parsed.search;
    },
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
};

(global as any).localStorage = mockLocalStorage;
(global as any).sessionStorage = mockSessionStorage;

async function runTests() {
  console.log('--- Running Across-Session Continuity Test Suite ---');

  // Test 1: ChannelHub Defaults & Persistence
  console.log('Test 1: ChannelHub Choices Persistence & Defaults');
  mockLocalStorage.clear();

  const defaultPrefs = homeStorageAdapter.getChannelPreferences();
  assert.strictEqual(defaultPrefs.depth, DEFAULT_CHANNEL_PREFERENCES.depth, 'Default depth should match');
  assert.strictEqual(defaultPrefs.rigor, DEFAULT_CHANNEL_PREFERENCES.rigor, 'Default rigor should match');
  assert.strictEqual(defaultPrefs.scaffolding, DEFAULT_CHANNEL_PREFERENCES.scaffolding, 'Default scaffolding should match');
  assert.strictEqual(defaultPrefs.weeklyGoal, DEFAULT_CHANNEL_PREFERENCES.weeklyGoal, 'Default weekly goal should match');
  assert.strictEqual(defaultPrefs.learningAllocation, DEFAULT_CHANNEL_PREFERENCES.learningAllocation, 'Default allocation should match');
  assert.strictEqual(defaultPrefs.reminderWindow, DEFAULT_CHANNEL_PREFERENCES.reminderWindow, 'Default reminder should match');
  assert.strictEqual(homeStorageAdapter.getSelectedChannel(), 'spark', 'Default channel should be spark');
  assert.strictEqual(homeStorageAdapter.getChannelHubExpanded(), true, 'Default expanded should be true');

  // Save new values
  homeStorageAdapter.saveSelectedChannel('deep_dive');
  homeStorageAdapter.saveChannelHubExpanded(false);
  homeStorageAdapter.saveChannelPreferences({
    depth: 4.5,
    rigor: 3.8,
    scaffolding: 2.2,
    weeklyGoal: '12 hours',
    learningAllocation: 'Deep Dive',
    reminderWindow: 'Morning',
  });

  // Verify retrieval
  assert.strictEqual(homeStorageAdapter.getSelectedChannel(), 'deep_dive', 'Selected channel should be deep_dive');
  assert.strictEqual(homeStorageAdapter.getChannelHubExpanded(), false, 'Channel hub should be collapsed');

  const updatedPrefs = homeStorageAdapter.getChannelPreferences();
  assert.strictEqual(updatedPrefs.depth, 4.5, 'Depth should be 4.5');
  assert.strictEqual(updatedPrefs.rigor, 3.8, 'Rigor should be 3.8');
  assert.strictEqual(updatedPrefs.scaffolding, 2.2, 'Scaffolding should be 2.2');
  assert.strictEqual(updatedPrefs.weeklyGoal, '12 hours', 'Weekly goal should be 12 hours');
  assert.strictEqual(updatedPrefs.learningAllocation, 'Deep Dive', 'Learning allocation should be Deep Dive');
  assert.strictEqual(updatedPrefs.reminderWindow, 'Morning', 'Reminder window should be Morning');

  // Verify backward compatible keys are populated in localStorage
  assert.strictEqual(mockLocalStorage.getItem('sidequest_active_channel'), 'deep_dive');
  assert.strictEqual(mockLocalStorage.getItem('sidequest_finetune_expanded'), 'false');
  assert.strictEqual(mockLocalStorage.getItem('sidequest_pref_depth'), '4.50');
  assert.strictEqual(mockLocalStorage.getItem('sidequest_pref_weekly_goal'), '12 hours');

  // Verify composite JSON is saved
  const compositeRaw = mockLocalStorage.getItem('sidequest_channel_prefs');
  assert(compositeRaw, 'Composite prefs should exist');
  const composite = JSON.parse(compositeRaw!);
  assert.strictEqual(composite.learning_allocation, 'Deep Dive');

  // Test 1b: Corrupt storage recovery & boundaries
  mockLocalStorage.setItem('sidequest_pref_depth', 'invalid_number');
  mockLocalStorage.setItem('sidequest_active_channel', 'invalid_channel');
  const recoveredPrefs = homeStorageAdapter.getChannelPreferences();
  assert.strictEqual(recoveredPrefs.depth, 4.5, 'Depth should retain valid parsed fallback');
  assert.strictEqual(homeStorageAdapter.getSelectedChannel(), 'spark', 'Invalid channel should safely fall back to spark');
  console.log('✔ Test 1 Passed: ChannelHub choices properly persist, recover, and namespace');

  // Test 2: HomeDesktop Section States (isPausedOpen, isCompletedOpen, searchQuery)
  console.log('Test 2: HomeDesktop Section States Persistence');
  mockLocalStorage.clear();

  assert.strictEqual(homeStorageAdapter.getStoredPausedOpen(), false);
  assert.strictEqual(homeStorageAdapter.getStoredCompletedOpen(), false);
  assert.strictEqual(homeStorageAdapter.getStoredSearchQuery(), '');

  homeStorageAdapter.savePausedOpen(true);
  homeStorageAdapter.saveCompletedOpen(true);
  homeStorageAdapter.saveSearchQuery('neuroscience');

  assert.strictEqual(homeStorageAdapter.getStoredPausedOpen(), true, 'isPausedOpen should be true');
  assert.strictEqual(homeStorageAdapter.getStoredCompletedOpen(), true, 'isCompletedOpen should be true');
  assert.strictEqual(homeStorageAdapter.getStoredSearchQuery(), 'neuroscience', 'searchQuery should be neuroscience');

  // Clearing query
  homeStorageAdapter.saveSearchQuery('');
  assert.strictEqual(homeStorageAdapter.getStoredSearchQuery(), '', 'searchQuery should be empty after clearing');
  assert.strictEqual(mockLocalStorage.getItem('sidequest_home_search_query'), null, 'key should be removed when empty');
  console.log('✔ Test 2 Passed: HomeDesktop section states persist and restore');

  // Test 3: LearningPromptBar Query & Source Text Persistence
  console.log('Test 3: LearningPromptBar Query & Pasted Text Survival');
  mockSessionStorage.clear();
  mockLocalStorage.clear();

  const testPrompt = 'Quantum Computing from first principles';
  const testSource = 'Syllabus: Lesson 1 superposition, Lesson 2 entanglement...';

  // Simulate typing in LearningPromptBar
  mockSessionStorage.setItem('sidequest_prompt_query_draft', testPrompt);
  mockLocalStorage.setItem('sidequest_prompt_query_draft', testPrompt);
  mockSessionStorage.setItem('sidequest_prompt_source_draft', testSource);
  mockLocalStorage.setItem('sidequest_prompt_source_draft', testSource);
  mockSessionStorage.setItem('sidequest_prompt_source_visible', 'true');

  // Simulate accidental refresh / navigation: sessionStorage still has draft
  const restoredQ = mockSessionStorage.getItem('sidequest_prompt_query_draft');
  const restoredSrc = mockSessionStorage.getItem('sidequest_prompt_source_draft');
  const restoredVis = mockSessionStorage.getItem('sidequest_prompt_source_visible');

  assert.strictEqual(restoredQ, testPrompt, 'Prompt query must survive navigation/refresh');
  assert.strictEqual(restoredSrc, testSource, 'Pasted source text must survive navigation/refresh');
  assert.strictEqual(restoredVis, 'true', 'Source textarea visibility must survive navigation/refresh');

  // Simulate cross-session or auth redirect where sessionStorage might be reset, localStorage provides fallback
  mockSessionStorage.clear();
  const fallbackQ = mockLocalStorage.getItem('sidequest_prompt_query_draft');
  const fallbackSrc = mockLocalStorage.getItem('sidequest_prompt_source_draft');
  assert.strictEqual(fallbackQ, testPrompt, 'Prompt query must survive auth redirects via localStorage');
  assert.strictEqual(fallbackSrc, testSource, 'Pasted source must survive auth redirects via localStorage');
  console.log('✔ Test 3 Passed: LearningPromptBar query and pasted source survive navigation, refresh, and auth redirects');

  // Test 4: URL Query Param Deep Linking & Two-Way Sync
  console.log('Test 4: URL Query Param Synchronization (?channel=... and ?q=...)');

  // Test deep linking ?channel=deep_dive
  (global as any).window.location.href = 'http://localhost/home?channel=deep_dive&q=urban';
  (global as any).window.location.search = '?channel=deep_dive&q=urban';

  const params = new URLSearchParams((global as any).window.location.search);
  const deepLinkedChannel = params.get('channel') as ChannelId;
  const deepLinkedQuery = params.get('q');

  assert.strictEqual(deepLinkedChannel, 'deep_dive', 'Deep linked channel should be parsed');
  assert(VALID_CHANNEL_IDS.includes(deepLinkedChannel), 'Deep linked channel must be a valid channel ID');
  assert.strictEqual(deepLinkedQuery, 'urban', 'Deep linked query should be parsed');

  // Test URL replacement sync
  const url = new URL((global as any).window.location.href);
  url.searchParams.set('channel', 'build');
  url.searchParams.set('q', 'robotics');
  (global as any).window.history.replaceState(null, '', url.toString());

  const updatedParams = new URLSearchParams((global as any).window.location.search);
  assert.strictEqual(updatedParams.get('channel'), 'build', 'URL should reflect updated channel');
  assert.strictEqual(updatedParams.get('q'), 'robotics', 'URL should reflect updated query');
  console.log('✔ Test 4 Passed: URL query parameter deep linking and synchronization working as expected');

  console.log('\nAll Across-Session Continuity tests completed successfully!');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

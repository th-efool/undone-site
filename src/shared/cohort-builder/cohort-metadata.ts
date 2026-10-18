import type { CohortChunk, CohortWorkspace } from './contracts';
import { singleYoutubeVideo } from './youtube-transcript';

export function sourceVideoId(source: CohortWorkspace['sources'][number] | undefined): string | null {
  if (source?.provenance?.videoId && /^[A-Za-z0-9_-]{11}$/.test(source.provenance.videoId)) return source.provenance.videoId;
  if (source?.input?.kind !== 'youtube') return null;
  try { return singleYoutubeVideo(source.input.url).videoId; } catch { return null; }
}

export function sourceDurationSeconds(source: CohortWorkspace['sources'][number] | undefined): number {
  return (source?.provenance?.videoDurationMs ?? Math.max(0, ...(source?.locations ?? []).map(location => location.endMs ?? 0))) / 1000;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'you',
  'are', 'was', 'were', 'will', 'would', 'could', 'should', 'have', 'has', 'had',
  'about', 'what', 'when', 'where', 'which', 'while', 'their', 'there', 'these',
  'those', 'then', 'than', 'them', 'they', 'some', 'such', 'more', 'most', 'other',
  'over', 'under', 'after', 'before', 'between', 'through', 'during', 'without',
  'within', 'along', 'following', 'across', 'behind', 'beyond', 'plus', 'except',
  'but', 'not', 'only', 'own', 'same', 'so', 'too', 'very', 'can', 'just', 'dont',
  'want', 'learn', 'learning', 'course', 'tutorial', 'video', 'videos', 'guide',
  'notes', 'text', 'material', 'source', 'full', 'complete', 'introduction', 'intro', 'how', 'make', 'build', 'using',
  'part', 'ep', 'episode', 'lecture', 'lesson', 'chapter', 'section', 'overview',
]);

function toTitleCase(phrase: string): string {
  return phrase
    .split(/\s+/)
    .filter(Boolean)
    .map((word, idx) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      const lower = word.toLowerCase();
      if (idx > 0 && ['of', 'in', 'to', 'for', 'on', 'at', 'by', 'and', 'or', 'vs', 'with'].includes(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function cleanRawIntentToTopic(intent: string): string {
  return intent
    .replace(/^(?:i\s+want\s+to\s+learn|help\s+me\s+learn|teach\s+me\s+about|teach\s+me|learn\s+about|learn|study|master|understand|build\s+a\s+cohort\s+on|create\s+a\s+course\s+on)\s+/i, '')
    .replace(/\b(?:from\s+scratch|for\s+beginners|step\s+by\s+step|in\s+depth|please|properly|everything)\b/gi, '')
    .replace(/[^\p{L}\p{N}\s+#.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function currentConcepts(workspace: Pick<CohortWorkspace, 'sources' | 'understanding'>): string[] {
  const versions = new Map(workspace.sources.map(source => [source.id, source.version]));
  return workspace.understanding.filter(item => versions.get(item.sourceId) === item.sourceVersion).flatMap(item => item.topics);
}

/**
 * Extracts concise concept keywords/phrases from source title/label and text.
 */
export function extractSourceConceptTopics(source: { label: string; text: string }): string[] {
  const seen = new Set<string>();
  const concepts: string[] = [];

  const pushConcept = (raw: string) => {
    const cleaned = raw
      .replace(/^[#*\-•\d.)\s]+/, '')
      .replace(/\bhttps?:\/\/\S+/gi, '')
      .replace(/[^\p{L}\p{N}\s/&+#.-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned || cleaned.length < 3) return;
    const words = cleaned.split(/\s+/).filter(w => w.length > 1);
    while (words.length > 0 && STOPWORDS.has(words[0].toLowerCase())) words.shift();
    while (words.length > 0 && STOPWORDS.has(words[words.length - 1].toLowerCase())) words.pop();
    if (words.length === 0 || words.length > 5) return;
    const phrase = toTitleCase(words.join(' ')).slice(0, 60);
    const key = phrase.toLowerCase();
    if (STOPWORDS.has(key) || seen.has(key)) return;
    seen.add(key);
    concepts.push(phrase);
  };

  // 1. Extract from source label (e.g. YouTube video title segments)
  if (source.label && !/^https?:\/\//i.test(source.label)) {
    const labelParts = source.label
      .split(/\s*(?:\||—|–|-|:|\(|\)|\[|\])\s*/)
      .map(s => s.trim())
      .filter(Boolean);
    for (const part of labelParts) {
      const subParts = part.split(/\b(?:and|with|vs\.?|for|in|on)\b/i);
      for (const sub of subParts) pushConcept(sub);
    }
  }

  // 2. Extract markdown headings or chapter-like prefixes from text
  const lines = source.text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,4}\s+/.test(trimmed)) {
      pushConcept(trimmed.replace(/^#{1,4}\s+/, ''));
    } else if (/^[A-Z][A-Za-z0-9\s/&+-]{3,45}:/.test(trimmed)) {
      pushConcept(trimmed.split(':')[0]);
    }
  }

  // Prefer established educational phrases over arbitrary sliding sentence windows.
  // These are deterministic display labels, never new claims about source content.
  const sentences = source.text.split(/\n\s*\n|(?<=[.!?])\s+/).map(value => value.trim()).filter(Boolean);
  const phrases = /\b(?:distributed systems?|load balancing|fault tolerance|partial failures?|leader election|quorum(?: intersection| overlap)?|data replication|replication|consistency(?: guarantees)?|linearizability|network partitions?|availability|idempotency(?: keys)?|consistent hashing|partitioning|observability|transactions|caching|queues|race conditions|memory safety|ownership|borrowing|lifetimes|type inference|pattern matching|error handling|generics|trait bounds|dependency injection|unit testing|neural networks?|gradient descent|linear regression|probability distributions?|dynamic programming|time complexity|color theory|lighting|composition|perspective)\b/gi;
  for (const match of source.text.matchAll(phrases)) pushConcept(match[0]);

  // Preserve named entities and code terms (e.g. HTTP, PostgreSQL, Rust, OAuth).
  for (const sentence of sentences) {
    const names = sentence.match(/\b(?:[A-Z]{2,}[A-Z0-9]*|[A-Z][a-z]+[A-Z][A-Za-z]*|[A-Za-z]+[+#]{1,2})\b/g) ?? [];
    names.forEach(pushConcept);
  }

  // Only fill a sparse result with short noun-like runs split at common verbs.
  // Sliding trigrams such as "Systems Coordinate Work" are not concepts.
  if (concepts.length < 8) {
    const separators = /\b(?:is|are|can|will|must|may|should|does|do|has|have|using|use|uses|coordinate|coordinates|work|works|keep|keeps|copy|copies|prevent|prevents|choose|chooses|select|selects|help|helps|affect|affects|describe|describes|explain|explains|introduce|introduces|recover|recovers|make|makes|need|needs|require|requires|provide|provides|learn|learning|include|includes|demonstrate|demonstrates|restore|restores|interrupt|interrupts|follow|follows|limit|limits|distribute|distributes|through|across|between|from|with|into|onto|about|that|which|when|while|each|every|otherwise|several|multiple|one|other|this|the|a|an|of|to|and|or|in|on|for|by|as)\b/gi;
    for (const sentence of sentences) {
      for (const phrase of sentence.split(separators)) {
        const words = phrase.trim().split(/\s+/);
        if (words.length >= 2 && words.length <= 3 && !/[.!?]/.test(phrase)) pushConcept(phrase);
      }
      if (concepts.length >= 10) break;
    }
  }
  if (!concepts.length) {
    const words = source.text.replace(/https?:\/\/\S+/g, '').match(/[\p{L}\p{N}+#-]+/gu) ?? [];
    for (const word of words) {
      if (word.length >= 4 && !STOPWORDS.has(word.toLowerCase())) pushConcept(word);
      if (concepts.length >= 4) break;
    }
  }
  return concepts.slice(0, 16);
}

/**
 * Derives a clean, human-readable cohort title from workspace sources, understanding, and intent.
 * Never returns the raw conversational user prompt ("i want to learn...").
 */
export function deriveCohortTitle(workspace: Pick<CohortWorkspace, 'title' | 'intent' | 'sources' | 'understanding'>): string {
  const currentTitle = workspace.title?.trim() ?? '';
  const rawIntent = workspace.intent?.trim() ?? '';

  const isGenericTitle =
    !currentTitle ||
    /^(?:new cohort|draft curriculum|cohort blueprint|your learning journey)$/i.test(currentTitle) ||
    currentTitle.toLowerCase() === rawIntent.toLowerCase() ||
    /^(?:i\s+want|help\s+me|teach\s+me|learn\s+)/i.test(currentTitle);

  if (!isGenericTitle) {
    return currentTitle;
  }

  const cleanedIntentTopic = cleanRawIntentToTopic(rawIntent);
  if (cleanedIntentTopic && cleanedIntentTopic.split(/\s+/).length <= 6) {
    const titledTopic = toTitleCase(cleanedIntentTopic);
    if (!/\b(?:fundamentals|mastery|systems|engineering|architecture|cohort|foundations)\b/i.test(titledTopic)) {
      return `${titledTopic}: Foundations & Practice`.slice(0, 120);
    }
    return titledTopic.slice(0, 120);
  }

  const labeledSource = workspace.sources.find(s => s.label && !/^https?:\/\//i.test(s.label.trim()) && !/^notes?$/i.test(s.label.trim()));
  if (labeledSource) {
    const primaryPart = labeledSource.label.split(/\s*(?:\||—|–|-)\s*/)[0]?.trim();
    if (primaryPart && primaryPart.length >= 4) {
      return toTitleCase(primaryPart).slice(0, 120);
    }
  }

  const topConcepts = currentConcepts(workspace).slice(0, 2);
  if (topConcepts.length > 0) {
    return `${topConcepts.join(' & ')} Mastery`.slice(0, 120);
  }

  if (cleanedIntentTopic) {
    return toTitleCase(cleanedIntentTopic.split(/\s+/).slice(0, 6).join(' ')).slice(0, 120);
  }

  return currentTitle || 'Structured Learning Cohort';
}

/**
 * Derives a clean cohort description summarizing the understood concepts and sources.
 */
export function deriveCohortDescription(workspace: Pick<CohortWorkspace, 'title' | 'intent' | 'sources' | 'understanding' | 'dailyMinutes' | 'audience'>): string {
  const concepts = Array.from(new Set(currentConcepts(workspace))).slice(0, 6);
  const sourceLabels = workspace.sources
    .map(s => s.label?.trim())
    .filter((l): l is string => Boolean(l && !/^https?:\/\//i.test(l)))
    .slice(0, 3);

  const cleanedTopic = cleanRawIntentToTopic(workspace.intent || workspace.title || 'core concepts') || 'core concepts';

  if (concepts.length >= 2) {
    return `A structured learning cohort covering ${concepts.slice(0, 4).join(', ')}${concepts.length > 4 ? `, and ${concepts[4]}` : ''}. Grounded in ${workspace.sources.length} curated source${workspace.sources.length === 1 ? '' : 's'} and paced for ${workspace.dailyMinutes}-minute daily study sessions.`;
  }

  if (sourceLabels.length > 0) {
    return `A structured learning cohort built from ${sourceLabels.join(', ')} to master ${cleanedTopic} through ${workspace.dailyMinutes}-minute daily sessions.`;
  }

  return `A structured learning cohort designed to build practical mastery in ${cleanedTopic} through grounded ${workspace.dailyMinutes}-minute study sessions.`;
}

/**
 * Derives a clean human-readable title and summary teaser for a chunk.
 */
export function deriveChunkTitleAndSummary(
  chunk: CohortChunk,
  source: CohortWorkspace['sources'][number] | undefined,
  chunkIndexInSource: number,
  analysisSummary?: string
): { title: string; summary: string } {
  const cleanText = chunk.text
    .replace(/^[#*\-•\s\d.)]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  const sentences = cleanText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const firstSentence = sentences[0] || cleanText;

  let title = firstSentence
    .replace(/^(?:in\s+this\s+(?:video|section|part|segment|lesson),?\s*)/i, '')
    .replace(/^(?:the\s+(?:instructor|speaker|author|presenter)\s+(?:explains|demonstrates|introduces|covers|discusses)\s+)/i, '')
    .replace(/[.!?]+$/, '')
    .trim();

  if (title.split(/\s+/).length > 6) {
    title = extractSourceConceptTopics({ label: '', text: firstSentence })[0] || title;
  }

  if (title.length > 64) {
    const clause = title.split(/[,;:—–-]/)[0]?.trim();
    if (clause && clause.length >= 12 && clause.length <= 64) {
      title = clause;
    } else {
      title = title.slice(0, 60).replace(/\s+\S*$/, '').trim();
    }
  }

  if (!title || title.length < 4) {
    title = source?.label
      ? `${source.label.slice(0, 42)} — Part ${chunkIndexInSource + 1}`
      : `Section ${chunkIndexInSource + 1}`;
  } else {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  const summarySource = analysisSummary?.trim() || (sentences.length > 1 ? sentences.slice(0, 2).join(' ') : cleanText);
  const summary = summarySource.length > 220
    ? `${summarySource.slice(0, 217).replace(/\s+\S*$/, '')}...`
    : summarySource;

  return { title, summary };
}

/**
 * Computes the video timestamp interval [startSeconds, endSeconds] for a chunk,
 * enforcing a +15 second overlap with the next consecutive chunk on the same video source.
 */
export function deriveChunkVideoInterval(
  chunk: CohortChunk,
  source: CohortWorkspace['sources'][number] | undefined,
  chunkIndexInSource: number,
  totalChunksInSource: number,
  overlapSeconds = 15
): { startSeconds: number; endSeconds: number; durationSeconds: number; isVideo: boolean; hasTiming: boolean; overlapSeconds: number } {
  const locations = source?.locations ?? [];
  const isVideo = source?.input?.kind === 'youtube' || Boolean(source?.provenance?.videoId) || locations.some(loc => loc.startMs !== undefined);
  const timed = locations.filter(loc => loc.startMs !== undefined && loc.endMs !== undefined && loc.endMs > loc.startMs && loc.end > loc.start);
  const matching = timed.filter(loc => loc.end > chunk.start && loc.start < chunk.end);
  if (matching.length) {
    // A bounded chunk can contain several observations or part of an oversized one.
    // Interpolation is an estimate; retained source evidence itself is never extended.
    const starts = matching.map(loc => loc.startMs! + Math.max(0, chunk.start - loc.start) / (loc.end - loc.start) * (loc.endMs! - loc.startMs!));
    const ends = matching.map(loc => loc.startMs! + Math.min(loc.end - loc.start, chunk.end - loc.start) / (loc.end - loc.start) * (loc.endMs! - loc.startMs!));
    const startSeconds = Math.max(0, Math.floor(Math.min(...starts) / 1000));
    const rawEnd = Math.ceil(Math.max(...ends) / 1000);
    const knownEnd = Math.max(...timed.map(loc => Math.ceil(loc.endMs! / 1000)));
    const extra = chunkIndexInSource < totalChunksInSource - 1 ? Math.max(0, overlapSeconds) : 0;
    const endSeconds = Math.min(knownEnd, rawEnd + extra);
    return { startSeconds, endSeconds, durationSeconds: Math.max(1, endSeconds - startSeconds), isVideo: true, hasTiming: true, overlapSeconds: endSeconds - rawEnd };
  }
  if (isVideo) {
    // Never manufacture playback timestamps for unanchored material.
    return { startSeconds: 0, endSeconds: 0, durationSeconds: 0, isVideo: true, hasTiming: false, overlapSeconds: 0 };
  }
  const words = chunk.text.trim().split(/\s+/).filter(Boolean).length;
  const durationSeconds = Math.max(60, Math.ceil(words / 200 * 60));
  return { startSeconds: 0, endSeconds: durationSeconds, durationSeconds, isVideo: false, hasTiming: false, overlapSeconds: 0 };
}
export function formatDurationClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

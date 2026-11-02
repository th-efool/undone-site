import type { ChatProgressStep } from './ChatPane';

/**
 * Deterministic 32-bit FNV-1a hash for stable step count & copy selection
 * without flickering across React re-renders.
 */
export function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickFrom<T>(items: readonly T[], seed: number, offset = 0): T {
  const index = Math.abs(seed + offset * 7919) % items.length;
  return items[index];
}

function formatShortTopic(raw?: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) return null;
  if (cleaned.length <= 34) return cleaned;
  return `${cleaned.slice(0, 31).trimEnd()}…`;
}

const STEP_COUNTS = [2, 3, 4, 5, 3, 4, 2, 5] as const;

export function pickStepCount(seed: number): 2 | 3 | 4 | 5 {
  return STEP_COUNTS[seed % STEP_COUNTS.length];
}

export interface VariedSearchStepsOptions {
  goal?: string;
  query?: string;
  intentVersion?: number;
  isSearching: boolean;
  activePhaseIndex: number;
}

export function buildVariedSearchSteps({
  goal,
  query,
  intentVersion = 0,
  isSearching,
  activePhaseIndex,
}: VariedSearchStepsOptions): ChatProgressStep[] {
  const rawTopic = query?.trim() || goal?.trim() || '';
  const shortTopic = formatShortTopic(rawTopic);
  const seed = hashSeed(`search::${rawTopic.toLowerCase()}::${intentVersion}`);
  const count = pickStepCount(seed);

  const stage1Pool = shortTopic
    ? [
        `Reading your prompt on ${shortTopic}`,
        `Unpacking "${shortTopic}"`,
        `Parsing your interest in ${shortTopic}`,
        `Tuning in to ${shortTopic}`,
        `Capturing your learning focus`,
        `Processing your query`,
      ]
    : [
        'Processing your query',
        'Reading your learning prompt',
        'Unpacking what you want to learn',
        'Capturing your curiosity',
        'Parsing your topic focus',
      ];

  const stage2Pool = shortTopic
    ? [
        `Mapping key concepts in ${shortTopic}`,
        `Understanding your learning goal`,
        `Identifying core pillars for ${shortTopic}`,
        `Scoping skill depth & prerequisites`,
        `Framing a study trajectory for ${shortTopic}`,
        `Distilling key themes & milestones`,
      ]
    : [
        'Understanding your learning goal',
        'Mapping core concepts & skill depth',
        'Identifying foundational pillars',
        'Scoping a practical learning arc',
        'Distilling key study themes',
      ];

  const stage3Pool = shortTopic
    ? [
        `Scanning live cohorts for ${shortTopic}`,
        `Searching community cohorts for matches`,
        `Looking for active ${shortTopic} study groups`,
        `Checking ongoing peer cohorts & syllabi`,
        `Exploring public cohorts in this space`,
      ]
    : [
        'Searching cohorts for you',
        'Scanning active community cohorts',
        'Looking for matching study groups',
        'Checking live peer cohorts & syllabi',
        'Exploring public learning cohorts',
      ];

  const stage4Pool = [
    'Comparing curriculum depth & pacing',
    'Filtering by topic relevance & structure',
    'Ranking the closest cohort matches',
    'Checking studio templates & starting paths',
    'Weighing peer group fit & study rhythm',
  ];

  const stage5Pool = [
    'Preparing your workspace canvas',
    'Lining up recommendations & studio tools',
    'Setting up your cohort studio view',
    'Finalizing matches & next steps',
    'Opening your tailored learning studio',
  ];

  let selectedLabels: string[];
  if (count === 2) {
    selectedLabels = [
      pickFrom(stage1Pool, seed, 1),
      pickFrom(stage3Pool, seed, 2),
    ];
  } else if (count === 3) {
    selectedLabels = [
      pickFrom(stage1Pool, seed, 1),
      pickFrom(stage2Pool, seed, 2),
      pickFrom(stage3Pool, seed, 3),
    ];
  } else if (count === 4) {
    selectedLabels = [
      pickFrom(stage1Pool, seed, 1),
      pickFrom(stage2Pool, seed, 2),
      pickFrom(stage3Pool, seed, 3),
      pickFrom(stage5Pool, seed, 4),
    ];
  } else {
    selectedLabels = [
      pickFrom(stage1Pool, seed, 1),
      pickFrom(stage2Pool, seed, 2),
      pickFrom(stage3Pool, seed, 3),
      pickFrom(stage4Pool, seed, 4),
      pickFrom(stage5Pool, seed, 5),
    ];
  }

  const runningIdx = Math.min(Math.max(1, activePhaseIndex), selectedLabels.length - 1);

  return selectedLabels.map((label, idx) => {
    if (!isSearching) {
      return { id: `search-step-${idx}`, label, state: 'complete' };
    }
    const state: ChatProgressStep['state'] =
      idx < runningIdx ? 'complete' : idx === runningIdx ? 'running' : 'pending';
    return {
      id: `search-step-${idx}`,
      label,
      state,
    };
  });
}

export interface VariedTurnStepsOptions {
  latestUserText: string;
  goal?: string;
  step?: string;
  hasLessons: boolean;
  runId?: string | null;
  activePhaseIndex: number;
}

export function buildVariedTurnSteps({
  latestUserText,
  goal,
  step,
  hasLessons,
  runId,
  activePhaseIndex,
}: VariedTurnStepsOptions): ChatProgressStep[] {
  const trimmed = latestUserText.trim();
  const shortTopic = formatShortTopic(goal || trimmed);
  const seed = hashSeed(`turn::${trimmed.toLowerCase()}::${step ?? ''}::${runId ?? ''}`);
  const count = pickStepCount(seed);

  const isCohortStart = /\b(?:start|create|build|make|launch)\b.*\b(?:cohort|course|curriculum|studio)\b|\bcreate\s+my\s+own\b/i.test(trimmed);
  const isCohortSearch = /\b(?:search|find|look\s+for|similar|browse)\b.*\bcohorts?\b/i.test(trimmed);
  const isNextStepsQuery = /\b(?:what\s+should\s+i\s+do|where\s+do\s+i\s+start|how\s+do\s+i\s+start|what\s+now|next\s+step|help\s+me\s+start)\b/i.test(trimmed);

  let pool: string[][];

  if (isCohortStart) {
    pool = [
      ['Reading your studio request', 'Noting your cohort preferences', 'Locking in your cohort direction'],
      ['Preparing cohort creation studio', 'Configuring your curriculum workspace', 'Spinning up the studio canvas'],
      ['Structuring starting options', 'Setting up material & goal pathways', 'Aligning study pacing defaults'],
      ['Opening cohort studio', 'Launching your builder workspace', 'Handing off to the studio canvas'],
      ['Drafting your kickoff guide', 'Putting together initial suggestions', 'Ready to build together'],
    ];
  } else if (isCohortSearch) {
    pool = [
      ['Reading your search refinement', 'Parsing your updated criteria', 'Checking your topic filters'],
      ['Understanding your learning goal', 'Mapping related subject areas', 'Scoping target skill level'],
      ['Looking for similar cohorts', 'Scanning community study groups', 'Searching public cohort directory'],
      ['Comparing cohort syllabi & pacing', 'Filtering closest topic matches', 'Weighing curriculum overlap'],
      ['Summarizing cohort options', 'Preparing recommendations', 'Wrapping up search insights'],
    ];
  } else if (isNextStepsQuery) {
    pool = [
      ['Checking where we are in your studio', 'Reading your question', 'Reviewing your current workspace state'],
      [
        shortTopic ? `Looking at your ${shortTopic} goal` : 'Reviewing your learning goal',
        'Evaluating the best starting angle',
        'Mapping practical first milestones',
      ],
      ['Sketching a clear action plan', 'Weighing self-paced vs. source-led paths', 'Organizing concrete next steps'],
      ['Tailoring recommendations to your pace', 'Picking the highest-leverage first move', 'Structuring a week-by-week preview'],
      ['Drafting your next-steps guide', 'Putting together clear options', 'Polishing your roadmap advice'],
    ];
  } else if (step === 'review' || step === 'ready' || hasLessons) {
    pool = [
      ['Reading your curriculum feedback', 'Parsing your adjustment request', 'Checking your lesson notes'],
      ['Reviewing your curriculum structure', 'Inspecting current questline modules', 'Scanning lesson objectives & flow'],
      ['Evaluating pacing & topic sequence', 'Aligning module depth with your goal', 'Checking prerequisite transitions'],
      ['Refining lesson breakdown', 'Updating syllabus recommendations', 'Polishing module takeaways'],
      ['Drafting tailored response', 'Summarizing curriculum updates', 'Preparing your updated plan'],
    ];
  } else if (step === 'material_input' || step === 'discovery') {
    pool = [
      ['Reading your source notes', 'Parsing your material preferences', 'Capturing your reference criteria'],
      ['Analyzing your learning sources', 'Scanning source coverage & depth', 'Extracting core concepts from materials'],
      ['Connecting sources to your study goal', 'Mapping readings to practical milestones', 'Identifying high-signal sections'],
      ['Structuring source-backed takeaways', 'Organizing reference highlights', 'Weighing source difficulty'],
      ['Drafting tailored response', 'Synthesizing source insights', 'Preparing your study breakdown'],
    ];
  } else {
    pool = [
      ['Processing your query', 'Reading your message', 'Tuning in to your question', 'Unpacking your thought'],
      [
        shortTopic ? `Mapping concepts around ${shortTopic}` : 'Mapping your learning pathway',
        'Exploring foundational mental models',
        'Structuring a clear learning arc',
        'Identifying high-impact subtopics',
      ],
      ['Connecting theory to hands-on practice', 'Sequencing milestones from basics up', 'Curating practical study angles'],
      ['Tailoring depth & weekly rhythm', 'Calibrating examples to your goal', 'Sharpening key takeaways'],
      ['Drafting tailored response', 'Putting together your learning plan', 'Weaving everything into a clear reply'],
    ];
  }

  let stageIndices: number[];
  if (count === 2) {
    stageIndices = [0, 4];
  } else if (count === 3) {
    stageIndices = [0, 1, 4];
  } else if (count === 4) {
    stageIndices = [0, 1, 2, 4];
  } else {
    stageIndices = [0, 1, 2, 3, 4];
  }

  const runningIdx = Math.min(Math.max(0, activePhaseIndex), stageIndices.length - 1);

  return stageIndices.map((poolIdx, idx) => {
    const label = pickFrom(pool[poolIdx], seed, idx + 1);
    const state: ChatProgressStep['state'] =
      idx < runningIdx ? 'complete' : idx === runningIdx ? 'running' : 'pending';
    return {
      id: `turn-step-${idx}`,
      label,
      state,
    };
  });
}

export interface VariedSearchSummaryOptions {
  goal?: string;
  step?: string;
  status?: string;
  matchCount: number;
  intentVersion?: number;
  isSearching: boolean;
}

export function buildVariedSearchSummary({
  goal,
  step,
  status,
  matchCount,
  intentVersion = 0,
  isSearching,
}: VariedSearchSummaryOptions): string | null {
  if (isSearching) return null;
  const topicLabel = goal?.trim() || 'your learning goal';
  const seed = hashSeed(`summary::${topicLabel.toLowerCase()}::${step ?? ''}::${status ?? ''}::${matchCount}::${intentVersion}`);

  if (step === 'recommendations') {
    if (status === 'failed') {
      const failedTemplates = [
        `I hit a snag while checking public cohorts for **${topicLabel}**. I’ve opened the studio panel on the right so you can retry the search or jump straight into **Create your own cohort**.`,
        `I couldn’t finish searching public cohorts for **${topicLabel}** just now. You can retry from the right-hand panel or click **Create your own cohort** to start building right away.`,
        `Our cohort directory didn’t respond in time for **${topicLabel}**, so I’ve opened the studio on the right — feel free to retry the search or spin up your own custom cohort!`,
        `Something interrupted the cohort lookup for **${topicLabel}**. No worries — the workspace on the right is open so you can retry or click **Create your own cohort** to design your own plan.`,
      ];
      return pickFrom(failedTemplates, seed);
    }

    if (matchCount > 0) {
      const noun = matchCount === 1 ? 'cohort' : 'cohorts';
      const pron = matchCount === 1 ? 'it' : 'them';
      const matchTemplates = [
        `I found **${matchCount}** matching community ${noun} for **${topicLabel}** and lined ${pron} up on the right. Browse the matches to join one, or click **Create your own cohort** to craft a custom syllabus.`,
        `Good news — there ${matchCount === 1 ? 'is' : 'are'} **${matchCount}** active community ${noun} around **${topicLabel}**! Check ${pron} out in the right panel, or hit **Create your own cohort** if you want a tailored plan.`,
        `I’ve pulled up **${matchCount}** public ${noun} related to **${topicLabel}** on the right. You can hop into an existing group or click **Create your own cohort** to build from scratch.`,
        `We spotted **${matchCount}** community ${noun} exploring **${topicLabel}**! Take a look on the right to see if the pacing fits, or choose **Create your own cohort** to design your own journey.`,
        `I scanned our directory for **${topicLabel}** and found **${matchCount}** matching ${noun} (now open on the right). Join a group that resonates, or start fresh with **Create your own cohort**.`,
        `There ${matchCount === 1 ? 'is' : 'are'} **${matchCount}** peer ${noun} for **${topicLabel}** ready to explore on the right. Feel free to join ${pron}, or tell me here how you’d like to customize your own cohort!`,
      ];
      return pickFrom(matchTemplates, seed);
    }

    const zeroMatchTemplates = [
      `I searched our public cohorts for **${topicLabel}**, and no matching community cohorts exist yet. I’ve opened the studio on the right — click **Create your own cohort** (or tell me here how you’d like to start) to launch the first one!`,
      `No one has launched a public cohort for **${topicLabel}** yet — which means you get to pioneer it! Use **Create your own cohort** on the right, or tell me your goals here and we’ll sketch the syllabus together.`,
      `I checked our active directory for **${topicLabel}** and came up empty on existing groups. I’ve popped open the builder on the right so you can click **Create your own cohort** and shape a custom study plan.`,
      `It looks like **${topicLabel}** is fresh territory in our community cohorts! Head over to the panel on the right and hit **Create your own cohort**, or reply here with what you want to cover first.`,
      `We don’t have a live community cohort for **${topicLabel}** right now, so I’ve set up the studio on the right for you. Click **Create your own cohort** to kick one off — or ask me to draft a learning roadmap here!`,
      `Zero public cohorts matched **${topicLabel}** so far. Let’s build one tailored to you: click **Create your own cohort** on the right canvas, or share your background here to get started.`,
      `I scanned our community cohorts for **${topicLabel}**, and none are running yet. You can be the first — click **Create your own cohort** on the right or tell me what materials and goals you have in mind!`,
      `No active cohorts matched **${topicLabel}** today, so I opened the studio canvas on the right. Hit **Create your own cohort** to design your own track, or chat with me here to brainstorm modules!`,
    ];
    return pickFrom(zeroMatchTemplates, seed);
  }

  const studioOpenedTemplates = [
    `I’ve opened the cohort studio on the right for **${topicLabel}**. Choose your starting point on the canvas or tell me what materials and goals you have in mind!`,
    `Your cohort studio for **${topicLabel}** is live on the right! Pick a starting path on the canvas, or tell me here how you’d like to structure your learning.`,
    `We checked existing cohorts for **${topicLabel}** and opened your builder workspace on the right. Select how you want to begin on the canvas, or chat with me here to shape your plan!`,
    `I’ve set up the studio canvas on the right for **${topicLabel}**. You can bring your own sources, let us find materials, or ask me here to sketch an initial roadmap.`,
    `Ready to build your **${topicLabel}** cohort! Use the studio controls on the right to pick your starting point, or tell me about your background and timeline right here.`,
  ];
  return pickFrom(studioOpenedTemplates, seed);
}

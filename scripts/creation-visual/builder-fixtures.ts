import type { CohortWorkspace, CohortLesson, CohortChunk } from '@/src/shared/cohort-builder/contracts';
import { initialCohort } from '@/src/shared/cohort-builder/intake';

export const builderIntakeDraft = {
  requestId: '68b92a9b-7104-466f-a7b4-0cb900b0a783',
  prompt: "I have a 56-hour course I've been meaning to finish for months.",
  source: {
    label: 'Distributed Systems Architecture Guide',
    text: 'Designing distributed systems requires understanding consensus quorums, partitions, and replication logs. Quorums overlap so that a read quorum and write quorum always share at least one node.',
  },
};

export const builderWorkspaceEmpty: CohortWorkspace = initialCohort('System Design from First Principles');

export const builderWorkspaceProcessing: CohortWorkspace = {
  ...initialCohort('System Design from First Principles'),
  sources: [
    {
      id: 'source-1',
      version: 0,
      label: 'Distributed Systems Architecture Guide',
      text: 'Quorums overlap. Logs retain writes. A write quorum and read quorum must intersect on at least one node to guarantee freshness.',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      state: 'processing',
    },
  ],
  processing: {
    status: 'processing',
    stage: 'chunking',
    generation: 1,
    sourceFingerprint: 'f1a2b3c4',
    error: null,
    driver: 'durable',
    jobs: [
      {
        id: 'job-1',
        sourceId: 'source-1',
        stage: 'understanding',
        status: 'accepted',
        attempts: 1,
        error: null,
        retryable: false,
      },
      {
        id: 'job-2',
        sourceId: 'source-1',
        stage: 'chunking',
        status: 'running',
        attempts: 1,
        error: null,
        retryable: false,
      },
    ],
  },
};

const chunk1: CohortChunk = {
  id: 'chunk-0',
  sourceId: 'source-1',
  sourceVersion: 0,
  start: 0,
  end: 98,
  text: 'Quorums overlap. A write quorum and read quorum must intersect on at least one node to guarantee freshness.',
  checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
};

const chunk2: CohortChunk = {
  id: 'chunk-1',
  sourceId: 'source-1',
  sourceVersion: 0,
  start: 100,
  end: 185,
  text: 'Availability requires multi-region active clusters with asynchronous replication logs.',
  checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
};

const lesson1: CohortLesson = {
  id: 'lesson-0',
  version: 0,
  title: 'Understanding Distributed Systems and Consensus',
  objective: 'Explain why quorums must overlap to guarantee read freshness in partitioned environments.',
  pinned: true,
  sourceChunkIds: ['chunk-0'],
};

const lesson2: CohortLesson = {
  id: 'lesson-1',
  version: 0,
  title: 'Designing for High Availability and Partition Tolerance',
  objective: 'Analyze failure recovery and the tradeoffs between strong consistency and low-latency availability.',
  pinned: false,
  sourceChunkIds: ['chunk-1'],
};

const lesson3: CohortLesson = {
  id: 'lesson-2',
  version: 0,
  title: 'Choosing Consistency Guarantees in Practice',
  objective: 'Evaluate linearizability versus eventual and causal consistency for distributed financial records.',
  pinned: false,
  sourceChunkIds: [],
};

export const builderWorkspaceCurriculum: CohortWorkspace = {
  ...initialCohort('System Design from First Principles'),
  sources: [
    {
      id: 'source-1',
      version: 0,
      label: 'Distributed Systems Architecture Guide',
      text: 'Quorums overlap. Logs retain writes. A write quorum and read quorum must intersect on at least one node to guarantee freshness.',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      state: 'ready',
    },
  ],
  chunks: [chunk1, chunk2],
  processing: {
    status: 'ready',
    stage: 'done',
    generation: 1,
    sourceFingerprint: 'f1a2b3c4',
    error: null,
    driver: 'durable',
    jobs: [
      { id: 'job-1', sourceId: 'source-1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
      { id: 'job-2', sourceId: 'source-1', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
      { id: 'job-3', sourceId: 'source-1', stage: 'analysis', status: 'accepted', attempts: 1, error: null, retryable: false },
      { id: 'job-4', sourceId: 'source-1', stage: 'assembly', status: 'accepted', attempts: 1, error: null, retryable: false },
    ],
  },
  lessons: [lesson1, lesson2, lesson3],
};

export const builderWorkspaceReview: CohortWorkspace = {
  ...builderWorkspaceCurriculum,
  release: {
    status: 'draft',
    mode: 'private_activation',
  },
};

export const builderChatMessages = [
  {
    id: 'msg-1',
    role: 'user',
    parts: [
      { type: 'text', text: 'Help me understand how quorums and replication intersect.' },
    ],
    createdAt: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: 'msg-2',
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text: 'I have analyzed the distributed systems guide and structured a 3-part curriculum. I have grounded Lesson 1 in your source notes on quorum overlap.',
      },
      {
        type: 'entity_ref',
        entity: {
          type: 'lesson',
          id: 'lesson-0',
          version: 0,
        },
        label: 'Understanding Distributed Systems and Consensus',
      },
    ],
    createdAt: new Date().toISOString(),
  },
];

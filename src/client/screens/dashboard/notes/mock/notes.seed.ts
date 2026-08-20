import type { NoteDocument, NotebookEntity, NotesStateEntity } from '../models/notes.models';

const now = new Date('2026-07-01T12:00:00.000Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
const notebookNames = [
  ['nb-ml', 'Machine Learning', 'Optimization, neural networks, architecture notes', '#4f46e5'],
  ['nb-system', 'System Design', 'Scalable backend and reliability patterns', '#ef4444'],
  ['nb-psych', 'Psychology', 'Cognitive models and behavior design', '#f97316'],
  ['nb-rust', 'Rust', 'Ownership, async systems, and crates', '#22c55e'],
  ['nb-ds', 'Data Structures', 'Algorithms and implementation sketches', '#eab308'],
  ['nb-german', 'German', 'Vocabulary, grammar, and practice logs', '#3b82f6'],
  ['nb-pk', 'Personal Knowledge', 'Maps of ideas, principles, and decisions', '#8b5cf6'],
  ['nb-startups', 'Startup Ideas', 'Market notes, experiments, and pitches', '#ec4899'],
  ['nb-reading', 'Reading Notes', 'Book summaries and marginalia', '#14b8a6'],
] as const;

const titles: Record<string, string[]> = {
  'nb-ml': ['Optimization', 'Neural Networks', 'CNN', 'Attention', 'Transformers'],
  'nb-system': ['Load Balancing', 'Queues and Backpressure', 'Caching', 'Database Sharding'],
  'nb-psych': ['Cognitive Biases', 'Motivation Loops', 'Memory Palaces'],
  'nb-rust': ['Borrow Checker', 'Async Runtime', 'Error Handling'],
  'nb-ds': ['Hash Tables', 'Graph Traversal', 'Heaps'],
  'nb-german': ['Cases', 'Daily Phrases', 'Verb Prefixes'],
  'nb-pk': ['Decision Journal', 'Learning Flywheel', 'Principles'],
  'nb-startups': ['AI Tutor', 'Community CRM', 'Founder Notes'],
  'nb-reading': [
    'The Beginning of Infinity',
    'Designing Data-Intensive Applications',
    'Atomic Habits',
  ],
};

export const seedNotebooks: NotebookEntity[] = notebookNames.map(
  ([id, title, description, color], order) => ({
    id,
    title,
    description,
    color,
    order,
    collapsed: id !== 'nb-ml',
    favorite: order % 4 === 0,
    shared: order === 1 || order === 8,
    archived: false,
    createdAt: daysAgo(40 - order),
    updatedAt: daysAgo(order + 1),
  }),
);

export const seedNotes: NoteDocument[] = Object.entries(titles).flatMap(
  ([notebookId, list], nbIndex) =>
    list.map((title, order) => ({
      id: `${notebookId}-note-${order}`,
      notebookId,
      title,
      order,
      tags: [title.toLowerCase().split(' ')[0], nbIndex % 2 ? 'systems' : 'learning'],
      favorite: order === 0 && nbIndex % 2 === 0,
      shared: nbIndex === 1 || (notebookId === 'nb-reading' && order === 1),
      archived: false,
      publicLink: false,
      permission: 'editor',
      sharedWith: nbIndex === 1 ? ['maya@sidequesthq.com'] : [],
      createdAt: daysAgo(30 - nbIndex - order),
      updatedAt: daysAgo(order + nbIndex),
      contentType: 'canvas',
      ownerId: null,
      linkedConceptIds: [],
      linkedResourceIds: [],
      learningPathId: null,
      revision: null,
    })),
);

export const seedNotesState: NotesStateEntity = {
  notebooks: seedNotebooks,
  notes: seedNotes,
  selectedNotebookId: null,
  selectedNoteId: null,
  notebookSort: 'manual',
  noteSort: 'manual',
  filter: 'all',
};

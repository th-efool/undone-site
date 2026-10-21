export interface UnifiedTask {
  id: string;
  title: string;
  subtitle?: string;
  category?: string;
  year: number;
  month: number; // 0-indexed: 0 = January, 7 = August, 9 = October
  day: number;
  dateStr?: string;
  timeStr?: string;
  endTimeStr?: string;
  tone?: 'blue' | 'purple' | 'orange' | 'green' | 'yellow' | 'red';
  color?: string;
  status: 'pending' | 'completed';
  noteId?: string;
  createdAt: number;
}

export const TONE_TO_HEX: Record<string, string> = {
  blue: '#3b82f6',
  purple: '#a855f7',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
};

export const HEX_TO_TONE: Record<string, 'blue' | 'purple' | 'orange' | 'green' | 'yellow' | 'red'> = {
  '#3b82f6': 'blue',
  '#a855f7': 'purple',
  '#22c55e': 'green',
  '#eab308': 'yellow',
  '#f97316': 'orange',
  '#ef4444': 'red',
};

const INITIAL_UNIFIED_TASKS: UnifiedTask[] = [
  // October 2026 (Studyroom Tasks & Goal & Notes & Home)
  {
    id: 'task-oct-20-1',
    title: 'Review system design fundamentals',
    subtitle: 'System Architecture',
    category: 'System Design',
    year: 2026,
    month: 9, // October
    day: 20,
    dateStr: 'Oct 20',
    timeStr: '10:00 AM',
    endTimeStr: '11:30 AM',
    tone: 'blue',
    color: '#3b82f6',
    status: 'pending',
    createdAt: 1729418400000,
  },
  {
    id: 'task-oct-20-2',
    title: 'Read 20 pages',
    subtitle: 'Designing Data-Intensive Applications',
    category: 'Reading',
    year: 2026,
    month: 9,
    day: 20,
    dateStr: 'Oct 20',
    timeStr: '2:00 PM',
    endTimeStr: '3:00 PM',
    tone: 'purple',
    color: '#a855f7',
    status: 'pending',
    createdAt: 1729422000000,
  },
  {
    id: 'task-oct-20-3',
    title: 'Solve 3 LeetCode problems',
    subtitle: 'Graphs & Dynamic Programming',
    category: 'Programming',
    year: 2026,
    month: 9,
    day: 20,
    dateStr: 'Oct 20',
    timeStr: '4:30 PM',
    endTimeStr: '5:45 PM',
    tone: 'green',
    color: '#22c55e',
    status: 'pending',
    createdAt: 1729425600000,
  },
  {
    id: 'task-oct-20-4',
    title: 'Write summary notes',
    subtitle: 'Distributed Caching Strategy',
    category: 'Notes',
    year: 2026,
    month: 9,
    day: 20,
    dateStr: 'Oct 20',
    timeStr: '6:30 PM',
    endTimeStr: '7:15 PM',
    tone: 'yellow',
    color: '#eab308',
    status: 'pending',
    createdAt: 1729429200000,
  },
  {
    id: 'task-oct-20-5',
    title: 'Watch DB indexing video',
    subtitle: 'B-Trees vs LSM-Trees',
    category: 'Database',
    year: 2026,
    month: 9,
    day: 20,
    dateStr: 'Oct 20',
    timeStr: '8:00 PM',
    endTimeStr: '8:45 PM',
    tone: 'orange',
    color: '#f97316',
    status: 'pending',
    createdAt: 1729432800000,
  },
  // Additional October 2026 tasks
  {
    id: 'task-oct-6-1',
    title: 'Frontend Architecture Review',
    subtitle: 'Performance & Web Vitals',
    category: 'Architecture',
    year: 2026,
    month: 9,
    day: 6,
    dateStr: 'Oct 6',
    timeStr: '9:00 AM',
    endTimeStr: '10:00 AM',
    tone: 'blue',
    color: '#3b82f6',
    status: 'completed',
    createdAt: 1728208800000,
  },
  {
    id: 'task-oct-7-1',
    title: 'TypeScript Generics Workshop',
    subtitle: 'Advanced Type Utilities',
    category: 'Programming',
    year: 2026,
    month: 9,
    day: 7,
    dateStr: 'Oct 7',
    timeStr: '11:00 AM',
    endTimeStr: '12:00 PM',
    tone: 'yellow',
    color: '#eab308',
    status: 'completed',
    createdAt: 1728295200000,
  },
  {
    id: 'task-oct-14-1',
    title: 'API Gateway Design Review',
    subtitle: 'Rate Limiting & Auth Tokens',
    category: 'System Design',
    year: 2026,
    month: 9,
    day: 14,
    dateStr: 'Oct 14',
    timeStr: '3:00 PM',
    endTimeStr: '4:00 PM',
    tone: 'blue',
    color: '#3b82f6',
    status: 'completed',
    createdAt: 1728900000000,
  },
  {
    id: 'task-oct-21-1',
    title: 'Sprint Focus Session',
    subtitle: 'Undone Milestone Deep Work',
    category: 'General',
    year: 2026,
    month: 9,
    day: 21,
    dateStr: 'Oct 21',
    timeStr: '10:00 AM',
    endTimeStr: '11:30 AM',
    tone: 'blue',
    color: '#3b82f6',
    status: 'pending',
    createdAt: 1729504800000,
  },
  {
    id: 'task-oct-22-1',
    title: 'Database Sharding & Replication',
    subtitle: 'Primary-Replica Setup',
    category: 'Database',
    year: 2026,
    month: 9,
    day: 22,
    dateStr: 'Oct 22',
    timeStr: '4:00 PM',
    endTimeStr: '5:00 PM',
    tone: 'blue',
    color: '#94a3b8',
    status: 'pending',
    createdAt: 1729591200000,
  },
  {
    id: 'task-oct-24-1',
    title: 'React 19 Server Components Deep Dive',
    subtitle: 'Streaming SSR & Transitions',
    category: 'Frontend',
    year: 2026,
    month: 9,
    day: 24,
    dateStr: 'Oct 24',
    timeStr: '1:00 PM',
    endTimeStr: '2:30 PM',
    tone: 'purple',
    color: '#94a3b8',
    status: 'pending',
    createdAt: 1729764000000,
  },
  {
    id: 'task-oct-29-1',
    title: 'End-to-End Testing Workshop',
    subtitle: 'Playwright Realtime Tests',
    category: 'QA',
    year: 2026,
    month: 9,
    day: 29,
    dateStr: 'Oct 29',
    timeStr: '5:00 PM',
    endTimeStr: '6:30 PM',
    tone: 'blue',
    color: '#3b82f6',
    status: 'pending',
    createdAt: 1730196000000,
  },

  // August 2026 (Home UpcomingEvents)
  {
    id: 'e1',
    title: 'Frontend Architecture Review',
    subtitle: 'Performance & Web Vitals',
    category: 'Architecture',
    year: 2026,
    month: 7, // August
    day: 6,
    dateStr: 'Aug 6',
    timeStr: '9:00 AM',
    endTimeStr: '10:00 AM',
    tone: 'blue',
    color: '#3b82f6',
    status: 'pending',
    createdAt: 1722934800000,
  },
  {
    id: 'e2',
    title: 'System Design Interview Prep',
    subtitle: 'Distributed Caching',
    category: 'System Design',
    year: 2026,
    month: 7,
    day: 6,
    dateStr: 'Aug 6',
    timeStr: '1:00 PM',
    endTimeStr: '1:30 PM',
    tone: 'orange',
    color: '#f97316',
    status: 'pending',
    createdAt: 1722949200000,
  },
  {
    id: 'e3',
    title: 'Open Source Contribution Hour',
    subtitle: 'Triage & Issue Hunting',
    category: 'Open Source',
    year: 2026,
    month: 7,
    day: 6,
    dateStr: 'Aug 6',
    timeStr: '4:00 PM',
    endTimeStr: '5:00 PM',
    tone: 'blue',
    color: '#3b82f6',
    status: 'pending',
    createdAt: 1722960000000,
  },
  {
    id: 'e4',
    title: 'Read: Designing Data-Intensive...',
    subtitle: 'Chapter 3',
    category: 'Reading',
    year: 2026,
    month: 7,
    day: 6,
    dateStr: 'Aug 6',
    timeStr: '8:00 PM',
    endTimeStr: '8:30 PM',
    tone: 'blue',
    color: '#3b82f6',
    status: 'pending',
    createdAt: 1722974400000,
  },
  {
    id: 'e5',
    title: 'Distributed Caching Deep Dive',
    subtitle: 'System Architecture',
    category: 'System Design',
    year: 2026,
    month: 7,
    day: 12,
    dateStr: 'Aug 12',
    timeStr: '6:30 PM',
    endTimeStr: '7:30 PM',
    tone: 'blue',
    color: '#3b82f6',
    status: 'pending',
    createdAt: 1723487400000,
  },
  {
    id: 'e6',
    title: 'Open Source Contribution Hour',
    subtitle: 'Triage & Issue Hunting',
    category: 'Open Source',
    year: 2026,
    month: 7,
    day: 19,
    dateStr: 'Aug 19',
    timeStr: '10:00 AM',
    endTimeStr: '11:00 AM',
    tone: 'blue',
    color: '#3b82f6',
    status: 'pending',
    createdAt: 1724061600000,
  },
  {
    id: 'e7',
    title: 'Algorithm Deep Dive',
    subtitle: 'Dynamic Programming Patterns',
    category: 'Programming',
    year: 2026,
    month: 7,
    day: 25,
    dateStr: 'Aug 25',
    timeStr: '8:00 PM',
    endTimeStr: '9:00 PM',
    tone: 'blue',
    color: '#3b82f6',
    status: 'pending',
    createdAt: 1724616000000,
  },
  {
    id: 'e8',
    title: 'Cloud Native Deployment',
    subtitle: 'Kubernetes Workshop',
    category: 'DevOps',
    year: 2026,
    month: 7,
    day: 27,
    dateStr: 'Aug 27',
    timeStr: '2:00 PM',
    endTimeStr: '3:30 PM',
    tone: 'blue',
    color: '#3b82f6',
    status: 'pending',
    createdAt: 1724767200000,
  },
  {
    id: 'e9',
    title: 'Hackathon Kickoff',
    subtitle: 'Team Formation',
    category: 'Hackathon',
    year: 2026,
    month: 7,
    day: 28,
    dateStr: 'Aug 28',
    timeStr: '9:00 AM',
    endTimeStr: '10:30 AM',
    tone: 'orange',
    color: '#f97316',
    status: 'pending',
    createdAt: 1724835600000,
  },
  {
    id: 'e10',
    title: 'AI Prompt Engineering',
    subtitle: 'Hands-on Lab',
    category: 'AI',
    year: 2026,
    month: 7,
    day: 29,
    dateStr: 'Aug 29',
    timeStr: '11:00 AM',
    endTimeStr: '12:00 PM',
    tone: 'blue',
    color: '#3b82f6',
    status: 'pending',
    createdAt: 1724929200000,
  },

  // July 2026
  {
    id: 'e-j1',
    title: 'Mid-Year Engineering Retrospective',
    subtitle: 'Roadmap & Milestones',
    category: 'General',
    year: 2026,
    month: 6, // July
    day: 15,
    dateStr: 'Jul 15',
    timeStr: '11:00 AM',
    endTimeStr: '12:30 PM',
    tone: 'blue',
    color: '#3b82f6',
    status: 'completed',
    createdAt: 1721041200000,
  },
  {
    id: 'e-j2',
    title: 'Rust Concurrency Sprint',
    subtitle: 'Channels & Mutexes',
    category: 'Programming',
    year: 2026,
    month: 6,
    day: 22,
    dateStr: 'Jul 22',
    timeStr: '3:00 PM',
    endTimeStr: '4:30 PM',
    tone: 'orange',
    color: '#f97316',
    status: 'completed',
    createdAt: 1721646000000,
  },

  // September 2026
  {
    id: 'e-s1',
    title: 'Autumn Cohort Launch',
    subtitle: 'Orientation & Networking',
    category: 'Cohort',
    year: 2026,
    month: 8, // September
    day: 4,
    dateStr: 'Sep 4',
    timeStr: '10:00 AM',
    endTimeStr: '11:30 AM',
    tone: 'orange',
    color: '#f97316',
    status: 'pending',
    createdAt: 1725444000000,
  },
  {
    id: 'e-s2',
    title: 'Distributed Storage Consensus',
    subtitle: 'Raft Paper Walkthrough',
    category: 'System Design',
    year: 2026,
    month: 8,
    day: 16,
    dateStr: 'Sep 16',
    timeStr: '2:00 PM',
    endTimeStr: '3:30 PM',
    tone: 'blue',
    color: '#3b82f6',
    status: 'pending',
    createdAt: 1726480800000,
  },
  {
    id: 'e-s3',
    title: 'Full-Stack Performance Audits',
    subtitle: 'Serverless Latency Triage',
    category: 'Engineering',
    year: 2026,
    month: 8,
    day: 24,
    dateStr: 'Sep 24',
    timeStr: '5:00 PM',
    endTimeStr: '6:00 PM',
    tone: 'purple',
    color: '#a855f7',
    status: 'pending',
    createdAt: 1727175600000,
  },
];

const STORAGE_KEY = 'sidequest_unified_tasks_v1';
const EVENT_NAME = 'sidequest:tasks-updated';

let inMemoryTasks: UnifiedTask[] | null = null;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error('Task subscriber error:', e);
    }
  });
}

function initWindowListeners() {
  if (typeof window === 'undefined') return;

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        inMemoryTasks = JSON.parse(e.newValue);
        notifySubscribers();
      } catch {}
    }
  };

  const handleCustom = () => {
    notifySubscribers();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(EVENT_NAME, handleCustom);
}

// Initialize once in browser
if (typeof window !== 'undefined') {
  initWindowListeners();
}

export const tasksStorageAdapter = {
  getTasks(): UnifiedTask[] {
    if (inMemoryTasks) {
      return inMemoryTasks;
    }

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            inMemoryTasks = parsed;
            return parsed;
          }
        }
      } catch {}
    }

    inMemoryTasks = structuredClone(INITIAL_UNIFIED_TASKS);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryTasks));
      } catch {}
    }
    return inMemoryTasks;
  },

  getServerSnapshot(): UnifiedTask[] {
    return INITIAL_UNIFIED_TASKS;
  },

  saveTasks(tasks: UnifiedTask[]): void {
    inMemoryTasks = [...tasks];
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        window.dispatchEvent(new CustomEvent(EVENT_NAME));
      } catch (e) {
        console.error('Failed to save unified tasks to localStorage:', e);
      }
    }
    notifySubscribers();
  },

  addTask(partial: Omit<UnifiedTask, 'id' | 'createdAt'> & { id?: string; createdAt?: number }): UnifiedTask {
    const current = this.getTasks();
    const id = partial.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = partial.createdAt || Date.now();
    const color = partial.color || (partial.tone ? TONE_TO_HEX[partial.tone] : '#3b82f6');
    const tone = partial.tone || (partial.color ? HEX_TO_TONE[partial.color] : 'blue');

    const newTask: UnifiedTask = {
      ...partial,
      id,
      color,
      tone,
      createdAt,
    };

    const updated = [newTask, ...current];
    this.saveTasks(updated);
    return newTask;
  },

  updateTask(id: string, updates: Partial<UnifiedTask>): void {
    const current = this.getTasks();
    const index = current.findIndex((t) => t.id === id);
    if (index === -1) return;

    const existing = current[index];
    const color = updates.color || (updates.tone ? TONE_TO_HEX[updates.tone] : existing.color);
    const tone = updates.tone || (updates.color ? HEX_TO_TONE[updates.color] : existing.tone);

    const merged: UnifiedTask = {
      ...existing,
      ...updates,
      color,
      tone,
    };

    const updated = [...current];
    updated[index] = merged;
    this.saveTasks(updated);
  },

  toggleTask(id: string): void {
    const current = this.getTasks();
    const task = current.find((t) => t.id === id);
    if (!task) return;
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    this.updateTask(id, { status: nextStatus });
  },

  removeTask(id: string): void {
    const current = this.getTasks();
    const updated = current.filter((t) => t.id !== id);
    this.saveTasks(updated);
  },

  subscribe(callback: () => void): () => void {
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  },

  resetToDefault(): void {
    inMemoryTasks = structuredClone(INITIAL_UNIFIED_TASKS);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryTasks));
        window.dispatchEvent(new CustomEvent(EVENT_NAME));
      } catch {}
    }
    notifySubscribers();
  },
};

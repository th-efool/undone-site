import mongoose, { Schema, Document } from 'mongoose';

// 1. The TypeScript Interfaces
export interface ICanvas {
  id: string; // Excalidraw's internal ID
  elements: any[]; // The drawing data (too complex to strictly type)
  appState: Record<string, any>; // Camera zoom, scroll, etc.
  updatedAt: Date;
}

export interface INotebook {
  id: string;
  title: string;
  description?: string;
  color?: string;
  favorite: boolean;
  shared: boolean;
  archived: boolean;
  collapsed: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface INote {
  id: string;
  title: string;
  content: string; // Markdown or rich text
  notebookId?: string;
  ownerId?: string;
  permission?: string;
  sharedWith?: string[];
  publicLink?: string;
  tags?: string[];
  favorite?: boolean;
  shared?: boolean;
  archived?: boolean;
  order?: number;
  contentType?: 'canvas' | 'kanban' | 'markdown';
  kanbanColumns?: any[];
  kanbanCards?: any[];
  elements?: any[];
  appState?: Record<string, any>;
  updatedAt: Date;
}

export interface ITask {
  id: string;
  noteId?: string;
  title?: string;
  label?: string;
  description?: string;
  dueDate?: Date;
  status?: string;
  priority?: string;
}

export interface IWorkspaceSettings {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
}

// The main document interface
export interface IUserWorkspace extends Document {
  userId: string; // References the Postgres User ID
  settings: IWorkspaceSettings;
  canvases: ICanvas[];
  notebooks: INotebook[];
  notes: INote[];
  tasks: ITask[];
  aiMemory: Record<string, any>; // Flexible JSON for AI state
  recentViews: string[]; // IDs of recently viewed lessons/cohorts
  createdAt: Date;
  updatedAt: Date;
}

// 2. The Mongoose Schemas
const CanvasSchema = new Schema<ICanvas>({
  id: { type: String, required: true },
  elements: { type: Schema.Types.Mixed, default: [] }, // Mixed = "Accept any JSON"
  appState: { type: Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false }); // We use Excalidraw's ID, we don't need a Mongo ObjectId here

const NotebookSchema = new Schema<INotebook>({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  color: { type: String },
  favorite: { type: Boolean, default: false },
  shared: { type: Boolean, default: false },
  archived: { type: Boolean, default: false },
  collapsed: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const NoteSchema = new Schema<INote>({
  id: { type: String, required: true },
  title: { type: String, default: 'Untitled Note' },
  content: { type: String, default: '' },
  notebookId: { type: String },
  ownerId: { type: String },
  permission: { type: String },
  sharedWith: { type: [String], default: [] },
  publicLink: { type: String },
  tags: { type: [String], default: [] },
  favorite: { type: Boolean, default: false },
  shared: { type: Boolean, default: false },
  archived: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  contentType: { type: String, enum: ['canvas', 'kanban', 'markdown'] },
  kanbanColumns: { type: Schema.Types.Mixed, default: [] },
  kanbanCards: { type: Schema.Types.Mixed, default: [] },
  elements: { type: Schema.Types.Mixed, default: [] },
  appState: { type: Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const TaskSchema = new Schema<ITask>({
  id: { type: String, required: true },
  noteId: { type: String },
  title: { type: String },
  label: { type: String },
  description: { type: String },
  dueDate: { type: Date },
  status: { type: String },
  priority: { type: String }
}, { _id: false });

const WorkspaceSettingsSchema = new Schema<IWorkspaceSettings>({
  theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
  sidebarOpen: { type: Boolean, default: true }
}, { _id: false });

const UserWorkspaceSchema = new Schema<IUserWorkspace>({
  userId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true // Creates a fast lookup B-Tree index for this field
  },
  settings: { type: WorkspaceSettingsSchema, default: () => ({}) },
  canvases: { type: [CanvasSchema], default: [] },
  notebooks: { type: [NotebookSchema], default: [] },
  notes: { type: [NoteSchema], default: [] },
  tasks: { type: [TaskSchema], default: [] },
  aiMemory: { type: Schema.Types.Mixed, default: {} },
  recentViews: { type: [String], default: [] }
}, {
  timestamps: true, // Automatically manages createdAt and updatedAt
});

// 3. The "Next.js Hot Reload" Model Registration
export const UserWorkspace = mongoose.models.UserWorkspace || mongoose.model<IUserWorkspace>('UserWorkspace', UserWorkspaceSchema);

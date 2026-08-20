import mongoose, { Schema, Document } from 'mongoose';

// 1. The TypeScript Interfaces
export interface ICanvas {
  id: string; // Excalidraw's internal ID
  elements: any[]; // The drawing data (too complex to strictly type)
  appState: Record<string, any>; // Camera zoom, scroll, etc.
  updatedAt: Date;
}

export interface INote {
  id: string;
  title: string;
  content: string; // Markdown or rich text
  updatedAt: Date;
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
  notes: INote[];
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

const NoteSchema = new Schema<INote>({
  id: { type: String, required: true },
  title: { type: String, default: 'Untitled Note' },
  content: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
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
  notes: { type: [NoteSchema], default: [] },
  aiMemory: { type: Schema.Types.Mixed, default: {} },
  recentViews: { type: [String], default: [] }
}, {
  timestamps: true, // Automatically manages createdAt and updatedAt
});

// 3. The "Next.js Hot Reload" Model Registration
export const UserWorkspace = mongoose.models.UserWorkspace || mongoose.model<IUserWorkspace>('UserWorkspace', UserWorkspaceSchema);

export type SerializedScene = string;

export type CanvasDocument = {
  noteId: string;
  scene: SerializedScene;
  schemaVersion: number;
  savedAt: string;
};

export type CanvasSceneData = {
  elements: readonly unknown[];
  appState: {
    viewBackgroundColor: string;
    theme: 'light' | 'dark';
  };
  files: Record<string, unknown>;
};

export type CanvasStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export type CanvasState = {
  status: CanvasStatus;
  lastSavedAt: string | null;
  isDirty: boolean;
  errorMessage: string | null;
};

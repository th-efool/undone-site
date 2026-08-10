import type { CanvasDocument } from '../models/canvas.models';

export const seedCanvasData: CanvasDocument = {
  noteId: 'nb-ml-note-0',
  schemaVersion: 1,
  savedAt: new Date().toISOString(),
  scene: JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'sidequesthq',
    elements: [],
    appState: {
      viewBackgroundColor: '#000000',
      theme: 'dark',
      gridSize: 20,
    },
    files: {},
  }),
};

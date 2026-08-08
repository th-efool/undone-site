import type { CanvasDocument, CanvasSceneData, SerializedScene } from '../models/canvas.models';

export const CANVAS_SCHEMA_VERSION = 1;

export const canvasAdapter = {
  serialize(scene: CanvasSceneData): SerializedScene {
    try {
      const cleanScene = {
        ...scene,
        // Strip deleted elements before stringifying to prevent infinite bloat
        elements: (scene.elements as any[]).filter((el) => !el.isDeleted),
      };
      return JSON.stringify(cleanScene);
    } catch (e) {
      console.error('Failed to serialize canvas scene:', e);
      return '';
    }
  },

  deserialize(s: SerializedScene): CanvasSceneData | null {
    if (!s) return null;
    try {
      const parsed = JSON.parse(s);
      // Basic validation
      if (parsed && typeof parsed === 'object') {
        const appState = parsed.appState || {};
        const rawBg = appState.viewBackgroundColor;
        const viewBackgroundColor = (!rawBg || rawBg === '#ffffff') ? '#000000' : rawBg;
        return {
          elements: Array.isArray(parsed.elements) ? parsed.elements : [],
          appState: {
            ...appState,
            viewBackgroundColor,
            gridSize: appState.gridSize ?? 20,
            theme: 'dark',
          },
          files: parsed.files || {},
        };
      }
      return null;
    } catch (e) {
      console.error('Failed to deserialize canvas scene', e);
      return null;
    }
  },

  createEmptyScene(): CanvasSceneData {
    return {
      elements: [],
      appState: {
        viewBackgroundColor: '#000000',
        theme: 'dark',
        gridSize: 20,
      },
      files: {},
    };
  },

  stripHtml(html: string): string {
    if (typeof window === 'undefined') {
      return html.replace(/<[^>]*>?/gm, '');
    }
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  },

  migrateHtmlToCanvas(html: string): CanvasSceneData {
    const plainText = this.stripHtml(html);
    const textElement = {
      type: 'text',
      version: 1,
      versionNonce: Date.now(),
      isDeleted: false,
      id: `text-${Date.now()}`,
      fillStyle: 'hachure',
      strokeWidth: 1,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 100,
      angle: 0,
      x: 100,
      y: 100,
      strokeColor: '#000000',
      backgroundColor: 'transparent',
      width: Math.min(600, plainText.length * 8 + 20),
      height: plainText.split('\n').length * 20 + 20,
      seed: Date.now(),
      groupIds: [],
      roundness: null,
      boundElements: [],
      updated: Date.now(),
      link: null,
      locked: false,
      text: plainText,
      fontSize: 16,
      fontFamily: 1, // Virgil
      textAlign: 'left',
      verticalAlign: 'top',
      baseline: 15,
      containerId: null,
      originalText: plainText,
      lineHeight: 1.2,
    };

    return {
      elements: [textElement],
      appState: { viewBackgroundColor: '#000000', theme: 'dark', gridSize: 20 },
      files: {},
    };
  },

  migrateScene(doc: CanvasDocument, fromVersion: number, toVersion: number): CanvasDocument {
    // Currently only version 1 exists.
    if (fromVersion === toVersion) return doc;
    return { ...doc, schemaVersion: toVersion };
  },
};

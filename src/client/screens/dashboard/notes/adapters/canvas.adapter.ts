import type { CanvasDocument, CanvasSceneData, SerializedScene } from '../models/canvas.models';

export const CANVAS_SCHEMA_VERSION = 1;

const VOLATILE_APP_STATE_KEYS = new Set([
  'collaborators',
  'width',
  'height',
  'offsetLeft',
  'offsetTop',
  'name',
  'cursorButton',
  'hoveredElementIds',
  'selectedElementIds',
  'previousSelectedElementIds',
  'selectedGroupIds',
  'selectedElementsAreBeingDragged',
  'selectionElement',
  'selectedLinearElement',
  'resizingElement',
  'multiElement',
  'newElement',
  'editingElement',
  'editingTextElement',
  'editingLinearElement',
  'editingGroupId',
  'editingFrame',
  'croppingElementId',
  'activeEmbeddable',
  'startBoundElement',
  'suggestedBindings',
  'snapLines',
  'originSnapOffset',
  'frameToHighlight',
  'elementsToHighlight',
  'searchMatches',
  'followedBy',
  'userToFollow',
  'isLoading',
  'isResizing',
  'isRotating',
  'isCropping',
  'lastPointerDownWith',
  'penDetected',
  'pendingImageElementId',
  'openMenu',
  'openPopup',
  'openSidebar',
  'openDialog',
  'pasteDialog',
  'contextMenu',
  'toast',
  'errorMessage',
  'showHyperlinkPopup',
  'fileHandle',
  'scrolledOutside',
  'shouldCacheIgnoreZoom',
  'scrollX',
  'scrollY',
  'zoom',
  'activeTool',
  'currentHoveredFontFamily',
  'stats',
]);

export function sanitizeCanvasAppState(appState: unknown): Record<string, unknown> {
  if (!appState || typeof appState !== 'object') {
    return {
      viewBackgroundColor: '#000000',
      theme: 'dark',
      gridSize: 20,
    };
  }
  const raw = appState as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(raw).sort()) {
    if (VOLATILE_APP_STATE_KEYS.has(key)) continue;
    cleaned[key] = raw[key];
  }
  const rawBg = cleaned.viewBackgroundColor;
  cleaned.viewBackgroundColor = (!rawBg || rawBg === '#ffffff') ? '#000000' : rawBg;
  cleaned.gridSize = cleaned.gridSize ?? 20;
  cleaned.theme = cleaned.theme ?? 'dark';
  return cleaned;
}

export function getCanvasSceneFingerprint(scene: CanvasSceneData | null | undefined): string {
  if (!scene) return '';
  const activeElements = Array.isArray(scene.elements)
    ? (scene.elements as Array<Record<string, unknown>>)
        .filter((el) => el && !el.isDeleted)
        .map((el) => {
          const { versionNonce: _vn, updated: _up, ...rest } = el;
          return rest;
        })
    : [];
  const durableAppState = sanitizeCanvasAppState(scene.appState);
  const files = scene.files && typeof scene.files === 'object' ? scene.files : {};
  return JSON.stringify({
    elements: activeElements,
    appState: durableAppState,
    files,
  });
}

export const canvasAdapter = {
  sanitizeAppState: sanitizeCanvasAppState,
  getSceneFingerprint: getCanvasSceneFingerprint,

  serialize(scene: CanvasSceneData): SerializedScene {
    try {
      const cleanScene = {
        ...scene,
        // Strip deleted elements and volatile per-frame appState before stringifying
        elements: (scene.elements as any[]).filter((el) => !el.isDeleted),
        appState: sanitizeCanvasAppState(scene.appState),
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

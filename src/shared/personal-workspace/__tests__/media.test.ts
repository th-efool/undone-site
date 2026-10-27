import { describe, it, expect } from 'vitest';
import {
  parseDataUrl,
  getExtensionForMimeType,
  getAssetStoragePath,
  createAssetRecord,
  extractAssetsFromCanvasScene,
  extractAssetsFromKanbanCards,
  isAnimatedMedia,
  isAudioOrVideo,
  isVectorMedia,
  scheduleTaskRecordSchema,
  kanbanCardSchema,
  KanbanCard,
  ScheduleTaskRecord,
} from '../index';

describe('Media Helpers and Classification', () => {
  it('identifies animated media formats correctly', () => {
    expect(isAnimatedMedia('image/gif')).toBe(true);
    expect(isAnimatedMedia('image/apng')).toBe(true);
    expect(isAnimatedMedia('image/webp')).toBe(true);
    expect(isAnimatedMedia('image/png')).toBe(false);
    expect(isAnimatedMedia('image/jpeg')).toBe(false);
  });

  it('identifies audio and video formats correctly', () => {
    expect(isAudioOrVideo('audio/mpeg')).toBe(true);
    expect(isAudioOrVideo('audio/ogg')).toBe(true);
    expect(isAudioOrVideo('video/mp4')).toBe(true);
    expect(isAudioOrVideo('video/webm')).toBe(true);
    expect(isAudioOrVideo('image/png')).toBe(false);
  });

  it('identifies vector media correctly', () => {
    expect(isVectorMedia('image/svg+xml')).toBe(true);
    expect(isVectorMedia('image/png')).toBe(false);
  });

  it('maps MIME types to file extensions correctly', () => {
    expect(getExtensionForMimeType('image/gif')).toBe('gif');
    expect(getExtensionForMimeType('image/apng')).toBe('apng');
    expect(getExtensionForMimeType('image/webp')).toBe('webp');
    expect(getExtensionForMimeType('image/svg+xml')).toBe('svg');
    expect(getExtensionForMimeType('audio/mpeg')).toBe('mp3');
    expect(getExtensionForMimeType('video/mp4')).toBe('mp4');
  });

  it('computes Git storage path for content-addressable assets', () => {
    const hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    expect(getAssetStoragePath(hash, 'image/gif')).toBe(`undone/assets/${hash}.gif`);
    expect(getAssetStoragePath(hash, 'image/apng')).toBe(`undone/assets/${hash}.apng`);
    expect(getAssetStoragePath(hash, 'audio/mpeg')).toBe(`undone/assets/${hash}.mp3`);
  });

  it('parses base64 data URLs accurately', () => {
    const dataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const parsed = parseDataUrl(dataUrl);
    expect(parsed).not.toBeNull();
    expect(parsed?.mimeType).toBe('image/gif');
    expect(parsed?.byteLength).toBe(42);
  });
});

describe('Asset Creation & Deduplication', () => {
  it('creates AssetRecord with valid SHA-256 and content-addressable identifier', () => {
    const gifDataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const record = createAssetRecord(gifDataUrl);
    expect(record.mimeType).toBe('image/gif');
    expect(record.byteLength).toBe(42);
    expect(record.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(`asset://${record.hash}`).toBe(`asset://${record.hash}`);
  });
});

describe('Excalidraw Scene Asset Extraction (#5301 & #8776)', () => {
  it('extracts embedded images from files map and replaces with asset://${hash}', () => {
    const gifDataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const rawScene = {
      elements: [
        {
          id: 'elem-1',
          type: 'image',
          fileId: 'file-123',
          x: 100,
          y: 100,
          width: 50,
          height: 50,
        },
      ],
      appState: { zoom: { value: 1.5 }, scrollX: 10, scrollY: 20 },
      files: {
        'file-123': {
          id: 'file-123',
          mimeType: 'image/gif',
          dataURL: gifDataUrl,
          created: 1234567890,
        },
      },
    };

    const { sanitizedScene, extractedAssets } = extractAssetsFromCanvasScene(rawScene);

    expect(extractedAssets.length).toBe(1);
    const asset = extractedAssets[0];
    expect(asset.mimeType).toBe('image/gif');
    expect((sanitizedScene.files as any)['file-123'].dataURL).toBe(`asset://${asset.hash}`);
  });
});

describe('Kanban Rich Cards and Asset Extraction', () => {
  it('validates a rich KanbanCard schema with cover, priority, deadlines, checklists', () => {
    const card: KanbanCard = {
      id: 'card-1',
      title: 'Fix GIF transparency issue #8776',
      description: 'Use DOM overlay to avoid 2D canvas black alpha bug',
      columnId: 'col-in-progress',
      order: 0,
      priority: 'urgent',
      type: 'Bug',
      deadline: '2026-10-31T23:59:59.000Z',
      dueDate: '2026-10-30T18:00:00.000Z',
      cover: 'asset://e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      checklists: [
        { id: 'chk-1', text: 'Implement MediaOverlay', completed: true },
        { id: 'chk-2', text: 'Hardware accelerated CSS transforms', completed: true },
      ],
      attachments: [
        {
          id: 'att-1',
          name: 'proof.gif',
          hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          mimeType: 'image/gif',
          size: 35,
        },
      ],
      updatedAt: '2026-10-27T12:00:00.000Z',
    };

    const validated = kanbanCardSchema.parse(card);
    expect(validated.priority).toBe('urgent');
    expect(validated.checklists?.length).toBe(2);
    expect(validated.cover).toContain('asset://');
  });

  it('extracts embedded cover dataURLs from Kanban cards and creates AssetRecords', () => {
    const gifDataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const cards: KanbanCard[] = [
      {
        id: 'card-cover-test',
        title: 'Animated Card Cover',
        columnId: 'col-todo',
        order: 0,
        cover: gifDataUrl,
      },
    ];

    const { cleanCards, extractedAssets } = extractAssetsFromKanbanCards(cards);
    expect(extractedAssets.length).toBe(1);
    expect(cleanCards[0].cover).toBe(`asset://${extractedAssets[0].hash}`);
  });
});

describe('ScheduleTaskRecord Contract Validation', () => {
  it('validates a complete schedule / reminder task', () => {
    const task: ScheduleTaskRecord = {
      id: 'task-100',
      title: 'Review Excalidraw PR #8776 Fix',
      date: '2026-10-28',
      status: 'pending',
      noteId: 'note-excalidraw-fixes',
      category: 'Engineering',
      color: '#3b82f6',
      priority: 'high',
      reminderAt: '2026-10-28T09:00:00.000Z',
      createdAt: '2026-10-27T12:00:00.000Z',
      updatedAt: '2026-10-27T12:00:00.000Z',
    };

    const validated = scheduleTaskRecordSchema.parse(task);
    expect(validated.id).toBe('task-100');
    expect(validated.status).toBe('pending');
    expect(validated.priority).toBe('high');
  });
});

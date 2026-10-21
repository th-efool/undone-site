import 'server-only';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import {
  type RoomEnvironmentSnapshot,
  type UpdateEnvironmentInput,
} from './sprint.contracts';
import { sprintService } from './sprint.service';
import {
  MessagingConflictError,
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from '../messaging/contracts';

const ALLOWED_URL_HOSTS = new Set([
  'soundcloud.com',
  'api.soundcloud.com',
  'w.soundcloud.com',
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'cdn.sidequesthq.com',
  'assets.sidequesthq.com',
  'stream.undone.site',
  'lofi.cafe',
]);

const ALLOWED_SCENES = new Set([
  'lofi-cafe',
  'cyberpunk-rain',
  'library-dawn',
  'fireplace-cabin',
  'tokyo-rooftop',
  'zen-garden',
  'night-train',
  'space-observatory',
]);

export function validateExternalStreamUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new MessagingValidationError('Invalid stream URL format');
  }

  if (parsed.protocol !== 'https:') {
    throw new MessagingValidationError('Stream URL must use HTTPS');
  }

  // Reject embedded credentials
  if (parsed.username || parsed.password) {
    throw new MessagingValidationError('Stream URL cannot contain embedded credentials');
  }

  // Reject port specifications other than default 443
  if (parsed.port && parsed.port !== '443') {
    throw new MessagingValidationError('Stream URL cannot target custom ports');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject loopback, localhost, and IP patterns
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    hostname === '::1' ||
    hostname.startsWith('fe80:') ||
    hostname.startsWith('fc00:') ||
    hostname.startsWith('fd00:')
  ) {
    throw new MessagingValidationError('Target host is not permitted');
  }

  // Check hostname against approved whitelist
  const isAllowedHost = Array.from(ALLOWED_URL_HOSTS).some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
  );

  if (!isAllowedHost) {
    throw new MessagingValidationError(
      `Stream domain '${hostname}' is not authorized. Allowed services: SoundCloud, YouTube, SideQuest CDN.`
    );
  }

  return parsed.toString();
}

export const environmentService = {
  /**
   * Reads the current shared room environment.
   */
  async getRoomEnvironment(roomId: string): Promise<RoomEnvironmentSnapshot> {
    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new MessagingNotFoundError('Study room not found');
    }

    let env = await prisma.roomEnvironment.findUnique({
      where: { studyRoomId: roomId },
    });

    if (!env) {
      // Lazy initialize default environment
      env = await prisma.roomEnvironment.create({
        data: {
          studyRoomId: roomId,
          sceneId: 'lofi-cafe',
          revision: 1,
        },
      });
    }

    return {
      studyRoomId: env.studyRoomId,
      sceneId: env.sceneId,
      soundscapeId: env.soundscapeId,
      musicPresetId: env.musicPresetId,
      musicStreamUrl: env.musicStreamUrl,
      revision: env.revision,
      updatedByUserId: env.updatedByUserId,
      updatedAt: env.updatedAt.toISOString(),
    };
  },

  /**
   * Updates shared room environment with controller verification and revision checks.
   */
  async updateRoomEnvironment(input: UpdateEnvironmentInput): Promise<RoomEnvironmentSnapshot> {
    const { userId, roomId, sceneId, soundscapeId, musicPresetId, musicStreamUrl, expectedRevision } = input;

    const isController = await sprintService.isRoomController(roomId, userId);
    if (!isController) {
      throw new MessagingForbiddenError('Only room controllers can change the shared environment');
    }

    const current = await this.getRoomEnvironment(roomId);

    if (expectedRevision !== undefined && current.revision !== expectedRevision) {
      throw new MessagingConflictError('Environment revision conflict; please refresh room settings');
    }

    let validatedStreamUrl: string | null | undefined = undefined;
    if (musicStreamUrl !== undefined) {
      if (musicStreamUrl === null || musicStreamUrl.trim() === '') {
        validatedStreamUrl = null;
      } else {
        validatedStreamUrl = validateExternalStreamUrl(musicStreamUrl.trim());
      }
    }

    let validatedSceneId: string | undefined = undefined;
    if (sceneId !== undefined) {
      const trimmed = sceneId.trim();
      if (!trimmed || trimmed.length > 64) {
        throw new MessagingValidationError('Invalid scene identifier');
      }
      validatedSceneId = trimmed;
    }

    const updated = await prisma.roomEnvironment.update({
      where: { studyRoomId: roomId },
      data: {
        ...(validatedSceneId !== undefined && { sceneId: validatedSceneId }),
        ...(soundscapeId !== undefined && { soundscapeId: soundscapeId?.trim() || null }),
        ...(musicPresetId !== undefined && { musicPresetId: musicPresetId?.trim() || null }),
        ...(validatedStreamUrl !== undefined && { musicStreamUrl: validatedStreamUrl }),
        updatedByUserId: userId,
        revision: { increment: 1 },
      },
    });

    return {
      studyRoomId: updated.studyRoomId,
      sceneId: updated.sceneId,
      soundscapeId: updated.soundscapeId,
      musicPresetId: updated.musicPresetId,
      musicStreamUrl: updated.musicStreamUrl,
      revision: updated.revision,
      updatedByUserId: updated.updatedByUserId,
      updatedAt: updated.updatedAt.toISOString(),
    };
  },
};

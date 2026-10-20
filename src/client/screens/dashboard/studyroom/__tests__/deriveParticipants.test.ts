/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  deriveParticipants,
  deriveViewer,
} from '../utils/deriveParticipants';
import { ROOM_CATALOG } from '../data/roomCatalog';
import type { MockPeer, SessionGoal, Viewer } from '../types';

describe('deriveParticipants & deriveViewer utilities', () => {
  const libraryRoom = ROOM_CATALOG[0]; // Library (admin: demo-mira)
  const fireplaceRoom = ROOM_CATALOG[1]; // Fireplace (admin: viewer)

  const sampleRoster: MockPeer[] = [
    {
      userId: 'demo-mira',
      displayName: 'Mira',
      avatarUrl: null,
      joinedMinutesAgo: 90,
      publicGoal: 'Study math',
    },
    {
      userId: 'demo-jonas',
      displayName: 'Jonas',
      avatarUrl: null,
      joinedMinutesAgo: 30,
      publicGoal: null,
    },
  ];

  describe('deriveViewer', () => {
    it('derives member role when viewer is not the room admin', () => {
      const viewer = deriveViewer({
        session: { user: { id: 'usr-1', name: 'Alex' } },
        room: libraryRoom,
      });
      expect(viewer.userId).toBe('usr-1');
      expect(viewer.displayName).toBe('Alex');
      expect(viewer.role).toBe('member');
    });

    it('derives admin role when room.adminUserId === "viewer"', () => {
      const viewer = deriveViewer({
        session: { user: { id: 'usr-1', name: 'Alex' } },
        room: fireplaceRoom,
      });
      expect(viewer.role).toBe('admin');
    });

    it('derives admin role when room.adminUserId matches session user id', () => {
      const viewer = deriveViewer({
        session: { user: { id: 'demo-mira', name: 'Mira' } },
        room: libraryRoom,
      });
      expect(viewer.role).toBe('admin');
    });

    it('respects viewAsOverride over natural role derivation', () => {
      // Library naturally member -> override to admin
      const adminViewer = deriveViewer({
        session: { user: { id: 'usr-1' } },
        room: libraryRoom,
        viewAsOverride: 'admin',
      });
      expect(adminViewer.role).toBe('admin');

      // Fireplace naturally admin -> override to member
      const memberViewer = deriveViewer({
        session: { user: { id: 'usr-1' } },
        room: fireplaceRoom,
        viewAsOverride: 'member',
      });
      expect(memberViewer.role).toBe('member');
    });
  });

  describe('deriveParticipants (privacy invariant & administration)', () => {
    const mountedAt = 1_700_000_000_000;

    it('enforces privacy invariant: private goal is never published in publicGoal', () => {
      const viewer: Viewer = {
        userId: 'usr-1',
        displayName: 'Alex',
        avatarUrl: null,
        role: 'member',
      };
      const privateGoal: SessionGoal = {
        text: 'Super Secret Goal',
        visibility: 'private',
      };

      const participants = deriveParticipants({
        roster: sampleRoster,
        viewer,
        goal: privateGoal,
        adminUserId: 'demo-mira',
        mountedAt,
      });

      const userRow = participants[0];
      expect(userRow.isCurrentUser).toBe(true);
      expect(userRow.publicGoal).toBeNull();
      // Ensure private text doesn't exist anywhere in the participant view
      expect(JSON.stringify(participants)).not.toContain('Super Secret Goal');
    });

    it('publishes publicGoal when visibility is "room" and text is non-empty', () => {
      const viewer: Viewer = {
        userId: 'usr-1',
        displayName: 'Alex',
        avatarUrl: null,
        role: 'member',
      };
      const publicGoal: SessionGoal = {
        text: 'Finish chapter 3',
        visibility: 'room',
      };

      const participants = deriveParticipants({
        roster: sampleRoster,
        viewer,
        goal: publicGoal,
        adminUserId: 'demo-mira',
        mountedAt,
      });

      expect(participants[0].publicGoal).toBe('Finish chapter 3');
    });

    it('keeps publicGoal null if visibility is "room" but text is empty or whitespace', () => {
      const viewer: Viewer = {
        userId: 'usr-1',
        displayName: 'Alex',
        avatarUrl: null,
        role: 'member',
      };
      const emptyGoal: SessionGoal = {
        text: '    ',
        visibility: 'room',
      };

      const participants = deriveParticipants({
        roster: sampleRoster,
        viewer,
        goal: emptyGoal,
        adminUserId: 'demo-mira',
        mountedAt,
      });

      expect(participants[0].publicGoal).toBeNull();
    });

    it('calculates joinedAt timestamps correctly from joinedMinutesAgo', () => {
      const viewer: Viewer = {
        userId: 'usr-1',
        displayName: 'Alex',
        avatarUrl: null,
        role: 'member',
      };

      const participants = deriveParticipants({
        roster: sampleRoster,
        viewer,
        goal: { text: '', visibility: 'private' },
        adminUserId: 'demo-mira',
        mountedAt,
      });

      // Current user joined at mountedAt
      expect(participants[0].joinedAt).toBe(mountedAt);

      // Mira joined 90 minutes ago
      expect(participants[1].joinedAt).toBe(mountedAt - 90 * 60_000);

      // Jonas joined 30 minutes ago
      expect(participants[2].joinedAt).toBe(mountedAt - 30 * 60_000);
    });

    it('handles admin flagging correctly for viewer and peers', () => {
      // Case 1: Member viewer in Library -> Mira is admin
      const memberViewer: Viewer = {
        userId: 'usr-1',
        displayName: 'Alex',
        avatarUrl: null,
        role: 'member',
      };
      const participantsMemberView = deriveParticipants({
        roster: sampleRoster,
        viewer: memberViewer,
        goal: { text: '', visibility: 'private' },
        adminUserId: 'demo-mira',
        mountedAt,
      });

      expect(participantsMemberView[0].isAdmin).toBe(false); // Alex
      expect(participantsMemberView[1].isAdmin).toBe(true); // Mira
      expect(participantsMemberView[2].isAdmin).toBe(false); // Jonas

      // Case 2: Admin viewer -> viewer is admin, peers are not admin
      const adminViewer: Viewer = {
        userId: 'usr-1',
        displayName: 'Alex',
        avatarUrl: null,
        role: 'admin',
      };
      const participantsAdminView = deriveParticipants({
        roster: sampleRoster,
        viewer: adminViewer,
        goal: { text: '', visibility: 'private' },
        adminUserId: 'demo-mira',
        mountedAt,
      });

      expect(participantsAdminView[0].isAdmin).toBe(true); // Alex
      expect(participantsAdminView[1].isAdmin).toBe(false); // Mira (peer admin suppressed when viewer is admin)
      expect(participantsAdminView[2].isAdmin).toBe(false); // Jonas
    });

    it('ensures peers only ever expose publicGoal and no personal state', () => {
      const viewer: Viewer = {
        userId: 'usr-1',
        displayName: 'Alex',
        avatarUrl: null,
        role: 'member',
      };
      const participants = deriveParticipants({
        roster: sampleRoster,
        viewer,
        goal: { text: '', visibility: 'private' },
        adminUserId: 'demo-mira',
        mountedAt,
      });

      expect(participants[1].publicGoal).toBe('Study math');
      expect(participants[2].publicGoal).toBeNull();

      for (const p of participants) {
        expect((p as unknown as Record<string, unknown>).tasks).toBeUndefined();
        expect((p as unknown as Record<string, unknown>).timer).toBeUndefined();
      }
    });
  });
});

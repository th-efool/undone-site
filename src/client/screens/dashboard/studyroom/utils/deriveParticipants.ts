import type {
  MockPeer,
  RoomDefinition,
  RoomParticipantView,
  SessionGoal,
  Viewer,
  ViewerRole,
} from '../types';
import type { RoomRosterMemberDTO, RoomRole, RoomCapabilities } from '@/src/shared/studyroom/contracts';

export type RosterItem = MockPeer | RoomRosterMemberDTO;

function isRosterMemberDTO(item: RosterItem): item is RoomRosterMemberDTO {
  return 'joinedAt' in item && typeof item.joinedAt === 'string';
}

export interface DeriveViewerParams {
  session?: {
    user?: {
      id?: string | null;
      name?: string | null;
      image?: string | null;
    } | null;
  } | null;
  room: RoomDefinition;
  viewAsOverride?: ViewerRole;
  roomRole?: RoomRole;
  capabilities?: RoomCapabilities;
}

export function deriveViewer({
  session,
  room,
  viewAsOverride,
  roomRole,
  capabilities,
}: DeriveViewerParams): Viewer {
  const userId = session?.user?.id || 'demo-viewer';
  const displayName = session?.user?.name || 'You';
  const avatarUrl = session?.user?.image || null;

  let role: ViewerRole;
  if (viewAsOverride === 'admin' || viewAsOverride === 'member') {
    role = viewAsOverride;
  } else if (
    roomRole === 'OWNER' ||
    roomRole === 'HOST' ||
    roomRole === 'MODERATOR' ||
    room.adminUserId === 'viewer' ||
    (session?.user?.id && room.adminUserId === session.user.id)
  ) {
    role = 'admin';
  } else {
    role = 'member';
  }

  return {
    userId,
    displayName,
    avatarUrl,
    role,
    roomRole: roomRole || (role === 'admin' ? 'OWNER' : 'PARTICIPANT'),
    capabilities,
  };
}

export interface DeriveParticipantsParams {
  roster: readonly RosterItem[];
  viewer: Viewer;
  goal: SessionGoal;
  adminUserId: string;
  mountedAt: number;
}

/**
 * Derives the participant presentation view list.
 *
 * Strict invariants:
 * 1. Privacy invariant: The viewer's publicGoal is populated ONLY if goal.visibility === 'room'
 *    and goal.text is non-empty after trimming. Private goals NEVER populate this field.
 * 2. Admin determination: If the viewer is admin, peer isAdmin is false. Otherwise, peer.userId === adminUserId.
 * 3. Ordering: Current user is placed first; peer rows follow.
 */
export function deriveParticipants({
  roster,
  viewer,
  goal,
  adminUserId,
  mountedAt,
}: DeriveParticipantsParams): RoomParticipantView[] {
  const cleanGoalText = goal.text.trim();
  const viewerPublicGoal =
    goal.visibility === 'room' && cleanGoalText.length > 0 ? cleanGoalText : null;

  const currentUserView: RoomParticipantView = {
    userId: viewer.userId,
    displayName: viewer.displayName,
    avatarUrl: viewer.avatarUrl,
    joinedAt: mountedAt,
    publicGoal: viewerPublicGoal,
    isCurrentUser: true,
    isAdmin: viewer.role === 'admin',
    role: viewer.roomRole || (viewer.role === 'admin' ? 'OWNER' : 'PARTICIPANT'),
  };

  const peerViews: RoomParticipantView[] = [];
  const safeRoster = Array.isArray(roster) ? roster : [];

  for (const peer of safeRoster) {
    if (peer.userId === viewer.userId) continue;

    if (isRosterMemberDTO(peer)) {
      const peerRole = peer.role;
      peerViews.push({
        userId: peer.userId,
        displayName: peer.name || peer.username || 'Peer',
        avatarUrl: peer.image || null,
        joinedAt: new Date(peer.joinedAt).getTime(),
        publicGoal: peer.publicGoal,
        isCurrentUser: false,
        isAdmin:
          viewer.role === 'admin'
            ? false
            : peerRole === 'OWNER' || peerRole === 'HOST' || peer.userId === adminUserId,
        role: peerRole,
      });
    } else {
      const peerRole = peer.role || (peer.userId === adminUserId ? 'OWNER' : 'PARTICIPANT');
      peerViews.push({
        userId: peer.userId,
        displayName: peer.displayName,
        avatarUrl: peer.avatarUrl,
        joinedAt: mountedAt - peer.joinedMinutesAgo * 60_000,
        publicGoal: peer.publicGoal,
        isCurrentUser: false,
        isAdmin: viewer.role === 'admin' ? false : peerRole === 'OWNER' || peer.userId === adminUserId,
        role: peerRole,
      });
    }
  }

  return [currentUserView, ...peerViews];
}

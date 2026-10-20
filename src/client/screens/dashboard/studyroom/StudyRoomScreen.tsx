'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Flame, 
  BookOpen, 
  Terminal, 
  Sparkles,
  LogOut,
} from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { apiUrl } from '@/src/shared/api/apiUrl';
import { RoomCard, type Room, type Participant } from './components/RoomCard';
import { FocusTimerCard } from './components/FocusTimerCard';
import styles from './StudyRoomScreen.module.css';

interface ToastMessage {
  id: string;
  text: string;
  type: 'info' | 'success' | 'alert';
}

const DEFAULT_ROOMS: Room[] = [
  {
    id: 'default-fireplace',
    title: 'Fireplace',
    thumbnail: '/rooms/fireplace.jpg',
    status: 'ACTIVE',
    onlineCount: 0,
    participants: [],
  },
  {
    id: 'default-library',
    title: 'Library',
    thumbnail: '/rooms/library.jpg',
    status: 'ACTIVE',
    onlineCount: 0,
    participants: [],
  },
  {
    id: 'default-dev-den',
    title: 'Developer Den',
    thumbnail: '/rooms/dev-den.jpg',
    status: 'ACTIVE',
    onlineCount: 0,
    participants: [],
  },
];

export default function StudyRoomScreen() {
  const { data: session } = useSession();
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // Simulated activity state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Load Rooms
  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/studyroom'));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setRooms(data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch rooms', e);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchRooms();
    };
    void init();
    // Poll for updates every 10 seconds to keep rooms fresh
    const poll = setInterval(() => {
      void fetchRooms();
    }, 10000);
    return () => clearInterval(poll);
  }, [fetchRooms]);

  // Add Toast Notification Helper
  const addToast = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  // Simulated activity simulation loop
  useEffect(() => {
    const mockNames = ['PixelCoder', 'SarahFlow', 'ByteWrangler', 'CyberSam', 'AdaForce', 'SyntaxError', 'DataWizard', 'CoffeeCoder'];
    const mockRoomsNames = ['Fireplace', 'Library', 'Developer Den'];

    const triggerSimulation = () => {
      const name = mockNames[Math.floor(Math.random() * mockNames.length)];
      const targetRoom = mockRoomsNames[Math.floor(Math.random() * mockRoomsNames.length)];
      const actions = [
        `joined ${targetRoom}`,
        `completed a 25m focus sprint in ${targetRoom}`,
        `earned a focus streak in ${targetRoom}`
      ];
      const action = actions[Math.floor(Math.random() * actions.length)];

      addToast(`🎉 ${name} ${action}`, 'info');
    };

    const interval = setInterval(triggerSimulation, 24000); // Trigger periodic presence update
    return () => clearInterval(interval);
  }, [addToast]);

  // Join Room Operation
  const handleJoinRoom = useCallback(async (roomId: string) => {
    if (!session || !session.user || !session.user.id) {
      addToast('🔒 You must be logged in to join study rooms!', 'alert');
      return;
    }

    let targetRoomId = roomId;
    if (targetRoomId.startsWith('default-')) {
      const normalizedTarget = targetRoomId.replace('default-', '').toLowerCase();
      const matched = rooms.find((r: Room) => 
        r.title.toLowerCase().replace(/\s+/g, '-') === normalizedTarget ||
        r.title.toLowerCase() === normalizedTarget
      );
      if (matched && !matched.id.startsWith('default-')) {
        targetRoomId = matched.id;
      }
    }

    // 1. Snapshot for rollback
    const rollbackRooms = rooms;

    // 2. Optimistic UI update (<16ms)
    const currentUserId = session.user.id;
    const currentParticipant: Participant = {
      id: `temp-${currentUserId}`,
      userId: currentUserId,
      user: {
        id: currentUserId,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
        username: (session.user as { username?: string | null }).username ?? null,
      },
    };

    const nextRooms = rooms.map((r) => {
      const isTarget = r.id === roomId || r.id === targetRoomId;
      const filtered = r.participants.filter((p) => p.userId !== currentUserId);
      if (isTarget) {
        return {
          ...r,
          onlineCount: filtered.length + 1,
          participants: [...filtered, currentParticipant],
        };
      }
      return {
        ...r,
        onlineCount: filtered.length,
        participants: filtered,
      };
    });

    setRooms(nextRooms);
    addToast('✨ Successfully joined the room!', 'success');

    // 3. Background server sync
    setJoiningId(targetRoomId);
    try {
      const res = await fetch(apiUrl('/api/studyroom'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId: targetRoomId }),
      });

      if (res.ok) {
        void fetchRooms();
      } else {
        const err = await res.json().catch(() => ({}));
        setRooms(rollbackRooms);
        addToast(err.error || 'Failed to join room. Changes restored.', 'alert');
      }
    } catch (e) {
      console.error(e);
      setRooms(rollbackRooms);
      addToast('Network error while joining room. Changes restored.', 'alert');
    } finally {
      setJoiningId(null);
    }
  }, [session, rooms, fetchRooms, addToast]);

  // Leave Room Operation
  const handleLeaveRoom = useCallback(async () => {
    if (!session || !session.user || !session.user.id) return;

    // 1. Snapshot for rollback
    const rollbackRooms = rooms;
    const currentUserId = session.user.id;

    // 2. Optimistic UI update (<16ms)
    const nextRooms = rooms.map((r) => ({
      ...r,
      onlineCount: Math.max(0, r.participants.filter((p) => p.userId !== currentUserId).length),
      participants: r.participants.filter((p) => p.userId !== currentUserId),
    }));
    setRooms(nextRooms);
    addToast('👋 Left the room successfully', 'info');

    // 3. Background sync
    try {
      const res = await fetch(apiUrl('/api/studyroom'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });

      if (res.ok) {
        void fetchRooms();
      } else {
        const err = await res.json().catch(() => ({}));
        setRooms(rollbackRooms);
        addToast(err.error || 'Failed to leave room. Changes restored.', 'alert');
      }
    } catch (e) {
      console.error(e);
      setRooms(rollbackRooms);
      addToast('Network error while leaving room. Changes restored.', 'alert');
    }
  }, [session, rooms, fetchRooms, addToast]);

  // Helper to determine if user is in a given room
  const isUserInRoom = useCallback((room: Room) => {
    if (!session || !session.user || !session.user.id) return false;
    const userId = session.user.id;
    return room.participants.some((p) => p.userId === userId);
  }, [session]);

  // Helper to find which room the user is currently in (if any)
  const currentActiveRoom = rooms.find((r) => isUserInRoom(r));

  // Determine Room Icon based on Title
  const getRoomIcon = (title: string) => {
    switch (title.toLowerCase()) {
      case 'fireplace':
        return Flame;
      case 'library':
        return BookOpen;
      case 'developer den':
      default:
        return Terminal;
    }
  };

  // Determine Room Theme/Gradient
  const getRoomGradient = (title: string) => {
    switch (title.toLowerCase()) {
      case 'fireplace':
        return styles.gradientFireplace;
      case 'library':
        return styles.gradientLibrary;
      case 'developer den':
      default:
        return styles.gradientDevDen;
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <div className={styles.liveIndicator}>
            <span className={styles.livePulse}></span>
            LIVE WORKSPACE
          </div>
          <h1>Focus Cohorts & Study Rooms</h1>
          <p>Co-work silently, align focus blocks, and level up with your peer groups in real-time.</p>
        </div>
      </header>

      <div className={styles.grid}>
        {/* Left Side: Study Rooms Grid */}
        <section className={styles.roomsSection}>
          <div className={styles.sectionHeader}>
            <h2>Active Spaces ({rooms.length})</h2>
            {currentActiveRoom && (
              <span className={styles.activeRoomBadge}>
                Active in: <strong>{currentActiveRoom.title}</strong>
                <button onClick={handleLeaveRoom} className={styles.leaveBtnMini}>
                  <LogOut size={13} /> Leave
                </button>
              </span>
            )}
          </div>

          <div className={styles.roomsGrid}>
            {rooms.length === 0 ? (
              <p className={styles.emptyRoomsMsg}>No active study spaces found.</p>
            ) : (
              rooms.map((room) => {
                const IconComponent = getRoomIcon(room.title);
                const isCurrent = isUserInRoom(room);
                const gradientClass = getRoomGradient(room.title);

                return (
                  <RoomCard
                    key={room.id}
                    room={room}
                    isCurrent={isCurrent}
                    isJoining={joiningId === room.id}
                    onJoin={handleJoinRoom}
                    onLeave={handleLeaveRoom}
                    IconComponent={IconComponent}
                    gradientClass={gradientClass}
                  />
                );
              })
            )}
          </div>
        </section>

        {/* Right Side: Focus Timer Card & Simulation log */}
        <aside className={styles.asideSection}>
          <FocusTimerCard onComplete={(msg) => addToast(msg, 'success')} />

          {/* Activity Feeds */}
          <div className={styles.feedCard}>
            <h3 className={styles.feedTitle}>
              <Sparkles size={14} style={{ color: '#ffb020', marginRight: 6 }} />
              Active Peer Feed
            </h3>
            <div className={styles.feedScroll}>
              <div className={styles.feedItem}>
                <span className={styles.feedDot}></span>
                <p>Welcome to Undone Study Rooms! Join a room to co-work.</p>
              </div>
              {currentActiveRoom && (
                <div className={styles.feedItem}>
                  <span className={`${styles.feedDot} ${styles.feedDotActive}`}></span>
                  <p>You joined the <strong>{currentActiveRoom.title}</strong> room.</p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Floating Notifications */}
      <div className={styles.toastContainer}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <m.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className={`${styles.toast} ${
                toast.type === 'success' ? styles.toastSuccess : 
                toast.type === 'alert' ? styles.toastAlert : ''
              }`}
            >
              {toast.text}
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Flame, 
  BookOpen, 
  Terminal, 
  Users, 
  Volume2, 
  VolumeX, 
  Clock, 
  MessageSquare,
  Sparkles,
  Zap,
  ArrowRight,
  LogOut,
  Coffee
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiUrl } from '@/src/shared/api/apiUrl';
import styles from './StudyRoomScreen.module.css';

interface Participant {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    username: string | null;
  };
}

interface Room {
  id: string;
  title: string;
  thumbnail: string;
  status: string;
  onlineCount: number;
  participants: Participant[];
}

interface ToastMessage {
  id: string;
  text: string;
  type: 'info' | 'success' | 'alert';
}

const PRESETS = [
  { label: 'Hyperfocus', minutes: 50, icon: Zap },
  { label: 'Deep Work', minutes: 25, icon: Flame },
  { label: 'Short Break', minutes: 5, icon: Coffee },
  { label: 'Long Break', minutes: 15, icon: Clock },
];

export default function StudyRoomScreen() {
  const { data: session } = useSession();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  
  // Timer States
  const [duration, setDuration] = useState(25 * 60); // 25 minutes default
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activePreset, setActivePreset] = useState('Deep Work');

  // Simulated activity state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load Rooms
  const fetchRooms = async () => {
    try {
      const res = await fetch(apiUrl('/api/studyroom'));
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (e) {
      console.error('Failed to fetch rooms', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    // Poll for updates every 10 seconds to keep rooms fresh
    const poll = setInterval(fetchRooms, 10000);
    return () => clearInterval(poll);
  }, []);

  // Timer Countdown Logic
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
            playChime();
            addToast('✨ Focus session completed! Great job.', 'success');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Audio synthesis chime using Web Audio API (no external asset dependencies)
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Warm synth chord
      const playNote = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.2, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.start(start);
        osc.stop(start + duration);
      };

      const now = ctx.currentTime;
      playNote(523.25, now, 1.2); // C5
      playNote(659.25, now + 0.1, 1.0); // E5
      playNote(783.99, now + 0.2, 0.8); // G5
      playNote(1046.50, now + 0.3, 0.8); // C6
    } catch (e) {
      console.error('Audio Synthesis Failed', e);
    }
  };

  // Add Toast Notification Helper
  const addToast = (text: string, type: ToastMessage['type'] = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Simulated activity simulation loop
  useEffect(() => {
    const mockNames = ['PixelCoder', 'SarahFlow', 'ByteWrangler', 'CyberSam', 'AdaForce', 'SyntaxError', 'DataWizard', 'CoffeeCoder'];
    const mockRoomsNames = ['Fireplace', 'Library', 'Developer Den'];

    const triggerSimulation = () => {
      const name = mockNames[Math.floor(Math.random() * mockNames.length)];
      const room = mockRoomsNames[Math.floor(Math.random() * mockRoomsNames.length)];
      const actionType = Math.random() > 0.45 ? 'joined' : 'completed focus';

      if (actionType === 'joined') {
        addToast(`🚀 ${name} joined the ${room} room!`, 'info');
      } else {
        addToast(`🏆 ${name} completed a 25m Focus Block!`, 'success');
      }
    };

    const interval = setInterval(triggerSimulation, 15000);
    return () => clearInterval(interval);
  }, []);

  // Format Seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle Preset Clicks
  const handlePresetSelect = (presetLabel: string, minutes: number) => {
    setActivePreset(presetLabel);
    setDuration(minutes * 60);
    setTimeLeft(minutes * 60);
    setIsRunning(false);
  };

  // Join Room Operation
  const handleJoinRoom = async (roomId: string) => {
    if (!session) {
      addToast('🔒 You must be logged in to join study rooms!', 'alert');
      return;
    }

    setJoiningId(roomId);
    try {
      const res = await fetch(apiUrl('/api/studyroom'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId }),
      });

      if (res.ok) {
        addToast('✨ Successfully joined the room!', 'success');
        fetchRooms();
      } else {
        const err = await res.json();
        addToast(err.error || 'Failed to join room', 'alert');
      }
    } catch (e) {
      console.error(e);
      addToast('Network error while joining room', 'alert');
    } finally {
      setJoiningId(null);
    }
  };

  // Leave Room Operation
  const handleLeaveRoom = async () => {
    if (!session) return;
    try {
      const res = await fetch(apiUrl('/api/studyroom'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });

      if (res.ok) {
        addToast('👋 Left the room successfully', 'info');
        fetchRooms();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Helper to determine if user is in a given room
  const isUserInRoom = (room: Room) => {
    if (!session || !session.user || !session.user.id) return false;
    const userId = session.user.id;
    return room.participants.some((p) => p.userId === userId);
  };

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

  // Svg Circle Progress Math
  const progressRatio = timeLeft / duration;
  const strokeDashoffset = 282.6 * (1 - progressRatio); // circumference is 2 * pi * r (2 * 3.14 * 45 = 282.6)

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

          {loading ? (
            <div className={styles.skeletonGrid}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={styles.skeletonCard}></div>
              ))}
            </div>
          ) : (
            <div className={styles.roomsGrid}>
              {rooms.map((room) => {
                const IconComponent = getRoomIcon(room.title);
                const isCurrent = isUserInRoom(room);
                const gradientClass = getRoomGradient(room.title);

                return (
                  <div 
                    key={room.id} 
                    className={`${styles.roomCard} ${gradientClass} ${isCurrent ? styles.activeRoomCard : ''}`}
                  >
                    {isCurrent && <div className={styles.roomGlow} />}
                    <div className={styles.roomHeader}>
                      <div className={styles.roomIconWrapper}>
                        <IconComponent className={styles.roomIcon} size={22} />
                      </div>
                      {isCurrent && (
                        <span className={styles.currentBadge}>
                          <span className={styles.pulseGreen}></span> YOU ARE HERE
                        </span>
                      )}
                    </div>

                    <div className={styles.roomMeta}>
                      <h3>{room.title}</h3>
                      <p className={styles.roomStatus}>
                        {room.title === 'Fireplace' ? 'Warm and cozy chats' : 
                         room.title === 'Library' ? 'Silent study & focus' : 
                         'Co-working & code reviews'}
                      </p>
                    </div>

                    {/* Participant Avatars */}
                    <div className={styles.participantsSection}>
                      <span className={styles.participantsLabel}>
                        <Users size={14} /> {room.participants.length} Active
                      </span>
                      <div className={styles.avatarStack}>
                        {room.participants.length > 0 ? (
                          room.participants.map((p) => {
                            const name = p.user.name || p.user.username || 'Explorer';
                            const image = p.user.image || `https://api.dicebear.com/7.x/initials/svg?seed=${name}`;
                            return (
                              <div key={p.id} className={styles.avatarWrapper} title={name}>
                                <img src={image} alt={name} className={styles.avatar} />
                              </div>
                            );
                          })
                        ) : (
                          <span className={styles.emptyRoomsMsg}>No peers currently inside</span>
                        )}
                      </div>
                    </div>

                    {/* Join / Leave Card Button */}
                    <div className={styles.cardActions}>
                      {isCurrent ? (
                        <button 
                          onClick={handleLeaveRoom} 
                          className={`${styles.actionBtn} ${styles.leaveBtn}`}
                        >
                          Leave Room
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleJoinRoom(room.id)} 
                          disabled={joiningId === room.id}
                          className={`${styles.actionBtn} ${styles.joinBtn}`}
                        >
                          {joiningId === room.id ? 'Connecting...' : 'Join Space'}
                          <ArrowRight size={15} style={{ marginLeft: 8 }} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Side: Focus Timer Card & Simulation log */}
        <aside className={styles.asideSection}>
          <div className={styles.timerCard}>
            <div className={styles.timerCardHeader}>
              <div className={styles.timerHeaderIcon}>
                <Clock size={18} />
                <span>Timer Widget</span>
              </div>
              <button 
                onClick={() => setSoundEnabled(!soundEnabled)} 
                className={styles.soundToggle}
                title={soundEnabled ? 'Mute Chime' : 'Unmute Chime'}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
            </div>

            {/* Presets Grid */}
            <div className={styles.presetsGrid}>
              {PRESETS.map((p) => {
                const PIcon = p.icon;
                const isSelected = activePreset === p.label;
                return (
                  <button
                    key={p.label}
                    onClick={() => handlePresetSelect(p.label, p.minutes)}
                    className={`${styles.presetBtn} ${isSelected ? styles.activePreset : ''}`}
                  >
                    <PIcon size={14} style={{ marginRight: 6 }} />
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Circular Timer Visual */}
            <div className={styles.timerVisualContainer}>
              <svg className={styles.timerSvg} viewBox="0 0 100 100">
                <circle 
                  className={styles.timerSvgTrack} 
                  cx="50" 
                  cy="50" 
                  r="45"
                />
                <circle 
                  className={styles.timerSvgProgress} 
                  cx="50" 
                  cy="50" 
                  r="45"
                  strokeDasharray="282.6"
                  strokeDashoffset={strokeDashoffset}
                  style={{ transition: isRunning ? 'stroke-dashoffset 1s linear' : 'stroke-dashoffset 0.3s ease' }}
                />
              </svg>
              <div className={styles.timerTextContainer}>
                <span className={styles.timerPresetName}>{activePreset}</span>
                <span className={styles.timerNumber}>{formatTime(timeLeft)}</span>
                <span className={styles.timerTotalTime}>of {duration / 60}m</span>
              </div>
            </div>

            {/* Controls */}
            <div className={styles.timerControls}>
              <button 
                onClick={() => setIsRunning(!isRunning)} 
                className={`${styles.controlBtn} ${isRunning ? styles.pauseBtn : styles.startBtn}`}
              >
                {isRunning ? (
                  <>
                    <Pause size={16} style={{ marginRight: 6 }} /> Pause
                  </>
                ) : (
                  <>
                    <Play size={16} style={{ marginRight: 6 }} /> Start Focus
                  </>
                )}
              </button>
              <button 
                onClick={() => handlePresetSelect(activePreset, duration / 60)} 
                className={`${styles.controlBtn} ${styles.resetBtn}`}
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* Activity Feeds */}
          <div className={styles.feedCard}>
            <h3 className={styles.feedTitle}>
              <Sparkles size={14} style={{ color: '#ffb020', marginRight: 6 }} />
              Active Peer Feed
            </h3>
            <div className={styles.feedScroll}>
              <div className={styles.feedItem}>
                <span className={styles.feedDot}></span>
                <p>Welcome to SideQuest Study Rooms! Join a room to co-work.</p>
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
            <motion.div
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
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

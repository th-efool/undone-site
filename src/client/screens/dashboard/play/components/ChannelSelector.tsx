'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from '../Play.module.css';
import { ChannelId } from '@/src/shared/curriculum/pedagogicalVector.types';
import {
  Coffee,
  Zap,
  Compass,
  Hammer,
  Headphones,
  Search,
  Circle,
} from 'lucide-react';
import { triggerHaptic } from '@/src/client/utils/haptics';

export type RadialIconComponent = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

export interface ChannelDefinition {
  id: ChannelId;
  label: string;
  desc: string;
}

/**
 * Source-of-truth channel definitions preserved from the Undone player.
 */
export const CHANNELS: ChannelDefinition[] = [
  { id: 'default', label: 'Default', desc: 'Balanced sequential progression' },
  { id: 'spark', label: 'Spark', desc: 'High-energy insights & hooks' },
  { id: 'explore', label: 'Explore', desc: 'Broad cross-topic discovery' },
  { id: 'build', label: 'Build', desc: 'Hands-on code & implementation' },
  { id: 'listen', label: 'Listen', desc: 'Audio-friendly conceptual talks' },
  { id: 'deep_dive', label: 'Deep Dive', desc: 'Rigorous theory & architecture' },
  { id: 'quick', label: 'Quick', desc: 'Fast bite-sized micro-chunks' },
];

/**
 * Fixed channel icon mapping per specification:
 * - Default -> Coffee cup
 * - Spark -> Lightning bolt
 * - Explore -> Compass
 * - Build -> Hammer
 * - Listen -> Headphones
 * - Deep Dive -> Magnifying glass
 * - Quick -> Explicitly unassigned (null) & configurable until an icon is supplied
 */
export const DEFAULT_CHANNEL_ICON_MAP: Record<ChannelId, RadialIconComponent | null> = {
  default: Circle,
  spark: Coffee,
  explore: Compass,
  build: Hammer,
  listen: Headphones,
  deep_dive: Search,
  quick: Zap,
};

export type RadialSwitcherState = 'idle' | 'pressed' | 'open' | 'targeting' | 'committing';

export interface ChannelSelectorProps {
  activeChannel: ChannelId;
  onChannelSelect: (channel: ChannelId) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onPrefsUpdated?: () => void;
  isInline?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  channelIcons?: Partial<Record<ChannelId, RadialIconComponent | null>>;
  holdThresholdMs?: number;
}

const DEFAULT_HOLD_THRESHOLD_MS = 200;
const FULL_RING_RADIUS = 72;
const NODE_HALF_SIZE = 17;
const VIEWPORT_PADDING = 10;
const CENTER_DEADZONE_RADIUS = 22;
const CENTER_MIN_MOVE_PX = 8;
const OUTER_CANCEL_MARGIN = 48;
const DRAG_EARLY_OPEN_SLOP_PX = 18;

interface OriginPoint {
  /** Exact center of the trigger in viewport coordinates */
  x: number;
  y: number;
  radius: number;
  /** Arc start angle (radians) and span (radians) for the outer channels */
  startAngle: number;
  span: number;
  /** True when there is room for a full ring around the trigger */
  full: boolean;
  /** Direction the arc faces (-1/0/1) */
  dirX: number;
  dirY: number;
}

/**
 * The menu stays anchored exactly on the trigger. When the trigger hugs a
 * viewport edge (e.g. top-left), the outer channels fan out as an arc facing
 * into the viewport instead of the whole menu being shifted away.
 */
function computeLayout(x: number, y: number): OriginPoint {
  const vw = typeof window !== 'undefined' ? window.innerWidth || 1024 : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight || 768 : 768;
  const need = FULL_RING_RADIUS + NODE_HALF_SIZE + VIEWPORT_PADDING;
  const dirX = x < need ? 1 : vw - x < need ? -1 : 0;
  const dirY = y < need ? 1 : vh - y < need ? -1 : 0;

  if (dirX === 0 && dirY === 0) {
    return {
      x,
      y,
      radius: FULL_RING_RADIUS,
      startAngle: -Math.PI / 2,
      span: Math.PI * 2,
      full: true,
      dirX,
      dirY,
    };
  }
  const corner = dirX !== 0 && dirY !== 0;
  const span = corner ? Math.PI / 2 : Math.PI;
  const center = Math.atan2(dirY, dirX);
  return {
    x,
    y,
    radius: corner ? 112 : 92,
    startAngle: center - span / 2,
    span,
    full: false,
    dirX,
    dirY,
  };
}

/** Offsets of the six outer channels (everything except Default, the center). */
function computeNodes(o: OriginPoint) {
  const outer = CHANNELS.filter((c) => c.id !== 'default');
  const n = outer.length;
  const step = o.full ? o.span / n : o.span / (n - 1);
  return outer.map((channel, index) => {
    const angle = o.startAngle + index * step;
    return {
      ...channel,
      index,
      angle,
      dx: Math.cos(angle) * o.radius,
      dy: Math.sin(angle) * o.radius,
    };
  });
}

export const ChannelSelector = React.memo(function ChannelSelector({
  activeChannel,
  onChannelSelect,
  isInline = false,
  isOpen: controlledIsOpen,
  onOpenChange,
  channelIcons,
  holdThresholdMs = DEFAULT_HOLD_THRESHOLD_MS,
  searchQuery,
  onSearchQueryChange,
  onPrefsUpdated,
}: ChannelSelectorProps) {
  const [machineState, setMachineState] = useState<RadialSwitcherState>('idle');
  const [targetedChannel, setTargetedChannel] = useState<ChannelId | null>(null);
  const [origin, setOrigin] = useState<OriginPoint>(() => computeLayout(93, 93));

  const downCoordsRef = useRef<{ x: number; y: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Partial<Record<ChannelId, HTMLButtonElement | null>>>({});
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const machineStateRef = useRef<RadialSwitcherState>('idle');
  const targetedChannelRef = useRef<ChannelId | null>(null);
  const originRef = useRef<OriginPoint>(origin);
  const committedInGestureRef = useRef<boolean>(false);
  const keyboardModeRef = useRef<boolean>(false);

  const resolvedIcons = useMemo(
    () => ({
      ...DEFAULT_CHANNEL_ICON_MAP,
      ...(channelIcons || {}),
    }),
    [channelIcons]
  );

  const updateOriginFromTrigger = useCallback((): OriginPoint => {
    const el = triggerRef.current;
    if (!el) {
      const fallback = computeLayout(93, 93);
      originRef.current = fallback;
      setOrigin(fallback);
      return fallback;
    }
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const nextOrigin = computeLayout(centerX || 93, centerY || 93);
    originRef.current = nextOrigin;
    setOrigin(nextOrigin);
    return nextOrigin;
  }, []);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const transitionToIdle = useCallback(
    (restoreFocus = false) => {
      clearHoldTimer();
      activePointerIdRef.current = null;
      pointerDownPosRef.current = null;
      keyboardModeRef.current = false;
      targetedChannelRef.current = null;
      setTargetedChannel(null);
      machineStateRef.current = 'idle';
      setMachineState('idle');
      onOpenChange?.(false);
      if (restoreFocus) {
        triggerRef.current?.focus();
      }
    },
    [clearHoldTimer, onOpenChange]
  );

  const openConstellation = useCallback(
    (viaKeyboard = false) => {
      clearHoldTimer();
      const measured = updateOriginFromTrigger();
      originRef.current = measured;
      keyboardModeRef.current = viaKeyboard;
      if (viaKeyboard) {
        targetedChannelRef.current = activeChannel;
        setTargetedChannel(activeChannel);
        machineStateRef.current = 'targeting';
        setMachineState('targeting');
      } else {
        targetedChannelRef.current = null;
        setTargetedChannel(null);
        machineStateRef.current = 'open';
        setMachineState('open');
      }
      triggerHaptic('light');
      onOpenChange?.(true);
    },
    [activeChannel, clearHoldTimer, onOpenChange, updateOriginFromTrigger]
  );

  // Sync controlled `isOpen` prop (e.g. 'C' keyboard shortcut in PlayDesktop)
  useEffect(() => {
    if (controlledIsOpen === undefined) return;
    const currentlyOpen =
      machineStateRef.current === 'open' || machineStateRef.current === 'targeting';
    if (controlledIsOpen && !currentlyOpen) {
      openConstellation(true);
    } else if (!controlledIsOpen && currentlyOpen) {
      transitionToIdle(false);
    }
  }, [controlledIsOpen, openConstellation, transitionToIdle]);

  // Outer nodes (all channels except Default, which is the center hub)
  const radialNodes = useMemo(() => computeNodes(origin), [origin]);

  /**
   * Resolves which channel (if any) is targeted given pointer client coordinates.
   * Center hub = Default (only once the pointer has actually moved off its start point,
   * so hold-then-release in place never switches).
   */
  const resolveTargetAtPoint = useCallback(
    (clientX: number, clientY: number): ChannelId | null => {
      const currentOrigin = originRef.current;
      const relX = clientX - currentOrigin.x;
      const relY = clientY - currentOrigin.y;
      const distFromCenter = Math.hypot(relX, relY);

      if (distFromCenter < CENTER_DEADZONE_RADIUS) {
        const down = downCoordsRef.current;
        const moved = down ? Math.hypot(clientX - down.x, clientY - down.y) : 0;
        return moved >= CENTER_MIN_MOVE_PX ? 'default' : null;
      }
      if (distFromCenter > currentOrigin.radius + OUTER_CANCEL_MARGIN) {
        return null;
      }

      let closestId: ChannelId | null = null;
      let minNodeDist = Infinity;
      for (const node of computeNodes(currentOrigin)) {
        const d = Math.hypot(relX - node.dx, relY - node.dy);
        if (d < minNodeDist) {
          minNodeDist = d;
          closestId = node.id;
        }
      }

      if (minNodeDist <= 40) return closestId;
      // Full ring: allow the whole ring band to resolve to the nearest sector
      if (currentOrigin.full && distFromCenter <= currentOrigin.radius + 32) {
        return closestId;
      }
      return null;
    },
    []
  );

  const updatePointerTarget = useCallback(
    (clientX: number, clientY: number) => {
      const nextTarget = resolveTargetAtPoint(clientX, clientY);
      const prevTarget = targetedChannelRef.current;

      if (nextTarget !== prevTarget) {
        targetedChannelRef.current = nextTarget;
        setTargetedChannel(nextTarget);
        if (nextTarget) {
          triggerHaptic('light');
        }
      }

      const nextState: RadialSwitcherState = nextTarget ? 'targeting' : 'open';
      if (machineStateRef.current !== nextState) {
        machineStateRef.current = nextState;
        setMachineState(nextState);
      }
    },
    [resolveTargetAtPoint]
  );

  const commitOrCancelPointerGesture = useCallback(
    (clientX?: number, clientY?: number) => {
      const currentState = machineStateRef.current;
      clearHoldTimer();

      if (currentState === 'pressed') {
        // Quick tap: open the menu and leave it open; user clicks a channel
        committedInGestureRef.current = false;
        openConstellation(true);
        return;
      }

      if (currentState !== 'open' && currentState !== 'targeting') {
        return;
      }

      // Resolve final target if coordinates are supplied
      let finalTarget = targetedChannelRef.current;
      if (
        typeof clientX === 'number' &&
        typeof clientY === 'number' &&
        !Number.isNaN(clientX) &&
        !Number.isNaN(clientY) &&
        (clientX !== 0 || clientY !== 0)
      ) {
        finalTarget = resolveTargetAtPoint(clientX, clientY);
      }

      if (finalTarget && !committedInGestureRef.current) {
        committedInGestureRef.current = true;
        machineStateRef.current = 'committing';
        setMachineState('committing');
        triggerHaptic('medium');
        onChannelSelect(finalTarget);
      }

      transitionToIdle(false);
    },
    [clearHoldTimer, onChannelSelect, openConstellation, resolveTargetAtPoint, transitionToIdle]
  );

  const getEventCoords = (
    e:
      | React.PointerEvent<HTMLElement>
      | PointerEvent
      | MouseEvent
      | { clientX?: number; clientY?: number; pageX?: number; pageY?: number }
  ): { x: number; y: number } => {
    const rawX =
      typeof e.clientX === 'number' && !Number.isNaN(e.clientX)
        ? e.clientX
        : typeof (e as MouseEvent).pageX === 'number'
        ? (e as MouseEvent).pageX
        : 0;
    const rawY =
      typeof e.clientY === 'number' && !Number.isNaN(e.clientY)
        ? e.clientY
        : typeof (e as MouseEvent).pageY === 'number'
        ? (e as MouseEvent).pageY
        : 0;
    return { x: rawX, y: rawY };
  };

  const handleTriggerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === 'mouse' && typeof e.button === 'number' && e.button !== 0) return;
      e.stopPropagation();

      // If already open in keyboard mode, close on click
      if (
        keyboardModeRef.current &&
        (machineStateRef.current === 'open' || machineStateRef.current === 'targeting')
      ) {
        transitionToIdle(false);
        return;
      }

      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {}

      const coords = getEventCoords(e);
      committedInGestureRef.current = false;
      keyboardModeRef.current = false;
      activePointerIdRef.current = typeof e.pointerId === 'number' ? e.pointerId : null;
      pointerDownPosRef.current = coords;
      downCoordsRef.current = coords;
      updateOriginFromTrigger();

      machineStateRef.current = 'pressed';
      setMachineState('pressed');

      clearHoldTimer();
      holdTimerRef.current = setTimeout(() => {
        holdTimerRef.current = null;
        if (machineStateRef.current === 'pressed') {
          openConstellation(false);
          if (pointerDownPosRef.current) {
            updatePointerTarget(pointerDownPosRef.current.x, pointerDownPosRef.current.y);
          }
        }
      }, holdThresholdMs);
    },
    [
      clearHoldTimer,
      holdThresholdMs,
      openConstellation,
      transitionToIdle,
      updateOriginFromTrigger,
      updatePointerTarget,
    ]
  );

  const handleTriggerPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (
        activePointerIdRef.current !== null &&
        e.pointerId !== undefined &&
        e.pointerId !== 0 &&
        e.pointerId !== activePointerIdRef.current
      ) {
        return;
      }

      const coords = getEventCoords(e);

      if (machineStateRef.current === 'pressed' && pointerDownPosRef.current) {
        const movedDist = Math.hypot(
          coords.x - pointerDownPosRef.current.x,
          coords.y - pointerDownPosRef.current.y
        );
        pointerDownPosRef.current = coords;
        if (movedDist >= DRAG_EARLY_OPEN_SLOP_PX) {
          openConstellation(false);
          updatePointerTarget(coords.x, coords.y);
        }
        return;
      }

      if (machineStateRef.current === 'open' || machineStateRef.current === 'targeting') {
        e.stopPropagation();
        updatePointerTarget(coords.x, coords.y);
      }
    },
    [openConstellation, updatePointerTarget]
  );

  const handleTriggerPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (
        activePointerIdRef.current !== null &&
        e.pointerId !== undefined &&
        e.pointerId !== 0 &&
        e.pointerId !== activePointerIdRef.current
      ) {
        return;
      }
      e.stopPropagation();
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      } catch {}
      const coords = getEventCoords(e);
      commitOrCancelPointerGesture(coords.x, coords.y);
    },
    [commitOrCancelPointerGesture]
  );

  const handleTriggerPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      } catch {}
      transitionToIdle(false);
    },
    [transitionToIdle]
  );

  const isGestureActive =
    machineState === 'pressed' || machineState === 'open' || machineState === 'targeting';

  useEffect(() => {
    if (!isGestureActive) return;

    const isMatchingPointer = (e: PointerEvent | MouseEvent) => {
      const pid = (e as PointerEvent).pointerId;
      if (activePointerIdRef.current === null || activePointerIdRef.current === undefined) return true;
      if (pid === undefined || pid === null || pid === 0) return true;
      return pid === activePointerIdRef.current;
    };

    const handleWindowPointerMove = (e: PointerEvent | MouseEvent) => {
      if (keyboardModeRef.current) return;
      if (!isMatchingPointer(e)) return;
      const coords = getEventCoords(e);
      if (machineStateRef.current === 'pressed' && pointerDownPosRef.current) {
        const movedDist = Math.hypot(
          coords.x - pointerDownPosRef.current.x,
          coords.y - pointerDownPosRef.current.y
        );
        pointerDownPosRef.current = coords;
        if (movedDist >= DRAG_EARLY_OPEN_SLOP_PX) {
          openConstellation(false);
          updatePointerTarget(coords.x, coords.y);
        }
        return;
      }
      if (machineStateRef.current === 'open' || machineStateRef.current === 'targeting') {
        updatePointerTarget(coords.x, coords.y);
      }
    };

    const handleWindowPointerUp = (e: PointerEvent | MouseEvent) => {
      if (keyboardModeRef.current) return;
      if (!isMatchingPointer(e)) return;
      const coords = getEventCoords(e);
      commitOrCancelPointerGesture(coords.x, coords.y);
    };

    const handleWindowPointerCancel = () => {
      if (keyboardModeRef.current) return;
      transitionToIdle(false);
    };

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        transitionToIdle(true);
        return;
      }

      if (
        machineStateRef.current !== 'open' &&
        machineStateRef.current !== 'targeting'
      ) {
        return;
      }

      if (
        e.key === 'ArrowRight' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowUp'
      ) {
        e.preventDefault();
        e.stopPropagation();
        keyboardModeRef.current = true;
        const currentId = targetedChannelRef.current || activeChannel;
        const curIdx = Math.max(
          0,
          CHANNELS.findIndex((c) => c.id === currentId)
        );
        const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        const nextIdx = (curIdx + step + CHANNELS.length) % CHANNELS.length;
        const nextChannel = CHANNELS[nextIdx].id;
        targetedChannelRef.current = nextChannel;
        setTargetedChannel(nextChannel);
        machineStateRef.current = 'targeting';
        setMachineState('targeting');
        optionRefs.current[nextChannel]?.focus();
      }
    };

    const handleWindowResize = () => {
      if (machineStateRef.current === 'open' || machineStateRef.current === 'targeting') {
        updateOriginFromTrigger();
      }
    };

    const handleWindowBlur = () => {
      transitionToIdle(false);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('mousemove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('mouseup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);
    window.addEventListener('keydown', handleWindowKeyDown, true);
    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('mousemove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('mouseup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
      window.removeEventListener('keydown', handleWindowKeyDown, true);
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [
    activeChannel,
    commitOrCancelPointerGesture,
    isGestureActive,
    openConstellation,
    transitionToIdle,
    updateOriginFromTrigger,
    updatePointerTarget,
  ]);

  // Focus active/targeted option when opened via keyboard
  useEffect(() => {
    const isMenuOpen = machineState === 'open' || machineState === 'targeting';
    if (isMenuOpen && keyboardModeRef.current) {
      const targetId = targetedChannelRef.current || activeChannel;
      optionRefs.current[targetId]?.focus();
    }
  }, [activeChannel, machineState]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      clearHoldTimer();
    };
  }, [clearHoldTimer]);

  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        const isMenuOpen =
          machineStateRef.current === 'open' || machineStateRef.current === 'targeting';
        if (isMenuOpen) {
          transitionToIdle(true);
        } else {
          committedInGestureRef.current = false;
          openConstellation(true);
        }
      }
    },
    [openConstellation, transitionToIdle]
  );

  const isMenuOpen = machineState === 'open' || machineState === 'targeting';
  const DefaultIcon = resolvedIcons.default;
  const targetedNode = targetedChannel
    ? radialNodes.find((n) => n.id === targetedChannel) || null
    : null;
  const portalTarget =
    typeof document !== 'undefined'
      ? (document.fullscreenElement as HTMLElement | null) || document.body
      : null;

  const orbitPath = (() => {
    const r = origin.radius;
    if (origin.full) {
      return `M ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0`;
    }
    const a0 = origin.startAngle;
    const a1 = origin.startAngle + origin.span;
    const large = origin.span > Math.PI ? 1 : 0;
    return `M ${Math.cos(a0) * r} ${Math.sin(a0) * r} A ${r} ${r} 0 ${large} 1 ${Math.cos(a1) * r} ${Math.sin(a1) * r}`;
  })();

  const constellationContent = isMenuOpen ? (
    <div
      className={styles.radialOverlay}
      data-testid="radial-channel-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          transitionToIdle(true);
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        id="radial-channel-menu"
        role="menu"
        aria-label="Channel switcher"
        data-state={machineState}
        className={styles.radialConstellation}
        style={{
          left: `${origin.x}px`,
          top: `${origin.y}px`,
        }}
      >
        {/* Orbit track (arc facing into the viewport, or full ring) */}
        <svg
          className={styles.radialOrbitSvg}
          viewBox="-140 -140 280 280"
          aria-hidden="true"
        >
          <path className={styles.radialOrbitCircle} d={orbitPath} />
          {targetedNode && (
            <line
              className={styles.radialSpokeLine}
              x1="0"
              y1="0"
              x2={targetedNode.dx}
              y2={targetedNode.dy}
            />
          )}
        </svg>

        {/* Center = Default channel, directly over the trigger */}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={activeChannel === 'default'}
          aria-label="Default"
          data-channel-id="default"
          data-targeted={targetedChannel === 'default' ? 'true' : 'false'}
          data-active={activeChannel === 'default' ? 'true' : 'false'}
          ref={(el) => {
            optionRefs.current.default = el;
          }}
          className={`${styles.radialCenterHub} ${
            activeChannel === 'default' && !targetedChannel ? styles.radialOptionCurrent : ''
          } ${targetedChannel === 'default' ? styles.radialHubTargeted : ''}`}
          onPointerEnter={() => {
            if (keyboardModeRef.current) {
              targetedChannelRef.current = 'default';
              setTargetedChannel('default');
              machineStateRef.current = 'targeting';
              setMachineState('targeting');
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (keyboardModeRef.current && !committedInGestureRef.current) {
              committedInGestureRef.current = true;
              machineStateRef.current = 'committing';
              setMachineState('committing');
              triggerHaptic('medium');
              onChannelSelect('default');
              transitionToIdle(true);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              if (!committedInGestureRef.current) {
                committedInGestureRef.current = true;
                onChannelSelect('default');
                transitionToIdle(true);
              }
            }
          }}
        >
          {DefaultIcon ? (
            <DefaultIcon size={18} strokeWidth={2} aria-hidden="true" />
          ) : (
            <span className={styles.radialFallbackGlyph} aria-hidden="true">D</span>
          )}
        </button>

        {/* Seven radial channel option nodes */}
        {radialNodes.map((node) => {
          const IconComponent = resolvedIcons[node.id];
          const isCurrent = activeChannel === node.id;
          const isTargeted = targetedChannel === node.id;

          return (
            <button
              key={node.id}
              ref={(el) => {
                optionRefs.current[node.id] = el;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={isCurrent}
              aria-label={node.label}
              data-channel-id={node.id}
              data-targeted={isTargeted ? 'true' : 'false'}
              data-active={isCurrent ? 'true' : 'false'}
              className={`${styles.radialOption} ${
                isCurrent && !targetedChannel ? styles.radialOptionCurrent : ''
              } ${isTargeted ? styles.radialOptionTargeted : ''}`}
              style={{
                left: `${node.dx}px`,
                top: `${node.dy}px`,
              }}
              onPointerEnter={() => {
                if (
                  machineStateRef.current === 'open' ||
                  machineStateRef.current === 'targeting'
                ) {
                  targetedChannelRef.current = node.id;
                  setTargetedChannel(node.id);
                  machineStateRef.current = 'targeting';
                  setMachineState('targeting');
                }
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                if (!committedInGestureRef.current) {
                  committedInGestureRef.current = true;
                  machineStateRef.current = 'committing';
                  setMachineState('committing');
                  triggerHaptic('medium');
                  onChannelSelect(node.id);
                }
                transitionToIdle(false);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (keyboardModeRef.current && !committedInGestureRef.current) {
                  committedInGestureRef.current = true;
                  machineStateRef.current = 'committing';
                  setMachineState('committing');
                  triggerHaptic('medium');
                  onChannelSelect(node.id);
                  transitionToIdle(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!committedInGestureRef.current) {
                    committedInGestureRef.current = true;
                    machineStateRef.current = 'committing';
                    setMachineState('committing');
                    triggerHaptic('medium');
                    onChannelSelect(node.id);
                  }
                  transitionToIdle(true);
                }
              }}
            >
              {IconComponent ? (
                <IconComponent size={17} strokeWidth={1.9} aria-hidden="true" />
              ) : (
                <span className={styles.radialFallbackGlyph} aria-hidden="true">
                  {node.label.charAt(0)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div
      className={isInline ? styles.channelSelectorInline : styles.channelSelectorWrapper}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.radialTrigger} ${
          machineState === 'pressed' ? styles.radialTriggerPressed : ''
        } ${isMenuOpen ? styles.radialTriggerOpen : ''}`}
        aria-label="Open channel switcher"
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        aria-controls={isMenuOpen ? 'radial-channel-menu' : undefined}
        data-state={machineState}
        data-active-channel={activeChannel}
        onPointerDown={handleTriggerPointerDown}
        onPointerMove={handleTriggerPointerMove}
        onPointerUp={handleTriggerPointerUp}
        onPointerCancel={handleTriggerPointerCancel}
        onKeyDown={handleTriggerKeyDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Circle size={18} strokeWidth={2} aria-hidden="true" />
      </button>

      {portalTarget && constellationContent
        ? createPortal(constellationContent, portalTarget)
        : constellationContent}
    </div>
  );
});

ChannelSelector.displayName = 'ChannelSelector';

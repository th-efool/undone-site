import type { AmbientPresetId } from '../types';

export interface AmbientEngine {
  setPreset(id: AmbientPresetId | null, fadeMs?: number): void;
  setGain(value01: number): void;
  resume(): Promise<boolean>;
  getState(): 'running' | 'suspended';
  dispose(): void;
}

interface ActiveSubGraph {
  gain: GainNode;
  dispose: () => void;
}

/**
 * Creates the procedural ambient audio engine using Web Audio API.
 * Returns null if Web Audio is unsupported in the current browser/environment.
 */
export function createAmbientEngine(): AmbientEngine | null {
  if (typeof window === 'undefined') return null;

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  let ctx: AudioContext;
  try {
    ctx = new AudioContextClass();
  } catch (err) {
    console.warn('Failed to initialize AudioContext for ambient sound:', err);
    return null;
  }

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, ctx.currentTime);
  masterGain.connect(ctx.destination);

  let currentPresetId: AmbientPresetId | null = null;
  let activeSubGraph: ActiveSubGraph | null = null;
  const activeTimeouts = new Set<ReturnType<typeof setTimeout>>();
  let isDisposed = false;

  // Generate 6-second shared looping noise buffers (white, pink, brown)
  const bufferDuration = 6.0;
  const numFrames = Math.max(1, Math.floor(ctx.sampleRate * bufferDuration));

  // 1. White noise buffer
  const whiteBuffer = ctx.createBuffer(1, numFrames, ctx.sampleRate);
  const whiteData = whiteBuffer.getChannelData(0);
  for (let i = 0; i < numFrames; i++) {
    whiteData[i] = Math.random() * 2 - 1;
  }

  // 2. Pink noise buffer (Paul Kellet filter)
  const pinkBuffer = ctx.createBuffer(1, numFrames, ctx.sampleRate);
  const pinkData = pinkBuffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < numFrames; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    pinkData[i] = pink * 0.11;
  }

  // 3. Brown noise buffer (leaky integrator, scaled x3.5)
  const brownBuffer = ctx.createBuffer(1, numFrames, ctx.sampleRate);
  const brownData = brownBuffer.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < numFrames; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.02 * white) / 1.02;
    brownData[i] = lastOut * 3.5;
  }

  function createLoopingSource(buffer: AudioBuffer): AudioBufferSourceNode {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  function trackTimeout(fn: () => void, delayMs: number): ReturnType<typeof setTimeout> {
    const timerId = setTimeout(() => {
      activeTimeouts.delete(timerId);
      fn();
    }, delayMs);
    activeTimeouts.add(timerId);
    return timerId;
  }

  function buildPresetSubGraph(id: AmbientPresetId): ActiveSubGraph {
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    subGain.connect(masterGain);

    const localTimeouts = new Set<ReturnType<typeof setTimeout>>();
    const localSources: (AudioBufferSourceNode | OscillatorNode)[] = [];

    const localTrackTimeout = (fn: () => void, delayMs: number) => {
      const id = trackTimeout(() => {
        localTimeouts.delete(id);
        fn();
      }, delayMs);
      localTimeouts.add(id);
      return id;
    };

    switch (id) {
      case 'rain': {
        // white noise -> highpass 800 Hz -> lowpass 9 kHz -> gain 0.60
        const whiteSrc = createLoopingSource(whiteBuffer);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 800;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 9000;
        const wGain = ctx.createGain();
        wGain.gain.value = 0.6;

        whiteSrc.connect(hp);
        hp.connect(lp);
        lp.connect(wGain);
        wGain.connect(subGain);
        whiteSrc.start();
        localSources.push(whiteSrc);

        // brown noise -> lowpass 400 Hz -> gain 0.15
        const brownSrc = createLoopingSource(brownBuffer);
        const brownLp = ctx.createBiquadFilter();
        brownLp.type = 'lowpass';
        brownLp.frequency.value = 400;
        const bGain = ctx.createGain();
        bGain.gain.value = 0.15;

        brownSrc.connect(brownLp);
        brownLp.connect(bGain);
        bGain.connect(subGain);
        brownSrc.start();
        localSources.push(brownSrc);
        break;
      }

      case 'thunderstorm': {
        // Base rain recipe
        const whiteSrc = createLoopingSource(whiteBuffer);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 800;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 9000;
        const wGain = ctx.createGain();
        wGain.gain.value = 0.6;
        whiteSrc.connect(hp);
        hp.connect(lp);
        lp.connect(wGain);
        wGain.connect(subGain);
        whiteSrc.start();
        localSources.push(whiteSrc);

        const brownSrc = createLoopingSource(brownBuffer);
        const brownLp = ctx.createBiquadFilter();
        brownLp.type = 'lowpass';
        brownLp.frequency.value = 400;
        const bGain = ctx.createGain();
        bGain.gain.value = 0.15;
        brownSrc.connect(brownLp);
        brownLp.connect(bGain);
        bGain.connect(subGain);
        brownSrc.start();
        localSources.push(brownSrc);

        // Periodic thunder rumble: brown noise -> lowpass 180 Hz, gain ramp 0->0.9 in 0.3s then decay over 3s
        const scheduleRumble = () => {
          const delayMs = (8 + Math.random() * 12) * 1000;
          localTrackTimeout(() => {
            if (isDisposed) return;
            const rSrc = ctx.createBufferSource();
            rSrc.buffer = brownBuffer;
            const rLp = ctx.createBiquadFilter();
            rLp.type = 'lowpass';
            rLp.frequency.value = 180;
            const rGain = ctx.createGain();
            const now = ctx.currentTime;
            rGain.gain.setValueAtTime(0, now);
            rGain.gain.linearRampToValueAtTime(0.9, now + 0.3);
            rGain.gain.exponentialRampToValueAtTime(0.001, now + 3.3);

            rSrc.connect(rLp);
            rLp.connect(rGain);
            rGain.connect(subGain);
            rSrc.start(now);
            rSrc.stop(now + 3.4);

            scheduleRumble();
          }, delayMs);
        };
        scheduleRumble();
        break;
      }

      case 'fireplace': {
        // brown -> lowpass 500 Hz -> gain 0.50
        const flameSrc = createLoopingSource(brownBuffer);
        const flameFilter = ctx.createBiquadFilter();
        flameFilter.type = 'lowpass';
        flameFilter.frequency.value = 500;
        const flameGain = ctx.createGain();
        flameGain.gain.value = 0.5;
        flameSrc.connect(flameFilter);
        flameFilter.connect(flameGain);
        flameGain.connect(subGain);
        flameSrc.start();
        localSources.push(flameSrc);

        // Crackles every 80-400 ms (random): 8 ms white burst -> bandpass 3 kHz (Q 1) -> gain random 0.1-0.5
        const scheduleCrackle = () => {
          const delayMs = 80 + Math.random() * 320;
          localTrackTimeout(() => {
            if (isDisposed) return;
            const cSrc = ctx.createBufferSource();
            cSrc.buffer = whiteBuffer;
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = 3000;
            bp.Q.value = 1;
            const cGain = ctx.createGain();
            const now = ctx.currentTime;
            const vol = 0.1 + Math.random() * 0.4;
            cGain.gain.setValueAtTime(vol, now);
            cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);

            cSrc.connect(bp);
            bp.connect(cGain);
            cGain.connect(subGain);
            cSrc.start(now);
            cSrc.stop(now + 0.009);

            scheduleCrackle();
          }, delayMs);
        };
        scheduleCrackle();
        break;
      }

      case 'ocean-waves': {
        // brown -> lowpass 900 Hz -> gain base 0.45 modulated by 0.1 Hz sine LFO depth 0.35
        // plus pink -> highpass 2 kHz -> gain 0.10 modulated by the same LFO
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1;

        const brownSrc = createLoopingSource(brownBuffer);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 900;
        const bGain = ctx.createGain();
        bGain.gain.value = 0.45;

        const lfoDepthBrown = ctx.createGain();
        lfoDepthBrown.gain.value = 0.35;
        lfo.connect(lfoDepthBrown);
        lfoDepthBrown.connect(bGain.gain);

        brownSrc.connect(lp);
        lp.connect(bGain);
        bGain.connect(subGain);
        brownSrc.start();
        localSources.push(brownSrc);

        const pinkSrc = createLoopingSource(pinkBuffer);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 2000;
        const pGain = ctx.createGain();
        pGain.gain.value = 0.1;

        const lfoDepthPink = ctx.createGain();
        lfoDepthPink.gain.value = 0.1;
        lfo.connect(lfoDepthPink);
        lfoDepthPink.connect(pGain.gain);

        pinkSrc.connect(hp);
        hp.connect(pGain);
        pGain.connect(subGain);
        pinkSrc.start();
        localSources.push(pinkSrc);

        lfo.start();
        localSources.push(lfo);
        break;
      }

      case 'forest': {
        // pink -> bandpass 600 Hz (Q 0.5) -> gain 0.25 with 0.08 Hz gain LFO depth 0.08
        const pinkSrc = createLoopingSource(pinkBuffer);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 600;
        bp.Q.value = 0.5;
        const fGain = ctx.createGain();
        fGain.gain.value = 0.25;

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.08;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.08;
        lfo.connect(lfoGain);
        lfoGain.connect(fGain.gain);

        pinkSrc.connect(bp);
        bp.connect(fGain);
        fGain.connect(subGain);
        pinkSrc.start();
        lfo.start();
        localSources.push(pinkSrc, lfo);

        // Chirp every 3-9 s: sine sweep 2.5->4.5 kHz over 120 ms, gain 0.05
        const scheduleChirp = () => {
          const delayMs = (3 + Math.random() * 6) * 1000;
          localTrackTimeout(() => {
            if (isDisposed) return;
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            const now = ctx.currentTime;
            osc.frequency.setValueAtTime(2500, now);
            osc.frequency.exponentialRampToValueAtTime(4500, now + 0.12);
            const cGain = ctx.createGain();
            cGain.gain.setValueAtTime(0.05, now);
            cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(cGain);
            cGain.connect(subGain);
            osc.start(now);
            osc.stop(now + 0.125);

            scheduleChirp();
          }, delayMs);
        };
        scheduleChirp();
        break;
      }

      case 'wind': {
        // pink -> bandpass swept 300<->900 Hz by 0.07 Hz LFO; gain modulated by 0.12 Hz LFO between 0.15-0.40
        const pinkSrc = createLoopingSource(pinkBuffer);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 600;

        const freqLfo = ctx.createOscillator();
        freqLfo.frequency.value = 0.07;
        const freqLfoGain = ctx.createGain();
        freqLfoGain.gain.value = 300;
        freqLfo.connect(freqLfoGain);
        freqLfoGain.connect(bp.frequency);

        const wGain = ctx.createGain();
        wGain.gain.value = 0.275;
        const gainLfo = ctx.createOscillator();
        gainLfo.frequency.value = 0.12;
        const gainLfoGain = ctx.createGain();
        gainLfoGain.gain.value = 0.125;
        gainLfo.connect(gainLfoGain);
        gainLfoGain.connect(wGain.gain);

        pinkSrc.connect(bp);
        bp.connect(wGain);
        wGain.connect(subGain);

        pinkSrc.start();
        freqLfo.start();
        gainLfo.start();
        localSources.push(pinkSrc, freqLfo, gainLfo);
        break;
      }

      case 'white-noise': {
        const src = createLoopingSource(whiteBuffer);
        const g = ctx.createGain();
        g.gain.value = 0.35;
        src.connect(g);
        g.connect(subGain);
        src.start();
        localSources.push(src);
        break;
      }

      case 'pink-noise': {
        const src = createLoopingSource(pinkBuffer);
        const g = ctx.createGain();
        g.gain.value = 0.6;
        src.connect(g);
        g.connect(subGain);
        src.start();
        localSources.push(src);
        break;
      }

      case 'brown-noise': {
        const src = createLoopingSource(brownBuffer);
        const g = ctx.createGain();
        g.gain.value = 0.8;
        src.connect(g);
        g.connect(subGain);
        src.start();
        localSources.push(src);
        break;
      }

      case 'cafe': {
        // pink -> bandpass 300-3000 Hz -> gain 0.35
        const pinkSrc = createLoopingSource(pinkBuffer);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 300;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3000;
        const cGain = ctx.createGain();
        cGain.gain.value = 0.35;

        pinkSrc.connect(hp);
        hp.connect(lp);
        lp.connect(cGain);
        cGain.connect(subGain);
        pinkSrc.start();
        localSources.push(pinkSrc);

        // Clinks every 4-12 s: sine 2-4 kHz (random), 40 ms, gain 0.03
        const scheduleClink = () => {
          const delayMs = (4 + Math.random() * 8) * 1000;
          localTrackTimeout(() => {
            if (isDisposed) return;
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            const freq = 2000 + Math.random() * 2000;
            const now = ctx.currentTime;
            osc.frequency.setValueAtTime(freq, now);
            const kGain = ctx.createGain();
            kGain.gain.setValueAtTime(0.03, now);
            kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

            osc.connect(kGain);
            kGain.connect(subGain);
            osc.start(now);
            osc.stop(now + 0.045);

            scheduleClink();
          }, delayMs);
        };
        scheduleClink();
        break;
      }
    }

    return {
      gain: subGain,
      dispose: () => {
        localTimeouts.forEach((timerId) => {
          clearTimeout(timerId);
          activeTimeouts.delete(timerId);
        });
        localTimeouts.clear();

        localSources.forEach((src) => {
          try {
            src.stop();
          } catch {
            // Ignore if already stopped
          }
          try {
            src.disconnect();
          } catch {
            // Ignore if disconnected
          }
        });
        try {
          subGain.disconnect();
        } catch {
          // Ignore
        }
      },
    };
  }

  return {
    setPreset(id: AmbientPresetId | null, fadeMs: number = 600) {
      if (isDisposed) return;
      if (id === currentPresetId) return;

      currentPresetId = id;
      const fadeSec = Math.max(0.05, fadeMs / 1000);
      const now = ctx.currentTime;

      // 1. Fade out existing sub-graph
      if (activeSubGraph) {
        const oldGraph = activeSubGraph;
        activeSubGraph = null;

        try {
          oldGraph.gain.gain.setValueAtTime(oldGraph.gain.gain.value, now);
          oldGraph.gain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
        } catch {
          // Fallback if audio ramps throw
        }

        trackTimeout(() => {
          oldGraph.dispose();
        }, fadeMs + 50);
      }

      // 2. Build and fade in new sub-graph
      if (id !== null) {
        const newGraph = buildPresetSubGraph(id);
        activeSubGraph = newGraph;

        try {
          const freshNow = ctx.currentTime;
          newGraph.gain.gain.setValueAtTime(0.0001, freshNow);
          newGraph.gain.gain.linearRampToValueAtTime(1.0, freshNow + fadeSec);
        } catch {
          newGraph.gain.gain.value = 1.0;
        }
      }
    },

    setGain(value01: number) {
      if (isDisposed) return;
      const clamped = Math.max(0, Math.min(1, Number.isFinite(value01) ? value01 : 0));
      try {
        masterGain.gain.setTargetAtTime(clamped, ctx.currentTime, 0.05);
      } catch {
        masterGain.gain.value = clamped;
      }
    },

    async resume(): Promise<boolean> {
      if (isDisposed) return false;
      try {
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        return ctx.state === 'running';
      } catch {
        return false;
      }
    },

    getState(): 'running' | 'suspended' {
      if (isDisposed) return 'suspended';
      return ctx.state === 'running' ? 'running' : 'suspended';
    },

    dispose() {
      if (isDisposed) return;
      isDisposed = true;

      activeTimeouts.forEach((id) => clearTimeout(id));
      activeTimeouts.clear();

      if (activeSubGraph) {
        activeSubGraph.dispose();
        activeSubGraph = null;
      }

      try {
        masterGain.disconnect();
      } catch {
        // Ignore
      }

      try {
        void ctx.close();
      } catch {
        // Ignore
      }
    },
  };
}

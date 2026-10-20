/**
 * Synthesizes a warm C-major completion chime via Web Audio API.
 * Automatically closes the AudioContext after 2 seconds to prevent resource leaks.
 * Safe to call in SSR or unsupported environments (swallowed silently).
 */
export function playChime(): void {
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const playNote = (freq: number, start: number, noteDuration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration);
      osc.start(start);
      osc.stop(start + noteDuration);
    };

    const now = ctx.currentTime;
    playNote(523.25, now, 1.2); // C5
    playNote(659.25, now + 0.1, 1.0); // E5
    playNote(783.99, now + 0.2, 0.8); // G5
    playNote(1046.5, now + 0.3, 0.8); // C6

    // Clean up AudioContext after chord finishes
    setTimeout(() => {
      try {
        void ctx.close();
      } catch {
        // Ignored
      }
    }, 2000);
  } catch {
    // Audio synthesis failure is non-fatal
  }
}

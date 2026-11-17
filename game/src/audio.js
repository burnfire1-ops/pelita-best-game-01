// Every sound is synthesised with WebAudio: no audio files, nothing fetched. The
// context is created lazily on the first user gesture (browsers block audio before
// one) and every effect is a short oscillator or noise envelope, tuned to a gamelan
// flavour: a kill chimes, a cleared night plays a short pentatonic phrase, and the
// boss arrives on a gong.

export function createAudio() {
  let context = null;
  let muted = false;
  let lastZap = 0;

  function ensure() {
    if (context === null) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    }
    if (context.state === 'suspended') context.resume();
    return context;
  }

  function tone(freqFrom, freqTo, seconds, type, gainValue, when = 0) {
    const audio = ensure();
    if (audio === null || muted) return;
    const start = audio.currentTime + when;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, freqFrom), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), start + seconds);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.05);
  }

  function thud() {
    const audio = ensure();
    if (audio === null || muted) return;
    const start = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(130, start);
    oscillator.frequency.exponentialRampToValueAtTime(40, start + 0.25);
    gain.gain.setValueAtTime(0.5, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.35);
  }

  function gong() {
    // A low gong: a deep sine with a long tail plus a metallic partial.
    tone(98, 92, 1.6, 'sine', 0.32);
    tone(147, 140, 1.2, 'sine', 0.14, 0.02);
    tone(294, 280, 0.7, 'triangle', 0.07, 0.02);
  }

  // Slendro-ish pentatonic steps used for the wave-clear and win phrases.
  const GAMELAN = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

  return {
    /** Call on any user gesture so later sounds are allowed. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    /** The beam's soft hiss while it burns, throttled so it never stutters. */
    zap(now) {
      if (now - lastZap < 0.18) return;
      lastZap = now;
      tone(1800, 1400, 0.07, 'sine', 0.02);
    },
    /** A kill chimes: a bright denting note. */
    kill() {
      tone(1318, 1318, 0.12, 'sine', 0.1);
      tone(1976, 1976, 0.09, 'sine', 0.05, 0.03);
    },
    /** Switching beam colour clicks bright. */
    color() {
      tone(980, 1240, 0.08, 'triangle', 0.1);
    },
    /** The temple is hit: a dull thud. */
    hit() {
      thud();
    },
    /** A night is cleared: a short gamelan phrase, rising. */
    clear() {
      GAMELAN.slice(0, 5).forEach((freq, index) => {
        tone(freq, freq, 0.22, 'triangle', 0.12, index * 0.11);
      });
    },
    /** The boss arrives on a gong. */
    boss() {
      gong();
    },
    /** The boss changes phase: a low warning tone. */
    phase() {
      tone(220, 180, 0.4, 'triangle', 0.16);
      tone(110, 90, 0.5, 'sine', 0.2, 0.05);
    },
    /** A lantern is placed: a warm wooden knock. */
    place() {
      tone(660, 520, 0.1, 'triangle', 0.12);
      tone(880, 880, 0.08, 'sine', 0.07, 0.06);
    },
    /** Buying an upgrade: a rising two-note chime. */
    buy() {
      tone(784, 784, 0.12, 'triangle', 0.12);
      tone(1046, 1046, 0.16, 'triangle', 0.12, 0.09);
    },
    over() {
      tone(392, 392, 0.25, 'triangle', 0.16);
      tone(330, 330, 0.25, 'triangle', 0.16, 0.22);
      tone(262, 196, 0.5, 'triangle', 0.16, 0.44);
    },
    win() {
      GAMELAN.forEach((freq, index) => {
        tone(freq, freq, 0.3, 'triangle', 0.14, index * 0.13);
      });
      tone(1046, 1046, 0.6, 'sine', 0.1, 0.8);
    },
  };
}

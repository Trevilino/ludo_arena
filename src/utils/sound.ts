const SOUND_FILES = {
  ui: '/assets/aistudio/ui_a9360ea5.mp3',
  gameStart: '/assets/aistudio/game_start_3c39e5ab.mp3',
  diceRoll: '/assets/aistudio/dice_roll_74bc863f.mp3',
  pileMove: '/assets/aistudio/pile_move_fe86f51e.mp3',
  safeSpot: '/assets/aistudio/safe_spot_d60485f1.mp3',
  collide: '/assets/aistudio/collide_b4f54754.mp3',
  home: '/assets/aistudio/home_e30e59b2.mp3',
  homeWin: '/assets/aistudio/home_win_a3913927.mp3',
  cheer: '/assets/aistudio/cheer_e3eae6c2.mp3',
  girl1: '/assets/aistudio/girl1_0066bca3.mp3',
  girl2: '/assets/aistudio/girl2_46ceaccb.mp3',
  girl3: '/assets/aistudio/girl3_8cdb0b45.mp3',
  girl4: '/assets/aistudio/girl4_71f9f95e.mp3',
} as const;

export type SoundKey = keyof typeof SOUND_FILES;

class ArenaAudioEngine {
  private cache = new Map<SoundKey, HTMLAudioElement>();
  private activeInstances = new Set<HTMLAudioElement>();
  private activeTimers = new Set<number>();
  private audioCtx: AudioContext | null = null;
  private _enabled = true;

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(val: boolean) {
    this._enabled = val;
    if (!val) {
      this.stopAll();
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!this.audioCtx) {
      this.audioCtx = new Ctx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {
        // Ignore resume failure before gesture
      });
    }
    return this.audioCtx;
  }

  private preload(key: SoundKey): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    let base = this.cache.get(key);
    if (!base) {
      base = new Audio(SOUND_FILES[key]);
      base.preload = 'auto';
      this.cache.set(key, base);
    }
    return base;
  }

  private fadeAndStop(audio: HTMLAudioElement, fadeMs = 220): void {
    const startVol = audio.volume;
    const steps = 6;
    const stepMs = Math.max(20, Math.floor(fadeMs / steps));
    let current = 0;

    const fadeTimer = window.setInterval(() => {
      current += 1;
      if (current >= steps || !this.activeInstances.has(audio)) {
        window.clearInterval(fadeTimer);
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {
          // Ignore reset errors
        }
        this.activeInstances.delete(audio);
        return;
      }
      audio.volume = Math.max(0, startVol * (1 - current / steps));
    }, stepMs);
  }

  public stopAll(): void {
    this.activeTimers.forEach((id) => window.clearTimeout(id));
    this.activeTimers.clear();

    this.activeInstances.forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // Ignore media reset errors
      }
    });
    this.activeInstances.clear();
  }

  public play(
    key: SoundKey,
    volume = 0.75,
    delayMs = 0,
    maxDurationMs?: number
  ): void {
    if (!this._enabled || typeof window === 'undefined') return;

    const trigger = () => {
      if (!this._enabled) return;
      const base = this.preload(key);
      if (!base) return;

      try {
        const instance = base.cloneNode(true) as HTMLAudioElement;
        instance.volume = Math.max(0, Math.min(1, volume));
        this.activeInstances.add(instance);

        instance.addEventListener(
          'ended',
          () => {
            this.activeInstances.delete(instance);
          },
          { once: true }
        );

        instance.play().catch(() => {
          this.activeInstances.delete(instance);
        });

        if (maxDurationMs && maxDurationMs > 0) {
          const fadeTime = Math.min(260, Math.floor(maxDurationMs * 0.25));
          const stopAt = Math.max(60, maxDurationMs - fadeTime);
          const stopTimer = window.setTimeout(() => {
            this.activeTimers.delete(stopTimer);
            if (this.activeInstances.has(instance)) {
              this.fadeAndStop(instance, fadeTime);
            }
          }, stopAt);
          this.activeTimers.add(stopTimer);
        }
      } catch {
        // Ignore browser autoplay restrictions
      }
    };

    if (delayMs > 0) {
      const delayTimer = window.setTimeout(() => {
        this.activeTimers.delete(delayTimer);
        trigger();
      }, delayMs);
      this.activeTimers.add(delayTimer);
    } else {
      trigger();
    }
  }

  public warmUp(): void {
    (Object.keys(SOUND_FILES) as SoundKey[]).forEach((key) => {
      this.preload(key);
    });
    this.getAudioContext();
  }

  playClick() {
    this.warmUp();
    this.play('ui', 0.5, 0, 250);
  }

  playGameStart() {
    this.warmUp();
    this.play('gameStart', 0.65, 0, 2000);
  }

  playDiceRoll() {
    this.warmUp();
    this.play('diceRoll', 0.75, 0, 1260);
  }

  playTokenHop() {
    // Crisp short step sound per tile (220ms)
    this.play('pileMove', 0.7, 0, 220);
  }

  playTokenReturnStep(progressRatio = 0.5) {
    if (!this._enabled || typeof window === 'undefined') return;
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'running') {
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const clamped = Math.max(0, Math.min(1, progressRatio));
        const startFreq = 640 - clamped * 300;
        const endFreq = startFreq * 0.72;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(120, endFreq), now + 0.055);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.065);
        return;
      } catch {
        // Fallback to mp3 step below
      }
    }
    this.play('pileMove', 0.42, 0, 95);
  }

  playTokenReturnDoor() {
    if (!this._enabled || typeof window === 'undefined') return;
    this.play('ui', 0.6, 0, 220);
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'running') {
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(175, now + 0.14);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.24, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.17);
      } catch {
        // Ignore audio synthesis errors
      }
    }
  }

  playDeploy() {
    // Crisp pawn deployment sound (< 0.5s)
    this.play('pileMove', 0.7, 0, 220);
    this.play('safeSpot', 0.55, 80, 450);
  }

  playSafeZone() {
    this.play('safeSpot', 0.7, 0, 500);
  }

  playCapture() {
    // Punchy capture impact + short vocal reaction
    this.play('collide', 0.9, 0, 1200);
    this.play('girl2', 0.65, 180, 1100);
  }

  playSixRoll() {
    // Short highlight chime
    this.play('safeSpot', 0.55, 60, 450);
  }

  playHomeGoal() {
    // Cap 25s track to a crisp 2.2s celebration
    this.play('home', 0.8, 0, 2200);
  }

  playVictory() {
    // Cap 25s/14s tracks to 3.5s with smooth fade-out
    this.play('homeWin', 0.8, 0, 3500);
    this.play('cheer', 0.55, 250, 3200);
  }

  playVoiceTaunt(key: 'girl1' | 'girl2' | 'girl3' | 'girl4') {
    this.play(key, 0.7, 0, 2200);
  }
}

export const soundFX = new ArenaAudioEngine();

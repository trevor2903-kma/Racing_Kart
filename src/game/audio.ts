/**
 * Procedural Web Audio synthesizer for arcade kart sound effects and engine hum.
 */

class KartAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineRunning = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(muted ? 0 : 0.04, this.ctx.currentTime, 0.05);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public startEngine(): void {
    this.unlock();
    if (!this.ctx || this.engineRunning) return;
    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.value = 62;
      filter.type = 'lowpass';
      filter.frequency.value = 260;
      gain.gain.value = this.muted ? 0 : 0.035;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();

      this.engineOsc = osc;
      this.engineGain = gain;
      this.engineRunning = true;
    } catch {
      // Ignore audio errors in restricted headless environments
    }
  }

  public updateEngine(speedRatio: number, isBoosted: boolean, active: boolean): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain) return;
    const now = this.ctx.currentTime;
    if (!active || this.muted) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      return;
    }
    const baseFreq = 58 + Math.min(1.4, Math.abs(speedRatio)) * 88 + (isBoosted ? 36 : 0);
    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.engineGain.gain.setTargetAtTime(0.038 + Math.min(1, speedRatio) * 0.02, now, 0.06);
  }

  public stopEngine(): void {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
    }
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    volume = 0.12
  ): void {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Ignore
    }
  }

  public playCountdownTick(isGo: boolean): void {
    this.unlock();
    if (isGo) {
      this.playTone(587.33, 880, 0.38, 'square', 0.13);
    } else {
      this.playTone(440, 420, 0.18, 'triangle', 0.11);
    }
  }

  public playItemPickup(): void {
    this.playTone(523.25, 1046.5, 0.22, 'sine', 0.11);
  }

  public playCoinPickup(): void {
    this.playTone(987.77, 1318.51, 0.14, 'sine', 0.1);
  }

  public playBoost(): void {
    this.playTone(220, 680, 0.32, 'sawtooth', 0.11);
  }

  public playBananaDrop(): void {
    this.playTone(360, 190, 0.14, 'triangle', 0.1);
  }

  public playRocketLaunch(): void {
    this.playTone(480, 140, 0.25, 'sawtooth', 0.12);
  }

  public playSpinout(): void {
    this.playTone(620, 150, 0.45, 'sawtooth', 0.13);
  }

  public playBump(intensity = 0.5): void {
    this.playTone(130, 65, 0.09, 'square', 0.06 * Math.max(0.3, intensity));
  }

  public playLapComplete(isFinalFinish: boolean): void {
    if (isFinalFinish) {
      this.playTone(523.25, 1046.5, 0.45, 'triangle', 0.14);
      setTimeout(() => this.playTone(659.25, 1318.5, 0.5, 'triangle', 0.14), 140);
    } else {
      this.playTone(587.33, 880, 0.28, 'triangle', 0.12);
    }
  }
}

export const kartAudio = new KartAudioEngine();

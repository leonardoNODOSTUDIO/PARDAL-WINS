/**
 * Simple sound synthesizer using Web Audio API
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgOsc: OscillatorNode | null = null;
  private bgGain: GainNode | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(value: number) {
    this.init();
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(value, this.ctx!.currentTime, 0.1);
    }
  }

  playClick() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  startAmbience() {
    this.init();
    if (!this.ctx || !this.masterGain || this.bgOsc) return;

    this.bgOsc = this.ctx.createOscillator();
    this.bgGain = this.ctx.createGain();
    
    this.bgOsc.type = 'sine';
    this.bgOsc.frequency.setValueAtTime(110, this.ctx.currentTime); // Low drone
    
    this.bgGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.bgGain.gain.linearRampToValueAtTime(0.02, this.ctx.currentTime + 2);
    
    this.bgOsc.connect(this.bgGain);
    this.bgGain.connect(this.masterGain);
    
    this.bgOsc.start();
  }

  stopAmbience() {
    if (this.bgGain && this.ctx) {
      this.bgGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
      setTimeout(() => {
        this.bgOsc?.stop();
        this.bgOsc = null;
        this.bgGain = null;
      }, 1000);
    }
  }
}

export const sounds = new SoundEngine();

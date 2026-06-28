type SoundName = "ward" | "heal" | "rescue" | "death" | "footstep" | "danger" | "victory" | "defeat";

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _volume = 0.5;
  private _muted = false;
  private buffers = new Map<SoundName, AudioBuffer>();
  private loaded = false;

  get volume() { return this._volume; }
  get muted() { return this._muted; }

  async init() {
    if (this.loaded) {
      this.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._muted ? 0 : this._volume;
      this.masterGain.connect(this.ctx.destination);

      await this.loadSounds();
      this.loaded = true;
    } catch (e) {
      console.warn("Audio unavailable:", e);
    }
  }

  private resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(e => console.warn("Failed to resume AudioContext:", e));
    }
  }

  private async loadSounds() {
    const sounds: Record<SoundName, [number, number]> = {
      ward: [200, 0.3],
      heal: [400, 0.3],
      rescue: [600, 0.5],
      death: [100, 0.4],
      footstep: [80, 0.05],
      danger: [150, 0.2],
      victory: [800, 0.8],
      defeat: [100, 0.8],
    };

    if (!this.ctx) return;

    for (const [name, [freq, dur]] of Object.entries(sounds)) {
      const buffer = this.generateTone(freq, dur);
      this.buffers.set(name as SoundName, buffer);
    }
  }

  private generateTone(freq: number, duration: number): AudioBuffer {
    const sr = this.ctx!.sampleRate;
    const length = Math.max(1, Math.floor(sr * duration));
    const buffer = this.ctx!.createBuffer(1, length, sr);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const t = i / sr;
      const envelope = Math.max(0, 1 - t / duration);
      data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.3;
      data[i] += Math.sin(2 * Math.PI * freq * 1.5 * t) * envelope * 0.1;
    }
    return buffer;
  }

  play(name: SoundName) {
    if (!this.ctx || !this.masterGain || this._muted) return;
    this.resume();
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.masterGain);
    src.start();
  }

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this._muted ? 0 : this._volume;
  }

  toggleMute() {
    this._muted = !this._muted;
    if (this.masterGain) this.masterGain.gain.value = this._muted ? 0 : this._volume;
    return this._muted;
  }
}

export const audio = new AudioManager();

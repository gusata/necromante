/**
 * Áudio 100% sintetizado com WebAudio: efeitos e trilha procedural.
 * Nenhum arquivo de som; tudo nasce aqui.
 */

type Sfx =
  | 'bolt'
  | 'hit'
  | 'hitDead'
  | 'death'
  | 'bones'
  | 'raise'
  | 'explode'
  | 'fuse'
  | 'consume'
  | 'hurt'
  | 'heal'
  | 'holy'
  | 'bell'
  | 'boss'
  | 'bossDeath'
  | 'card'
  | 'click'
  | 'synergy'
  | 'scream'
  | 'warn'
  | 'slam'
  | 'whoosh'
  | 'arrow'
  | 'burn'
  | 'soul'
  | 'gameOver'
  | 'buy'
  | 'deny';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private last = new Map<string, number>();
  sfxOn = true;
  musicOn = true;
  analyser: AnalyserNode | null = null;

  /** Nível do sinal de saída (RMS 0..1). Usado no debug para conferir que há som. */
  level(): number {
    if (!this.analyser) return 0;
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    return Math.sqrt(sum / buf.length);
  }

  get state(): string {
    return this.ctx?.state ?? 'sem contexto';
  }

  // música
  private region = 0;
  private intensity = 0;
  private nextNote = 0;
  private step = 0;
  timer: number | null = null;
  private drone: { osc: OscillatorNode[]; gain: GainNode; filter: BiquadFilterNode } | null = null;

  /** Precisa ser chamado num gesto do usuário (toque/clique). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.master.connect(comp).connect(this.ctx.destination);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    comp.connect(this.analyser);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? 0.55 : 0;
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.32 : 0;
    this.musicBus.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startMusic();
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05);
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.2);
  }

  // ------------------------------------------------------------ primitivas

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, bus?: AudioNode) {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hiss(dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType = 'lowpass', delay = 0, q = 1, bus?: AudioNode) {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(bus ?? this.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  private bellTone(f: number, vol: number, dur: number, delay = 0, bus?: AudioNode) {
    for (const [mult, v] of [
      [1, 1],
      [2.01, 0.5],
      [2.76, 0.35],
      [5.4, 0.15],
    ]) this.tone('sine', f * mult, f * mult * 0.995, dur / (mult * 0.6), vol * v, delay, bus);
  }

  // ------------------------------------------------------------ efeitos

  play(name: Sfx, pitch = 1): void {
    if (!this.ctx || !this.sfxOn) return;
    const now = this.ctx.currentTime;
    const gap = name === 'bolt' || name === 'hit' || name === 'hitDead' ? 0.035 : 0.06;
    if ((this.last.get(name) ?? 0) + gap > now) return;
    this.last.set(name, now);
    const r = (a: number) => a * (0.92 + Math.random() * 0.16) * pitch;
    switch (name) {
      case 'bolt':
        this.tone('square', r(1300), r(380), 0.07, 0.05);
        this.hiss(0.05, 0.04, 5000, 2000, 'highpass');
        break;
      case 'hit':
        this.hiss(0.06, 0.12, r(2200), 600, 'bandpass', 0, 2);
        this.tone('triangle', r(180), 90, 0.06, 0.08);
        break;
      case 'hitDead':
        this.tone('square', r(900), r(500), 0.04, 0.04);
        this.hiss(0.04, 0.06, 4000, 2500, 'bandpass', 0, 4);
        break;
      case 'death':
        this.hiss(0.18, 0.14, 1400, 200, 'lowpass');
        this.tone('sine', r(150), 50, 0.2, 0.15);
        break;
      case 'bones':
        for (let i = 0; i < 4; i++) this.tone('square', r(1200 + i * 300), r(700), 0.03, 0.035, i * 0.025);
        break;
      case 'raise':
        [0, 3, 7, 12].forEach((s, i) => this.tone('sine', r(220 * 2 ** (s / 12)), r(220 * 2 ** (s / 12)), 0.22, 0.06, i * 0.05));
        this.hiss(0.3, 0.05, 300, 1800, 'bandpass', 0, 3);
        break;
      case 'explode':
        this.hiss(0.45, 0.35, 2400, 80, 'lowpass');
        this.tone('sine', r(110), 35, 0.35, 0.35);
        this.tone('square', r(70), 30, 0.2, 0.08);
        break;
      case 'fuse':
        this.tone('sawtooth', r(80), r(160), 0.35, 0.12);
        this.hiss(0.3, 0.12, 300, 3000, 'bandpass', 0, 2);
        [0, 7, 12].forEach((s, i) => this.tone('triangle', 110 * 2 ** (s / 12), 110 * 2 ** (s / 12), 0.5, 0.06, 0.1 + i * 0.03));
        break;
      case 'consume':
        this.tone('sine', r(200), r(900), 0.3, 0.12);
        this.tone('triangle', r(400), r(1200), 0.25, 0.05, 0.05);
        break;
      case 'hurt':
        this.tone('sawtooth', r(220), 70, 0.25, 0.2);
        this.hiss(0.2, 0.2, 1200, 200, 'lowpass');
        break;
      case 'heal':
        [0, 4, 7].forEach((s, i) => this.tone('sine', r(660 * 2 ** (s / 12)), r(660 * 2 ** (s / 12)), 0.3, 0.035, i * 0.04));
        break;
      case 'holy':
        this.bellTone(r(880), 0.06, 0.6);
        this.hiss(0.25, 0.05, 6000, 3000, 'highpass');
        break;
      case 'bell':
        this.bellTone(110, 0.22, 2.4);
        this.bellTone(165, 0.08, 1.8, 0.02);
        break;
      case 'boss':
        this.tone('sawtooth', 55, 45, 1.6, 0.2);
        this.tone('sawtooth', 55.8, 44, 1.6, 0.15);
        this.hiss(1.2, 0.18, 300, 60, 'lowpass');
        this.bellTone(73, 0.2, 3);
        break;
      case 'bossDeath':
        this.hiss(1.4, 0.4, 3000, 40, 'lowpass');
        this.tone('sine', 90, 25, 1.2, 0.4);
        [0, 3, 7, 10, 15].forEach((s, i) => this.tone('triangle', 220 * 2 ** (s / 12), 220 * 2 ** (s / 12), 1.6, 0.05, 0.2 + i * 0.08));
        break;
      case 'card':
        [0, 7, 12, 19].forEach((s, i) => this.tone('triangle', 440 * 2 ** (s / 12), 440 * 2 ** (s / 12), 0.18, 0.04, i * 0.035));
        break;
      case 'click':
        this.tone('square', 1800, 1200, 0.025, 0.04);
        break;
      case 'synergy':
        [0, 3, 7, 12, 15, 19, 24].forEach((s, i) => this.tone('sine', 220 * 2 ** (s / 12), 220 * 2 ** (s / 12), 0.6, 0.06, i * 0.06));
        this.bellTone(220, 0.12, 2);
        break;
      case 'scream':
        this.hiss(0.9, 0.22, 900, 4000, 'bandpass', 0, 8);
        this.tone('sawtooth', 700, 1400, 0.8, 0.05);
        break;
      case 'warn':
        this.tone('square', 260, 260, 0.08, 0.05);
        this.tone('square', 260, 260, 0.08, 0.05, 0.12);
        break;
      case 'slam':
        this.hiss(0.5, 0.35, 1200, 50, 'lowpass');
        this.tone('sine', 80, 30, 0.45, 0.4);
        break;
      case 'whoosh':
        this.hiss(0.3, 0.15, 400, 3000, 'bandpass', 0, 2);
        break;
      case 'arrow':
        this.hiss(0.12, 0.06, 3000, 1500, 'bandpass', 0, 6);
        break;
      case 'burn':
        this.hiss(0.3, 0.08, 1500, 600, 'bandpass', 0, 1);
        break;
      case 'soul':
        this.tone('sine', r(1200), r(1800), 0.08, 0.03);
        break;
      case 'gameOver':
        [12, 10, 7, 3, 0].forEach((s, i) => this.tone('triangle', 220 * 2 ** (s / 12), 220 * 2 ** (s / 12), 0.7, 0.08, i * 0.22));
        this.bellTone(55, 0.25, 4, 1.1);
        break;
      case 'buy':
        [0, 4, 7, 12].forEach((s, i) => this.tone('square', 330 * 2 ** (s / 12), 330 * 2 ** (s / 12), 0.12, 0.04, i * 0.04));
        this.bellTone(660, 0.05, 0.8, 0.16);
        break;
      case 'deny':
        this.tone('square', 140, 100, 0.15, 0.06);
        break;
    }
  }

  // ------------------------------------------------------------ música

  /** Região 0..3, 4+ = abismo. */
  setRegion(region: number) {
    this.region = region;
    if (this.drone && this.ctx) {
      const root = this.root();
      this.drone.osc.forEach((o, i) => o.frequency.setTargetAtTime(root / 2 * (i === 2 ? 1.5 : 1) * (1 + (i - 1) * 0.003), this.ctx!.currentTime, 1.5));
    }
  }

  /** 0 = calmo, 1 = combate, 2 = chefe. */
  setIntensity(level: number) {
    this.intensity = level;
    if (this.drone && this.ctx) this.drone.filter.frequency.setTargetAtTime(level >= 2 ? 900 : level === 1 ? 500 : 300, this.ctx.currentTime, 0.8);
  }

  private root() {
    return [73.42, 69.3, 65.41, 61.74, 55][Math.min(4, this.region)] * 2; // D, C#, C, B, A
  }

  private startMusic() {
    const c = this.ctx!;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.Q.value = 4;
    const gain = c.createGain();
    gain.gain.value = 0.14;
    filter.connect(gain).connect(this.musicBus);
    const osc = [0, 1, 2].map((i) => {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = (this.root() / 2) * (i === 2 ? 1.5 : 1) * (1 + (i - 1) * 0.003);
      o.connect(filter);
      o.start();
      return o;
    });
    // LFO lento no filtro: respiração
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    this.drone = { osc, gain, filter };
    this.nextNote = c.currentTime + 0.2;
    this.timer = window.setInterval(() => this.schedule(), 100);
  }

  private schedule() {
    const c = this.ctx;
    if (!c) return;
    const bpm = this.intensity >= 2 ? 96 : this.intensity === 1 ? 78 : 64;
    const stepDur = 60 / bpm / 2;
    // escala menor harmônica
    const scale = [0, 2, 3, 5, 7, 8, 11, 12];
    const pattern = [0, 4, 2, 5, 4, 7, 5, 3, 0, 4, 2, 6, 4, 7, 6, 2];
    while (this.nextNote < c.currentTime + 0.3) {
      const s = this.step++;
      const t = this.nextNote - c.currentTime;
      const root = this.root();
      if (this.musicOn) {
        // arpejo
        if (s % 2 === 0 || this.intensity >= 1) {
          const deg = scale[pattern[s % pattern.length] % scale.length];
          const f = root * 2 * 2 ** (deg / 12);
          this.tone('triangle', f, f, stepDur * 1.8, this.intensity >= 1 ? 0.05 : 0.035, t, this.musicBus);
        }
        // baixo
        if (s % 8 === 0) this.tone('sine', root, root, stepDur * 7, 0.18, t, this.musicBus);
        if (s % 8 === 4 && this.intensity >= 1) this.tone('sine', root * 2 ** (7 / 12), root * 2 ** (7 / 12), stepDur * 3, 0.12, t, this.musicBus);
        // sino distante
        if (s % 32 === 0) this.bellTone(root * 2, 0.05, 3, t, this.musicBus);
        // percussão no combate
        if (this.intensity >= 1 && s % 4 === 0) {
          this.tone('sine', 90, 35, 0.25, this.intensity >= 2 ? 0.3 : 0.18, t, this.musicBus);
        }
        if (this.intensity >= 2 && s % 2 === 1) this.hiss(0.05, 0.05, 8000, 5000, 'highpass', t, 1, this.musicBus);
        if (this.intensity >= 2 && s % 8 === 6) this.hiss(0.18, 0.12, 2500, 400, 'bandpass', t, 1, this.musicBus);
      }
      this.nextNote += stepDur;
    }
  }
}

export const audio = new AudioEngine();
export type { Sfx };

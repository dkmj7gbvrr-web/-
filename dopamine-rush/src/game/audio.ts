/**
 * Web Audio API による合成音（音源ファイルは使わない）。
 * 設計方針：
 *  - 釘に当たる音はペンタトニック音階で1打ごとに音程が上がる → どう鳴っても不協和にならず「上がっていく」快感だけが残る
 *  - 報酬の大きさ ＝ 音の厚み・長さ・音程の高さ で階層化する
 *  - 大当たり中は「歓喜の歌」（ベートーヴェン、パブリックドメイン）を合成して流す
 */

type Voice = 'square' | 'triangle' | 'sine' | 'sawtooth'

const PENTA = [0, 2, 4, 7, 9]
const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

class Audio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicBus: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  muted = false
  private music: MusicLoop | null = null

  /** ユーザー操作の中で呼ぶ（ブラウザの自動再生制限のため） */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      const comp = this.ctx.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.ratio.value = 6
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.9
      this.master.connect(comp)
      comp.connect(this.ctx.destination)
      this.musicBus = this.ctx.createGain()
      this.musicBus.gain.value = 0.55
      this.musicBus.connect(this.master)
      const len = this.ctx.sampleRate
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const data = this.noiseBuf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  /** 広告の再生中はゲームの音を完全に止める */
  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02)
  }

  private get ready() {
    return this.ctx !== null && this.master !== null && !this.muted
  }

  tone(
    freq: number,
    dur: number,
    opts: { type?: Voice; gain?: number; attack?: number; slideTo?: number; delay?: number; bus?: GainNode } = {},
  ) {
    if (!this.ready) return
    const ctx = this.ctx!
    const t0 = ctx.currentTime + (opts.delay ?? 0)
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = opts.type ?? 'triangle'
    osc.frequency.setValueAtTime(freq, t0)
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur)
    const peak = opts.gain ?? 0.15
    const atk = opts.attack ?? 0.004
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(opts.bus ?? this.master!)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  noise(dur: number, opts: { gain?: number; from?: number; to?: number; delay?: number; q?: number } = {}) {
    if (!this.ready || !this.noiseBuf) return
    const ctx = this.ctx!
    const t0 = ctx.currentTime + (opts.delay ?? 0)
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = opts.q ?? 1.2
    f.frequency.setValueAtTime(opts.from ?? 2000, t0)
    f.frequency.exponentialRampToValueAtTime(opts.to ?? opts.from ?? 2000, t0 + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(opts.gain ?? 0.2, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(f)
    f.connect(g)
    g.connect(this.master!)
    src.start(t0)
    src.stop(t0 + dur + 0.02)
  }

  /** 釘ヒット：n 打目ほど高い音（C5 ペンタトニックを上っていく） */
  peg(n: number) {
    const k = Math.min(n, 17)
    const midi = 72 + Math.floor(k / 5) * 12 + PENTA[k % 5]
    this.tone(midiToFreq(midi), 0.22, { type: 'triangle', gain: 0.07 })
    this.tone(midiToFreq(midi + 12), 0.08, { type: 'sine', gain: 0.025 })
  }

  gold() {
    this.tone(1318.5, 0.5, { type: 'sine', gain: 0.12 })
    this.tone(1975.5, 0.6, { type: 'sine', gain: 0.08, delay: 0.05 })
    this.tone(2637, 0.5, { type: 'sine', gain: 0.05, delay: 0.1 })
  }

  bonusPocket(payout: number) {
    for (let i = 0; i < Math.min(payout, 5); i++) {
      this.tone(midiToFreq(84 + PENTA[i % 5]), 0.1, { type: 'square', gain: 0.035, delay: i * 0.045 })
    }
  }

  startPocket() {
    this.tone(330, 0.18, { type: 'sawtooth', gain: 0.06, slideTo: 1320 })
    this.tone(660, 0.25, { type: 'triangle', gain: 0.08, slideTo: 1760, delay: 0.03 })
  }

  holdChange(level: number) {
    for (let i = 0; i < 3 + level; i++) {
      this.tone(midiToFreq(79 + i * 4), 0.14, { type: 'square', gain: 0.05, delay: i * 0.05 })
    }
  }

  reelTick() {
    this.noise(0.03, { gain: 0.05, from: 3500 })
  }

  reelStop(heavy = false) {
    this.tone(heavy ? 90 : 140, heavy ? 0.28 : 0.14, { type: 'sine', gain: heavy ? 0.35 : 0.2, slideTo: 45 })
    this.noise(0.06, { gain: 0.12, from: 1200 })
  }

  reach() {
    for (let i = 0; i < 4; i++) {
      this.tone(i % 2 ? 988 : 1319, 0.12, { type: 'square', gain: 0.07, delay: i * 0.12 })
    }
  }

  heartbeat() {
    this.tone(62, 0.16, { type: 'sine', gain: 0.4, slideTo: 40 })
    this.tone(58, 0.18, { type: 'sine', gain: 0.3, slideTo: 38, delay: 0.19 })
  }

  /** 緊張を高める上昇音（dur 秒かけて上がる） */
  riser(dur: number, intensity = 1) {
    this.tone(110, dur, { type: 'sawtooth', gain: 0.05 * intensity, slideTo: 880, attack: dur * 0.9 })
    this.noise(dur, { gain: 0.12 * intensity, from: 300, to: 7000, q: 3 })
  }

  impact() {
    this.tone(140, 0.6, { type: 'sine', gain: 0.5, slideTo: 32 })
    this.noise(0.35, { gain: 0.35, from: 5000, to: 300, q: 0.7 })
  }

  /** 「確定」を知らせる甲高い音 */
  kakutei() {
    this.tone(2093, 0.9, { type: 'sine', gain: 0.18, slideTo: 2217 })
    this.tone(4186, 0.9, { type: 'sine', gain: 0.06 })
  }

  miss() {
    this.tone(220, 0.35, { type: 'triangle', gain: 0.06, slideTo: 150 })
  }

  fanfare() {
    const seq = [60, 64, 67, 72, 76, 79, 84]
    seq.forEach((m, i) => this.tone(midiToFreq(m), 0.25, { type: 'square', gain: 0.07, delay: i * 0.06 }))
    ;[72, 76, 79, 84].forEach((m) =>
      this.tone(midiToFreq(m), 1.3, { type: 'sawtooth', gain: 0.05, delay: 0.45, attack: 0.02 }),
    )
    this.impact()
  }

  /** 払い出しカウントアップの刻み音。連続するほど高くなる */
  countTick(i: number) {
    this.tone(midiToFreq(84 + (i % 12)), 0.05, { type: 'square', gain: 0.03 })
  }

  levelUp() {
    ;[67, 71, 74, 79, 83, 86].forEach((m, i) =>
      this.tone(midiToFreq(m), 0.3, { type: 'square', gain: 0.06, delay: i * 0.07 }),
    )
  }

  /** 発展!? の警告音 */
  develop() {
    for (let i = 0; i < 6; i++) {
      this.tone(i % 2 ? 1568 : 2093, 0.09, { type: 'square', gain: 0.06, delay: i * 0.09 })
    }
    this.riser(1.0, 0.8)
  }

  /** 期待を外したときの「ガクッ」 */
  fall() {
    this.tone(420, 0.5, { type: 'sawtooth', gain: 0.07, slideTo: 90 })
    this.tone(90, 0.4, { type: 'sine', gain: 0.3, slideTo: 40 })
  }

  /** 揃いかけの瞬間（ファンファーレの頭だけ） */
  tease() {
    ;[60, 64, 67].forEach((m, i) => this.tone(midiToFreq(m + 12), 0.2, { type: 'square', gain: 0.07, delay: i * 0.05 }))
  }

  rendaTap(n: number) {
    const k = Math.min(n, 24)
    const midi = 72 + Math.floor(k / 5) * 12 + PENTA[k % 5]
    this.tone(midiToFreq(midi), 0.08, { type: 'square', gain: 0.05 })
    this.noise(0.04, { gain: 0.08, from: 4000 })
  }

  /** コマ送りの1コマ。遅いコマほど重く */
  crawl(slow: boolean, last: boolean) {
    this.tone(last ? 70 : slow ? 110 : 180, last ? 0.3 : 0.12, { type: 'sine', gain: last ? 0.4 : slow ? 0.25 : 0.12, slideTo: 40 })
    this.noise(0.04, { gain: slow ? 0.14 : 0.07, from: 2500 })
  }

  /** 暗転中の低い持続音 */
  drone(dur: number) {
    this.tone(55, dur, { type: 'sine', gain: 0.18, attack: 0.3 })
    this.tone(82.4, dur, { type: 'triangle', gain: 0.05, attack: 0.5 })
  }

  private ducked = false
  /** 暗転・タメの間は BGM を消す（無音で溜める） */
  duck(on: boolean) {
    if (on === this.ducked || !this.ctx || !this.musicBus) return
    this.ducked = on
    this.musicBus.gain.setTargetAtTime(on ? 0 : 0.55, this.ctx.currentTime, on ? 0.03 : 0.15)
  }

  playMusic(kind: 'fever' | 'rush' | null, bpm = 150) {
    if (this.music) {
      this.music.stop()
      this.music = null
    }
    if (!kind || !this.ctx || !this.musicBus) return
    this.music = new MusicLoop(this, kind === 'fever' ? odeToJoy() : rushLoop(), bpm)
    this.music.start()
  }

  setTempo(bpm: number) {
    if (this.music) this.music.bpm = bpm
  }

  /** MusicLoop 用：指定時刻に1音鳴らす */
  scheduleNote(when: number, freq: number, dur: number, type: Voice, gain: number) {
    if (!this.ctx || !this.musicBus) return
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, when)
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(gain, when + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    osc.connect(g)
    g.connect(this.musicBus)
    osc.start(when)
    osc.stop(when + dur + 0.02)
  }

  scheduleKick(when: number) {
    if (!this.ctx || !this.musicBus) return
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.frequency.setValueAtTime(150, when)
    osc.frequency.exponentialRampToValueAtTime(40, when + 0.12)
    g.gain.setValueAtTime(0.5, when)
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.16)
    osc.connect(g)
    g.connect(this.musicBus)
    osc.start(when)
    osc.stop(when + 0.2)
  }

  get now() {
    return this.ctx?.currentTime ?? 0
  }
}

/** [開始拍, 長さ(拍), MIDI ノート（0=キック）, 音色, 音量] */
type Note = [number, number, number, Voice, number]
interface Pattern {
  beats: number
  notes: Note[]
}

class MusicLoop {
  private timer: number | undefined
  /** 現在のループの開始拍（絶対拍） */
  private loopStart = 0
  private index = 0
  /** テンポ変更に追従するため、直近に予約した音の (拍, 時刻) を基準点にする */
  private anchorBeat = 0
  private anchorTime = 0
  bpm: number
  private readonly audio: Audio
  private readonly pattern: Pattern

  constructor(audio: Audio, pattern: Pattern, bpm: number) {
    this.audio = audio
    this.pattern = pattern
    this.bpm = bpm
  }

  start() {
    this.anchorTime = this.audio.now + 0.05
    this.timer = window.setInterval(() => this.tick(), 25)
  }

  stop() {
    if (this.timer !== undefined) window.clearInterval(this.timer)
  }

  private tick() {
    const horizon = this.audio.now + 0.12
    const notes = this.pattern.notes
    while (true) {
      const note = notes[this.index]
      const beat = this.loopStart + note[0]
      const spb = 60 / this.bpm
      const when = this.anchorTime + (beat - this.anchorBeat) * spb
      if (when > horizon) break
      const [, dur, midi, type, gain] = note
      const at = Math.max(when, this.audio.now)
      if (!this.audio.muted) {
        if (midi === 0) this.audio.scheduleKick(at)
        else this.audio.scheduleNote(at, midiToFreq(midi), dur * spb * 0.95, type, gain)
      }
      this.anchorBeat = beat
      this.anchorTime = when
      this.index++
      if (this.index >= notes.length) {
        this.index = 0
        this.loopStart += this.pattern.beats
      }
    }
  }
}

/** 歓喜の歌（第4楽章主題）。C メジャー、4分音符=1拍 */
function odeToJoy(): Pattern {
  const E = 76, F = 77, G = 79, D = 74, C = 72, G3 = 67
  const phrase = (end: 'D' | 'C'): Array<[number, number]> => [
    [E, 1], [E, 1], [F, 1], [G, 1], [G, 1], [F, 1], [E, 1], [D, 1],
    [C, 1], [C, 1], [D, 1], [E, 1],
    ...(end === 'D' ? ([[E, 1.5], [D, 0.5], [D, 2]] as Array<[number, number]>) : ([[D, 1.5], [C, 0.5], [C, 2]] as Array<[number, number]>)),
  ]
  const bridge: Array<[number, number]> = [
    [D, 1], [D, 1], [E, 1], [C, 1], [D, 1], [E, 0.5], [F, 0.5], [E, 1], [C, 1],
    [D, 1], [E, 0.5], [F, 0.5], [E, 1], [D, 1], [C, 1], [D, 1], [G3, 2],
  ]
  const melody = [...phrase('D'), ...phrase('C'), ...bridge, ...phrase('C')]
  const notes: Note[] = []
  let t = 0
  for (const [m, d] of melody) {
    notes.push([t, d, m, 'square', 0.08])
    notes.push([t, d, m + 12, 'sine', 0.035])
    t += d
  }
  // ベース（1小節=4拍ごとのルート）とキック
  const roots = [48, 43, 48, 43, 48, 43, 48, 48, 43, 43, 48, 43, 48, 43, 48, 48]
  roots.forEach((r, bar) => {
    for (let b = 0; b < 4; b++) {
      notes.push([bar * 4 + b, 0.5, r, 'triangle', 0.14])
      notes.push([bar * 4 + b, 0.2, 0, 'sine', 0])
      notes.push([bar * 4 + b + 0.5, 0.4, r + 12, 'triangle', 0.07])
    }
  })
  notes.sort((a, b) => a[0] - b[0])
  return { beats: t, notes }
}

/** RUSH 用：Am-F-C-G の16分アルペジオ＋4つ打ち */
function rushLoop(): Pattern {
  const chords = [
    [57, 60, 64, 69],
    [53, 57, 60, 65],
    [48, 52, 55, 60],
    [55, 59, 62, 67],
  ]
  const notes: Note[] = []
  chords.forEach((ch, bar) => {
    for (let s = 0; s < 16; s++) {
      const beat = bar * 4 + s * 0.25
      const m = ch[[0, 1, 2, 3, 2, 1][s % 6]] + 12
      notes.push([beat, 0.25, m, 'square', 0.045])
    }
    for (let b = 0; b < 4; b++) {
      notes.push([bar * 4 + b, 0.2, 0, 'sine', 0])
      notes.push([bar * 4 + b + 0.5, 0.45, ch[0] - 12, 'sawtooth', 0.06])
    }
  })
  notes.sort((a, b) => a[0] - b[0])
  return { beats: 16, notes }
}

export const audio = new Audio()

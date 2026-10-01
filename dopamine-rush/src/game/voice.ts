/**
 * ポッチの声。言葉ではなく、生き物の鳴き声として合成する（録音した音声は使っていない）。
 * ノコギリ波を「口の形」にあたる2つの帯域（フォルマント）に通し、音程を動かして鳴かせる。
 *  - chirp   ：短い「ピィ」
 *  - happy   ：弾む「キュッキュー」
 *  - excited ：早口の「キュルルル」から跳ね上がる
 *  - roar    ：低く唸る「ガオー」
 *  - sad     ：下がっていく「キュゥ…」
 */
export type PochiVoice = 'chirp' | 'happy' | 'excited' | 'roar' | 'sad'

export function schedulePochiVoice(ctx: BaseAudioContext, dest: AudioNode, t: number, kind: PochiVoice) {
  const syl = (at: number, f0: number, f1: number, dur: number, gain: number, growl = 0) => {
    const t0 = t + at
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(f0, t0)
    o.frequency.exponentialRampToValueAtTime(f1, t0 + dur)
    const f1f = ctx.createBiquadFilter()
    f1f.type = 'bandpass'
    f1f.frequency.value = Math.min(1400, f0 * 1.1)
    f1f.Q.value = 3
    const f2f = ctx.createBiquadFilter()
    f2f.type = 'bandpass'
    f2f.frequency.value = 2600
    f2f.Q.value = 4
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    if (growl > 0) {
      // 唸り：音量を速く揺らす
      const lfo = ctx.createOscillator()
      const lg = ctx.createGain()
      lfo.frequency.value = growl
      lg.gain.value = gain * 0.6
      lfo.connect(lg)
      lg.connect(g.gain)
      lfo.start(t0)
      lfo.stop(t0 + dur)
    }
    o.connect(f1f)
    o.connect(f2f)
    f1f.connect(g)
    f2f.connect(g)
    g.connect(dest)
    o.start(t0)
    o.stop(t0 + dur + 0.02)
  }
  const breath = (at: number, dur: number, gain: number) => {
    const len = Math.floor(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 700
    const g = ctx.createGain()
    g.gain.value = gain
    src.connect(f)
    f.connect(g)
    g.connect(dest)
    src.start(t + at)
  }
  switch (kind) {
    case 'chirp':
      syl(0, 900, 1500, 0.14, 0.9)
      break
    case 'happy':
      syl(0, 800, 1300, 0.1, 0.9)
      syl(0.13, 900, 1700, 0.22, 1)
      break
    case 'excited':
      for (let i = 0; i < 4; i++) syl(i * 0.075, 1100 + i * 120, 1500 + i * 150, 0.09, 0.8, 30)
      syl(0.32, 1300, 2000, 0.25, 1)
      break
    case 'roar':
      syl(0, 260, 380, 0.25, 1.2, 38)
      syl(0.22, 380, 200, 0.55, 1.3, 34)
      breath(0.05, 0.6, 0.25)
      break
    case 'sad':
      syl(0, 700, 360, 0.55, 0.7)
      break
  }
}

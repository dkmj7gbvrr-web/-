/**
 * 先バレの告知音「キュポン」（オリジナルの合成音。実機の音源は使っていない）。
 *  - 「キュ」：一瞬で高く駆け上がる明るい上昇音（注意を一気に引く）
 *  - 「ポン」：弾けるような短い打撃音＋鈴のような倍音の余韻（緊張がほどける）
 * BaseAudioContext を受け取るので、ゲーム内（AudioContext）でも書き出し（OfflineAudioContext）でも同じ音になる。
 */

export type KyuponVariant = 'a' | 'b' | 'c' | 'd' | 'e' | 'f'

interface Spec {
  /** 「キュ」の開始・終了周波数と長さ */
  kyuFrom: number
  kyuTo: number
  kyuDur: number
  /** 「キュ」のビブラート（Hz の揺れ幅） */
  vibrato: number
  /** 「ポン」の基音、余韻の長さ、重ねる倍音（基音に対する比率） */
  pon: number
  ponTail: number
  partials: number[]
  /** 低い「ドッ」の強さ */
  thump: number
}

export const KYUPON_SPECS: Record<'a' | 'b' | 'c', Spec> = {
  // A：標準。短く鋭い「キュ」と、澄んだ「ポン」
  a: { kyuFrom: 1300, kyuTo: 3200, kyuDur: 0.055, vibrato: 0, pon: 1568, ponTail: 0.45, partials: [2, 2.76], thump: 0.25 },
  // B：「キュイーン」と長めに伸びてから、高く澄んだ「ポン」
  b: { kyuFrom: 1100, kyuTo: 4200, kyuDur: 0.13, vibrato: 60, pon: 2093, ponTail: 0.7, partials: [2, 3, 4.2], thump: 0.15 },
  // C：重め。「ポン」が低めで、和音（長3度＋5度）の鈴が広がる
  c: { kyuFrom: 1400, kyuTo: 3000, kyuDur: 0.06, vibrato: 0, pon: 1047, ponTail: 0.6, partials: [1.26, 1.5, 2, 2.76], thump: 0.5 },
}

export function scheduleKyupon(ctx: BaseAudioContext, dest: AudioNode, t0: number, variant: KyuponVariant = 'a', volume = 1) {
  if (variant === 'd' || variant === 'e' || variant === 'f') {
    scheduleBakyun(ctx, dest, t0, BAKYUN_SPECS[variant], volume)
    return
  }
  const sp = KYUPON_SPECS[variant as 'a' | 'b' | 'c']
  const out = ctx.createGain()
  out.gain.value = volume
  // ほんの少しの残響（短いフィードバックディレイ）で「鳴り」を足す
  const delay = ctx.createDelay(0.5)
  delay.delayTime.value = 0.075
  const fb = ctx.createGain()
  fb.gain.value = 0.28
  const wet = ctx.createGain()
  wet.gain.value = 0.35
  out.connect(dest)
  out.connect(delay)
  delay.connect(fb)
  fb.connect(delay)
  delay.connect(wet)
  wet.connect(dest)

  const env = (g: GainNode, start: number, peak: number, attack: number, decay: number) => {
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(peak, start + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay)
  }

  // ---- キュ（上昇音）：サイン＋三角波を重ね、指数カーブで駆け上がる
  for (const [type, gain, mult] of [
    ['sine', 0.28, 1],
    ['triangle', 0.1, 2],
  ] as const) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(sp.kyuFrom * mult, t0)
    o.frequency.exponentialRampToValueAtTime(sp.kyuTo * mult, t0 + sp.kyuDur)
    if (sp.vibrato > 0) {
      const lfo = ctx.createOscillator()
      const lg = ctx.createGain()
      lfo.frequency.value = 28
      lg.gain.value = sp.vibrato * mult
      lfo.connect(lg)
      lg.connect(o.frequency)
      lfo.start(t0)
      lfo.stop(t0 + sp.kyuDur + 0.05)
    }
    env(g, t0, gain, 0.006, sp.kyuDur + 0.03)
    o.connect(g)
    g.connect(out)
    o.start(t0)
    o.stop(t0 + sp.kyuDur + 0.06)
  }

  // ---- ポン（打撃＋鈴の余韻）
  const tp = t0 + sp.kyuDur * 0.85
  // 基音：一瞬だけ高く当たってから少し下がる（弾ける感じ）
  {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(sp.pon * 1.12, tp)
    o.frequency.exponentialRampToValueAtTime(sp.pon, tp + 0.03)
    env(g, tp, 0.42, 0.003, sp.ponTail)
    o.connect(g)
    g.connect(out)
    o.start(tp)
    o.stop(tp + sp.ponTail + 0.05)
  }
  // 倍音（鈴のきらめき）。高い倍音ほど早く消える
  sp.partials.forEach((ratio, i) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(sp.pon * ratio, tp)
    env(g, tp, 0.16 / (i + 1), 0.003, sp.ponTail * (0.8 - i * 0.12))
    o.connect(g)
    g.connect(out)
    o.start(tp)
    o.stop(tp + sp.ponTail + 0.05)
  })
  // 低い「ドッ」：体に響く芯
  if (sp.thump > 0) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(220, tp)
    o.frequency.exponentialRampToValueAtTime(70, tp + 0.12)
    env(g, tp, sp.thump, 0.004, 0.14)
    o.connect(g)
    g.connect(out)
    o.start(tp)
    o.stop(tp + 0.2)
  }
  // 「ポッ」の破裂感：ごく短い高域ノイズ
  {
    const len = Math.floor(ctx.sampleRate * 0.02)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 3000
    const g = ctx.createGain()
    g.gain.value = 0.25
    src.connect(hp)
    hp.connect(g)
    g.connect(out)
    src.start(tp)
  }
}

/**
 * 「バキューン」型：
 *  - 「バ」：ノイズの破裂＋低い衝撃（一瞬で耳をつかむ）
 *  - 「キューン」：高い澄んだ音が、周波数の折れ線どおりに鳴り続け、残響で尾を引く
 */
interface BakyunSpec {
  /** 破裂の強さと、低い衝撃の開始周波数 */
  bang: number
  thumpFrom: number
  /** 「キューン」の周波数カーブ [秒, Hz]（最初の点は破裂の直後） */
  curve: Array<[number, number]>
  /** 「キューン」の全体の長さ */
  dur: number
  /** ビブラート（Hz）と、2本目の音のずらし（セント。0 なら1本） */
  vibrato: number
  detune: number
  /** 残響の量 */
  echo: number
}

export const BAKYUN_SPECS: Record<'d' | 'e' | 'f', BakyunSpec> = {
  // D：「バ」→ 高く跳ね上がってから少し落ちる「キューン」（跳弾のような弧）
  d: {
    bang: 0.5,
    thumpFrom: 260,
    curve: [
      [0, 1800],
      [0.04, 4200],
      [0.55, 2900],
    ],
    dur: 0.6,
    vibrato: 0,
    detune: 0,
    echo: 0.3,
  },
  // E：「バ」→ 一気に上がって高いまま震えながら伸びる「キュイーーン」
  e: {
    bang: 0.45,
    thumpFrom: 240,
    curve: [
      [0, 1500],
      [0.06, 3300],
      [0.7, 3700],
    ],
    dur: 0.75,
    vibrato: 45,
    detune: 0,
    echo: 0.35,
  },
  // F：重めの「バ」→ 2本の音がうなりながら上がる太い「キューン」と長い残響
  f: {
    bang: 0.75,
    thumpFrom: 180,
    curve: [
      [0, 1600],
      [0.05, 3600],
      [0.6, 3200],
    ],
    dur: 0.65,
    vibrato: 20,
    detune: 14,
    echo: 0.45,
  },
}

function scheduleBakyun(ctx: BaseAudioContext, dest: AudioNode, t0: number, sp: BakyunSpec, volume: number) {
  const out = ctx.createGain()
  out.gain.value = volume
  const delay = ctx.createDelay(0.5)
  delay.delayTime.value = 0.09
  const fb = ctx.createGain()
  fb.gain.value = sp.echo
  const wet = ctx.createGain()
  wet.gain.value = 0.4
  out.connect(dest)
  out.connect(delay)
  delay.connect(fb)
  fb.connect(delay)
  delay.connect(wet)
  wet.connect(dest)

  // ---- バ（破裂）：短いノイズを帯域を下げながら＋低い衝撃
  {
    const len = Math.floor(ctx.sampleRate * 0.09)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'lowpass'
    bp.frequency.setValueAtTime(9000, t0)
    bp.frequency.exponentialRampToValueAtTime(900, t0 + 0.08)
    const g = ctx.createGain()
    g.gain.value = sp.bang
    src.connect(bp)
    bp.connect(g)
    g.connect(out)
    src.start(t0)
  }
  {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.setValueAtTime(sp.thumpFrom, t0)
    o.frequency.exponentialRampToValueAtTime(55, t0 + 0.12)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(sp.bang * 0.9, t0 + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16)
    o.connect(g)
    g.connect(out)
    o.start(t0)
    o.stop(t0 + 0.2)
  }

  // ---- キューン：折れ線の周波数カーブで鳴り続ける高い音
  const tk = t0 + 0.012
  const voices = sp.detune > 0 ? [-sp.detune, sp.detune] : [0]
  for (const cents of voices) {
    for (const [type, gain, mult] of [
      ['sine', 0.3, 1],
      ['triangle', 0.07, 2],
    ] as const) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = type
      o.detune.value = cents
      const [, f0] = sp.curve[0]
      o.frequency.setValueAtTime(f0 * mult, tk)
      for (const [at, f] of sp.curve.slice(1)) o.frequency.exponentialRampToValueAtTime(f * mult, tk + at)
      if (sp.vibrato > 0) {
        const lfo = ctx.createOscillator()
        const lg = ctx.createGain()
        lfo.frequency.value = 9
        lg.gain.setValueAtTime(0, tk)
        lg.gain.linearRampToValueAtTime(sp.vibrato * mult, tk + sp.dur * 0.6)
        lfo.connect(lg)
        lg.connect(o.frequency)
        lfo.start(tk)
        lfo.stop(tk + sp.dur + 0.05)
      }
      const peak = gain / voices.length
      g.gain.setValueAtTime(0.0001, tk)
      g.gain.exponentialRampToValueAtTime(peak, tk + 0.01)
      g.gain.setValueAtTime(peak, tk + sp.dur * 0.45)
      g.gain.exponentialRampToValueAtTime(0.0001, tk + sp.dur)
      o.connect(g)
      g.connect(out)
      o.start(tk)
      o.stop(tk + sp.dur + 0.05)
    }
  }
}

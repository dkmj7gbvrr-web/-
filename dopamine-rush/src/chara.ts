/**
 * キャラクター「ポッチ」（たまごドラゴン）の描画と、演出イベントへの反応。
 * 画像ファイルは使わず Canvas 2D で描く。文字は使わず、表情・炎の色・大きさ・成長で語る。
 */

export type Mood = 'idle' | 'hype' | 'joy' | 'sad'

/** 成長段階：0＝卵の中 / 1＝殻から顔を出す / 2＝殻を脱いだ子竜 / 3＝若竜 / 4＝成竜 */
export type Stage = 0 | 1 | 2 | 3 | 4

export interface DragonLook {
  mood: Mood
  stage: Stage
  /** ラッキートリガー中は金色の竜になる */
  gold: boolean
  /** 殻のヒビの本数（先読みゾーンの連続回数） */
  cracks: number
  /** 卵が揺れる強さ 0〜1 */
  wobble: number
  /** 炎（色と強さ 0〜1）。'rainbow' は虹 */
  flame: { color: string; power: number } | null
  /** 違和感：瞳が金色に光る */
  eyeGold: boolean
}

const TAU = Math.PI * 2

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner = 0.45) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * inner : r
    const a = (i / 10) * TAU - Math.PI / 2
    if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
    else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fill()
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, mood: Mood, blink: boolean, gold: boolean) {
  ctx.strokeStyle = '#1a1030'
  ctx.lineCap = 'round'
  if (mood === 'joy') {
    ctx.lineWidth = r * 0.45
    ctx.beginPath()
    ctx.moveTo(x - r * 0.8, y + r * 0.2)
    ctx.quadraticCurveTo(x, y - r * 0.9, x + r * 0.8, y + r * 0.2)
    ctx.stroke()
    return
  }
  if (blink) {
    ctx.lineWidth = r * 0.35
    ctx.beginPath()
    ctx.moveTo(x - r * 0.7, y + r * 0.1)
    ctx.lineTo(x + r * 0.7, y + r * 0.1)
    ctx.stroke()
    return
  }
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.ellipse(x, y, r, r * (mood === 'sad' ? 0.8 : 1.12), 0, 0, TAU)
  ctx.fill()
  const pr = mood === 'hype' ? r * 0.72 : r * 0.6
  ctx.fillStyle = gold ? '#e0a800' : '#1a1030'
  ctx.beginPath()
  ctx.arc(x, y + r * (mood === 'sad' ? 0.25 : 0.1), pr, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(x - pr * 0.35, y - pr * 0.25, pr * 0.32, 0, TAU)
  ctx.fill()
  if (mood === 'hype' || gold) {
    ctx.fillStyle = gold ? '#fff7c0' : '#ffe23d'
    star(ctx, x + pr * 0.25, y + pr * 0.3, pr * 0.3, 0.5)
  }
  if (mood === 'sad') {
    // 下がったまぶた
    ctx.fillStyle = 'rgba(47,174,99,0.95)'
    ctx.beginPath()
    ctx.ellipse(x, y - r * 0.55, r * 1.1, r * 0.6, 0, 0, Math.PI)
    ctx.fill()
  }
}

function mouth(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, mood: Mood) {
  ctx.fillStyle = '#5a1020'
  ctx.strokeStyle = '#1a1030'
  ctx.lineWidth = Math.max(1.5, s * 0.08)
  ctx.lineCap = 'round'
  if (mood === 'joy') {
    ctx.beginPath()
    ctx.moveTo(x - s * 0.35, y)
    ctx.quadraticCurveTo(x, y + s * 0.7, x + s * 0.35, y)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#ff6f8f'
    ctx.beginPath()
    ctx.ellipse(x, y + s * 0.3, s * 0.16, s * 0.1, 0, 0, TAU)
    ctx.fill()
  } else if (mood === 'hype') {
    ctx.beginPath()
    ctx.ellipse(x, y + s * 0.1, s * 0.13, s * 0.18, 0, 0, TAU)
    ctx.fill()
  } else if (mood === 'sad') {
    ctx.beginPath()
    ctx.moveTo(x - s * 0.15, y + s * 0.12)
    ctx.quadraticCurveTo(x, y - s * 0.02, x + s * 0.15, y + s * 0.12)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(x - s * 0.15, y)
    ctx.quadraticCurveTo(x - s * 0.07, y + s * 0.12, x, y)
    ctx.quadraticCurveTo(x + s * 0.07, y + s * 0.12, x + s * 0.15, y)
    ctx.stroke()
  }
}

function flameColor(color: string, i: number, t: number, f: number): string {
  if (color === 'rainbow') return `hsla(${(i * 60 + t * 400) % 360},100%,60%,${1 - f})`
  return color.replace(')', `,${1 - f})`).replace('rgb(', 'rgba(')
}

/** s は頭の大きさの基準。x, y は頭の中心 */
export function drawDragon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, look: DragonLook, t: number) {
  const { mood, stage, gold } = look
  const blink = mood === 'idle' && t % 3.4 < 0.12
  const skinHi = gold ? '#fff3b0' : '#b8ffcf'
  const skin = gold ? '#e0a800' : '#2fae63'
  const wing = gold ? '#ffd23d' : '#5fd18a'
  ctx.save()
  ctx.translate(x, y)
  // 卵が揺れる（先読み・違和感）
  if (look.wobble > 0) ctx.rotate(Math.sin(t * 40) * 0.12 * look.wobble)
  const hop = mood === 'joy' ? -Math.abs(Math.sin(t * 6)) * s * 0.1 : mood === 'sad' ? s * 0.06 : Math.sin(t * 2) * s * 0.02

  // オーラ（成竜・金）
  if (stage >= 3 || gold) {
    const g = ctx.createRadialGradient(0, 0, s * 0.2, 0, 0, s * (stage >= 4 ? 1.3 : 1))
    g.addColorStop(0, gold ? 'rgba(255,220,80,0.45)' : 'rgba(120,255,170,0.3)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, s * 1.3, 0, TAU)
    ctx.fill()
  }

  ctx.save()
  ctx.translate(0, hop - s * 0.05)
  // 体としっぽ（殻を脱いだあと）
  if (stage >= 2) {
    ctx.fillStyle = skin
    ctx.beginPath()
    ctx.ellipse(0, s * 0.42, s * 0.3, s * 0.28, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = skinHi
    ctx.beginPath()
    ctx.ellipse(0, s * 0.46, s * 0.17, s * 0.2, 0, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = skin
    ctx.lineWidth = s * 0.12
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(s * 0.2, s * 0.55)
    ctx.quadraticCurveTo(s * 0.6, s * 0.6 + Math.sin(t * 3) * s * 0.08, s * 0.55, s * 0.25)
    ctx.stroke()
  }
  // 翼（段階が上がるほど大きい。盛り上がると羽ばたく）
  const wingSize = 0.42 + stage * 0.12
  ctx.fillStyle = wing
  for (const d of [-1, 1]) {
    ctx.save()
    ctx.translate(d * s * 0.3, s * 0.08)
    ctx.rotate(d * (0.4 + (mood === 'hype' || mood === 'joy' ? Math.sin(t * 12) * 0.35 : Math.sin(t * 2) * 0.05)))
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(d * s * wingSize * 0.85, -s * wingSize * 0.85, d * s * wingSize, -s * 0.05)
    ctx.quadraticCurveTo(d * s * wingSize * 0.6, -s * 0.02, d * s * wingSize * 0.66, s * 0.1)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  // 角（成長で伸びる）
  ctx.fillStyle = gold ? '#ffffff' : '#ffe9a8'
  const horn = 0.52 + stage * 0.05
  for (const d of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(d * s * 0.18, -s * 0.3)
    ctx.lineTo(d * s * 0.27, -s * horn)
    ctx.lineTo(d * s * 0.06, -s * 0.34)
    ctx.closePath()
    ctx.fill()
  }
  // 頭
  const head = ctx.createRadialGradient(-s * 0.1, -s * 0.15, s * 0.05, 0, 0, s * 0.42)
  head.addColorStop(0, skinHi)
  head.addColorStop(1, skin)
  ctx.fillStyle = head
  ctx.beginPath()
  ctx.ellipse(0, -s * 0.05, s * 0.36, s * 0.32, 0, 0, TAU)
  ctx.fill()
  eye(ctx, -s * 0.13, -s * 0.08, s * 0.1, mood, blink, look.eyeGold)
  eye(ctx, s * 0.13, -s * 0.08, s * 0.1, mood, blink, look.eyeGold)
  ctx.fillStyle = 'rgba(255,90,140,0.45)'
  for (const d of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(d * s * 0.22, s * 0.06, s * 0.06, s * 0.036, 0, 0, TAU)
    ctx.fill()
  }
  mouth(ctx, 0, s * 0.08, s * 0.45, mood)
  if (mood === 'sad') {
    // 涙
    ctx.fillStyle = 'rgba(120,200,255,0.9)'
    ctx.beginPath()
    ctx.ellipse(-s * 0.2, s * 0.05 + ((t * 30) % (s * 0.2)), s * 0.03, s * 0.05, 0, 0, TAU)
    ctx.fill()
  }
  ctx.restore()

  // 炎のブレス（色＝期待度）
  if (look.flame && look.flame.power > 0) {
    const p = look.flame.power
    for (let i = 0; i < 10; i++) {
      const f = (t * 3 + i / 10) % 1
      ctx.fillStyle = flameColor(look.flame.color, i, t, f)
      // 口から左上へ吹き出す（体に重ならない向き）
      ctx.beginPath()
      ctx.arc(
        -s * 0.12 - f * s * 1.9 * Math.max(0.5, p),
        hop + s * 0.06 - f * s * 0.6 * Math.max(0.5, p) + Math.sin(t * 20 + i) * s * 0.06 * f,
        s * (0.07 + f * 0.3) * Math.max(0.5, p),
        0,
        TAU,
      )
      ctx.fill()
    }
  }

  // 卵の殻（段階 0〜1）
  if (stage <= 1) {
    const top = stage === 0 ? -s * 0.25 : s * 0.12
    const egg = ctx.createLinearGradient(0, top, 0, s * 0.62)
    egg.addColorStop(0, '#fffaf0')
    egg.addColorStop(1, '#e9dcc0')
    ctx.fillStyle = egg
    ctx.beginPath()
    if (stage === 0) {
      // 丸ごとの卵（頭は隠れて目だけのぞく）
      ctx.ellipse(0, s * 0.18, s * 0.44, s * 0.5, 0, 0, TAU)
    } else {
      ctx.moveTo(-s * 0.42, s * 0.12)
      for (let i = 0; i <= 8; i++) ctx.lineTo(-s * 0.42 + (i / 8) * s * 0.84, s * 0.12 + (i % 2 ? -s * 0.08 : 0))
      ctx.bezierCurveTo(s * 0.45, s * 0.5, s * 0.25, s * 0.62, 0, s * 0.62)
      ctx.bezierCurveTo(-s * 0.25, s * 0.62, -s * 0.45, s * 0.5, -s * 0.42, s * 0.12)
    }
    ctx.fill()
    ctx.fillStyle = 'rgba(95,209,138,0.35)'
    for (const [dx, dy, r] of [
      [-0.2, 0.35, 0.06],
      [0.15, 0.45, 0.05],
      [0.25, 0.25, 0.04],
    ]) {
      ctx.beginPath()
      ctx.arc(dx * s, dy * s, r * s, 0, TAU)
      ctx.fill()
    }
    if (stage === 0) {
      // 殻ののぞき穴から目だけ見える
      ctx.fillStyle = '#1a1030'
      ctx.beginPath()
      ctx.ellipse(0, -s * 0.02, s * 0.2, s * 0.09, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = look.eyeGold ? '#ffd23d' : '#ffffff'
      for (const d of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(d * s * 0.08, -s * 0.02, s * 0.035, 0, TAU)
        ctx.fill()
      }
    }
    // ヒビ（先読みゾーンの回数ぶん）
    ctx.strokeStyle = '#6a5a40'
    ctx.lineWidth = Math.max(1, s * 0.025)
    for (let c = 0; c < Math.min(5, look.cracks); c++) {
      const cx = -s * 0.3 + c * s * 0.15
      ctx.beginPath()
      ctx.moveTo(cx, s * 0.2)
      ctx.lineTo(cx + s * 0.05, s * 0.3)
      ctx.lineTo(cx - s * 0.02, s * 0.38)
      ctx.lineTo(cx + s * 0.04, s * 0.48)
      ctx.stroke()
    }
  }

  if (mood === 'joy') {
    const colors = gold ? ['#ffd23d', '#ffffff', '#fff3b0'] : ['#ffe23d', '#5fd18a', '#ff6fb5']
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + t
      const d = s * (0.95 + 0.15 * Math.sin(t * 3 + i))
      ctx.fillStyle = colors[i % colors.length]
      star(ctx, Math.cos(a) * d, Math.sin(a) * d, s * 0.09)
    }
  }
  ctx.restore()
}

/** RUSH の連チャン数から成長段階を決める（文字を出さずに「伸びている」を見せる） */
export function stageForChain(chain: number, lt: boolean): Stage {
  if (lt) return 4
  if (chain <= 0) return 1
  if (chain <= 2) return 2
  if (chain <= 5) return 3
  return 4
}

/** 演出イベントに反応するキャラの状態（見た目だけ。ゲームの結果には関与しない） */
export class Chara {
  mood: Mood = 'idle'
  private moodTimer = 0
  /** 画面中央に大きく出ている時間（残り秒）と、出現アニメの進み 0〜1 */
  centerLeft = 0
  centerK = 0
  flame: { color: string; power: number } | null = null
  private flameTimer = 0
  wobble = 0
  /** 成長したときの光 */
  evolveFlash = 0

  react(mood: Mood, dur: number) {
    this.mood = mood
    this.moodTimer = dur
  }

  breathe(color: string, power: number, dur: number) {
    this.flame = { color, power }
    this.flameTimer = dur
  }

  /** 画面中央に大きく登場させる */
  center(dur: number) {
    this.centerLeft = Math.max(this.centerLeft, dur)
  }

  update(dt: number) {
    this.moodTimer -= dt
    if (this.moodTimer <= 0) this.mood = 'idle'
    this.flameTimer -= dt
    if (this.flameTimer <= 0) this.flame = null
    this.centerLeft = Math.max(0, this.centerLeft - dt)
    const target = this.centerLeft > 0 ? 1 : 0
    this.centerK += (target - this.centerK) * Math.min(1, dt * 10)
    this.wobble = Math.max(0, this.wobble - dt * 1.5)
    this.evolveFlash = Math.max(0, this.evolveFlash - dt)
  }
}

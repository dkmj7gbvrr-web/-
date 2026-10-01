import { AD_REWARD, FALLBACK_REWARD, type GateState } from './ads/refillGate'
import { drawDragon, type Chara, type DragonLook, type Stage } from './chara'
import type { Fx } from './fx'
import { holdLevel, PUSH_AUTO, type Game } from './game/game'
import { SPEC, SYMBOL_COUNT, type Custom, type HoldColor, type SignColor } from './game/odds'
import { BALL_R, BOARD_BOTTOM, BOARD_TOP, H, PEG_R, W, WALL_L, WALL_R } from './game/physics'
import { ATTACKER, BONUS_POCKETS, startPocket } from './game/pockets'

export interface Ui {
  /** 補給ボタンの状態（広告） */
  gate: GateState
  /** 運営者モード（広告なしで補給できる） */
  owner: boolean
  started: boolean
  muted: boolean
  reducedMotion: boolean
  displayBalls: number
  best: { chain: number; total: number }
  /** 大当たり中の払い出し表示（カウントアップ用） */
  displayPayout: number
  /** 演出バランス */
  custom: Custom
  /** オート発射 */
  autoFire: boolean
}

export const BTN_MUTE = { x: W - 44, y: 12, w: 34, h: 30 }
export const BTN_MOTION = { x: W - 84, y: 12, w: 34, h: 30 }
export const BTN_CUSTOM = { x: W - 124, y: 12, w: 34, h: 30 }
export const BTN_AUTO = { x: W - 164, y: 12, w: 34, h: 30 }

/** 保留アイコンの x 座標（-1 は変動中の保留） */
export function holdX(index: number): number {
  return index < 0 ? 262 : 90 + index * 34
}
export const BTN_REFILL = { x: W / 2 - 90, y: 470, w: 180, h: 56 }

const SYMBOL_COLORS = ['#4da3ff', '#3ddc84', '#ffa53d', '#39e0e0', '#b77dff', '#ff6fb5', '#ff3b3b']
const HOLD_FILL: Record<HoldColor, string> = {
  white: '#e8eef7',
  blue: '#3d8bff',
  green: '#27d17f',
  red: '#ff3355',
  gold: '#ffd23d',
  rainbow: 'rainbow',
}

const REEL_Y = 66
const REEL_H = 140
/** 図柄は液晶の左側に寄せ、右側をポッチの居場所にする */
const REEL_X = [36, 124, 212]
const REEL_W = 82
/** 液晶の中のポッチの居場所 */
const HOME = { x: 360, y: 150, x0: 300, x1: W - 28 }

function rainbowGradient(ctx: CanvasRenderingContext2D, x0: number, x1: number, t: number) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0)
  for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${(i * 60 + t * 240) % 360},100%,60%)`)
  return g
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function holdFill(ctx: CanvasRenderingContext2D, c: HoldColor, x: number, t: number): string | CanvasGradient {
  return c === 'rainbow' ? rainbowGradient(ctx, x - 12, x + 12, t) : HOLD_FILL[c]
}

/** ポッチの定位置（液晶の右側） */
export const CHARA_X = HOME.x
export const CHARA_Y = HOME.y

export function render(ctx: CanvasRenderingContext2D, g: Game, fx: Fx, ui: Ui, time: number, chara: Chara, stage: Stage) {
  ctx.save()
  const sh = fx.shakeOffset(time)
  ctx.translate(W / 2 + sh.x, H / 2 + sh.y)
  ctx.rotate(sh.r)
  // 一瞬手前に迫る（パンチ）
  const z = 1 + fx.zoom
  ctx.scale(z, z)
  ctx.translate(-W / 2, -H / 2)

  drawBackground(ctx, g, fx, time)
  if (g.phase === 'fever' && g.scene === 'fever') drawFeverPochi(ctx, g, chara, stage, time)
  drawBoard(ctx, g, time)
  if (chara.reachK > 0.02) drawReachStage(ctx, g, chara, stage, time)
  drawReels(ctx, g, time)
  drawHolds(ctx, g, time)
  drawCharaHome(ctx, g, chara, stage, time)
  drawHud(ctx, g, ui, fx, time)
  drawParticles(ctx, fx)
  drawSceneOverlay(ctx, g, ui, time)
  drawPopups(ctx, fx)
  if (g.spin && g.spin.step > 0) drawStepUp(ctx, g.spin.step, g.spin.outcome.yokoku.stepUp, time)
  if (g.spin?.cutin) drawCutin(ctx, g.spin.cutin, time)
  if (g.zoneCount > 0 && g.phase === 'normal') drawZone(ctx, g.zoneCount, !!g.spin && g.holds.every((h) => !h.zone), time)
  if (chara.centerK > 0.02) drawCharaCenter(ctx, g, chara, stage, time)
  if (g.pushPending) drawPush(ctx, g, time)
  if (g.needsRefill) drawRefill(ctx, ui.gate, time)
  ctx.restore()

  // RUSH 最終変動：画面の縁が赤く脈打つ
  if (g.phase === 'rush' && g.rushLeft === 0 && g.spin && !g.spin.done) {
    drawVignette(ctx, `rgba(255,20,50,${0.35 + 0.25 * Math.sin(time * 7)})`)
  }
  if (fx.tint > 0) {
    ctx.globalAlpha = Math.min(0.8, fx.tint)
    ctx.fillStyle = fx.tintColor
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 1
  }
  if (fx.crackLife > 0) drawCracks(ctx, fx)

  if (fx.flash > 0) {
    ctx.globalAlpha = Math.min(1, fx.flash)
    ctx.fillStyle = fx.flashColor
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 1
  }
  if (g.spin?.darken || g.spin?.blackout) {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
  }
  if (g.spin?.blackout) {
    // 確定ブラックアウト：暗闇の中で図柄だけがうっすら回る
    ctx.globalAlpha = 0.28
    drawReels(ctx, g, time)
    ctx.globalAlpha = 1
  }
  if (!ui.started) drawTitle(ctx, ui, time)
}

function drawBackground(ctx: CanvasRenderingContext2D, g: Game, fx: Fx, t: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  if (g.phase === 'rush' && g.lt) {
    bg.addColorStop(0, '#3d2a00')
    bg.addColorStop(1, '#140a00')
  } else if (g.zoneCount > 0 && g.phase === 'normal') {
    // 先読みゾーン中は背景が紫に沈む
    bg.addColorStop(0, '#2a0a4a')
    bg.addColorStop(1, '#0a0220')
  } else if (g.phase === 'rush') {
    bg.addColorStop(0, '#2a0033')
    bg.addColorStop(1, '#07001a')
  } else if (g.phase === 'fever') {
    bg.addColorStop(0, '#3a1500')
    bg.addColorStop(1, '#120020')
  } else {
    bg.addColorStop(0, '#0b1030')
    bg.addColorStop(1, '#03040d')
  }
  ctx.fillStyle = bg
  ctx.fillRect(-20, -20, W + 40, H + 40)
  // 大当たり・RUSH 中は背景に放射状の光を回す
  // 連チャンが伸びるほど、光芒が明るく・速く・本数が増える（数字の代わりに派手さで語る）
  const chain = g.phase === 'rush' || (g.phase === 'fever' && g.fever?.fromMode !== 'normal') ? g.chain : 0
  const heat = Math.min(1, chain / 10)
  const intensity =
    g.phase === 'fever' ? 0.22 + heat * 0.15 : g.phase === 'rush' ? 0.12 + heat * 0.3 : fx.rainbow
  if (intensity > 0) {
    const rays = 12 + Math.floor(heat * 12)
    ctx.save()
    ctx.translate(W / 2, 520)
    ctx.rotate(t * (0.4 + heat * 1.6))
    for (let i = 0; i < rays; i++) {
      ctx.rotate((Math.PI * 2) / rays)
      ctx.fillStyle = `hsla(${(i * 30 + t * 90) % 360},100%,60%,${intensity})`
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(700, -90)
      ctx.lineTo(700, 90)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }
  // 連チャン中は画面の縁にきらめく光の粒が増えていく
  if (chain > 1) {
    const n = Math.min(60, chain * 5)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t * (0.3 + heat)
      const edge = i % 2 ? 0.48 : 0.44
      const x = W / 2 + Math.cos(a) * W * edge
      const y = H / 2 + Math.sin(a) * H * edge
      const tw = 0.5 + 0.5 * Math.sin(t * 9 + i * 1.3)
      ctx.fillStyle = g.lt ? `rgba(255,210,61,${0.4 + 0.6 * tw})` : `hsla(${(i * 40 + t * 120) % 360},100%,70%,${0.4 + 0.6 * tw})`
      ctx.beginPath()
      ctx.arc(x, y, 1.5 + 2.5 * tw * (0.5 + heat), 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, g: Game, t: number) {
  // 盤面の枠
  ctx.strokeStyle = 'rgba(160,190,255,0.25)'
  ctx.lineWidth = 2
  ctx.strokeRect(WALL_L, BOARD_TOP - 10, WALL_R - WALL_L, H - BOARD_TOP + 4)

  // 狙い位置
  if (g.scene === 'play' && g.phase !== 'fever') {
    ctx.setLineDash([4, 6])
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.beginPath()
    ctx.moveTo(g.aimX, BOARD_TOP - 8)
    ctx.lineTo(g.aimX, BOARD_TOP + 26)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = g.firing ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)'
    ctx.beginPath()
    ctx.arc(g.aimX, BOARD_TOP - 4, BALL_R, 0, Math.PI * 2)
    ctx.fill()
  }

  // 釘
  for (const p of g.pegs) {
    if (p.gold) {
      const pulse = 0.6 + 0.4 * Math.sin(t * 6 + p.x)
      ctx.fillStyle = `rgba(255,210,60,${0.25 * pulse})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, PEG_R + 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffd23d'
    } else if (p.glow > 0) {
      const k = p.glow / 0.35
      ctx.fillStyle = `rgba(120,220,255,${0.5 * k})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, PEG_R + 8 * k, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#e8fbff'
    } else {
      ctx.fillStyle = '#8093c0'
    }
    ctx.beginPath()
    ctx.arc(p.x, p.y, PEG_R, 0, Math.PI * 2)
    ctx.fill()
  }

  // ポケット
  const py = BOARD_BOTTOM
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(WALL_L, py, WALL_R - WALL_L, H - py)
  if (g.phase === 'fever') {
    const open = g.fever && g.fever.interval <= 0 && g.scene === 'fever'
    const grad = rainbowGradient(ctx, ATTACKER.x0, ATTACKER.x1, t)
    ctx.fillStyle = open ? grad : 'rgba(120,120,140,0.6)'
    roundRect(ctx, ATTACKER.x0, py + 4, ATTACKER.x1 - ATTACKER.x0, 30, 8)
    ctx.fill()
    const closing = open && (g.fever?.closing ?? 0) > 0
    if (open && !closing) {
      // 開いている：吸い込まれるように下向きの山形が流れる
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 3
      for (let i = 0; i < 7; i++) {
        const x = ATTACKER.x0 + 20 + i * ((ATTACKER.x1 - ATTACKER.x0 - 40) / 6)
        const yy = py + 8 + ((t * 40 + i * 4) % 20)
        ctx.beginPath()
        ctx.moveTo(x - 7, yy)
        ctx.lineTo(x, yy + 6)
        ctx.lineTo(x + 7, yy)
        ctx.stroke()
      }
    } else if (closing) {
      // 閉じかけ：シャッターが左右から迫る
      const k = 1 - (g.fever!.closing / SPEC.attackerCloseTime)
      const half = ((ATTACKER.x1 - ATTACKER.x0) / 2) * k
      ctx.fillStyle = '#ff6fb5'
      ctx.fillRect(ATTACKER.x0, py + 4, half, 30)
      ctx.fillRect(ATTACKER.x1 - half, py + 4, half, 30)
    }
  } else {
    for (const b of BONUS_POCKETS) {
      ctx.fillStyle = 'rgba(80,200,255,0.35)'
      roundRect(ctx, b.x0 + 2, py + 6, b.x1 - b.x0 - 4, 24, 6)
      ctx.fill()
      ctx.fillStyle = '#bfefff'
      ctx.font = 'bold 12px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`+${b.payout}`, (b.x0 + b.x1) / 2, py + 23)
    }
    const sp = startPocket(g.phase, g.t)
    const glow = 0.6 + 0.4 * Math.sin(t * 8)
    ctx.shadowColor = g.phase === 'rush' ? '#ff4df0' : '#ffdd33'
    ctx.shadowBlur = 16 * glow
    ctx.fillStyle = g.phase === 'rush' ? '#ff4df0' : '#ffcc22'
    roundRect(ctx, sp.x - sp.w / 2, py + 2, sp.w, 32, 8)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#1a0a00'
    ctx.font = 'bold 13px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('START', sp.x, py + 23)
  }

  // 玉
  for (const b of g.flying) {
    for (let i = 0; i < b.trail.length; i++) {
      const p = b.trail[i]
      ctx.fillStyle = b.free ? `rgba(255,200,80,${(i / b.trail.length) * 0.35})` : `rgba(200,230,255,${(i / b.trail.length) * 0.3})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, BALL_R * (i / b.trail.length), 0, Math.PI * 2)
      ctx.fill()
    }
    const bg = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, BALL_R)
    bg.addColorStop(0, '#ffffff')
    bg.addColorStop(1, b.free ? '#e0a020' : '#9aa8c0')
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawSymbol(ctx: CanvasRenderingContext2D, idx: number, cx: number, cy: number, scale: number, alpha: number) {
  const n = idx + 1
  const baseAlpha = ctx.globalAlpha
  ctx.globalAlpha = baseAlpha * alpha
  ctx.font = `900 ${Math.round(70 * scale)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 7 * scale
  ctx.strokeStyle = n === 7 ? '#ffe066' : 'rgba(0,0,0,0.8)'
  ctx.strokeText(String(n), cx, cy)
  ctx.fillStyle = SYMBOL_COLORS[idx]
  ctx.fillText(String(n), cx, cy)
  ctx.globalAlpha = baseAlpha
  ctx.textBaseline = 'alphabetic'
}

function drawReels(ctx: CanvasRenderingContext2D, g: Game, t: number) {
  const sp = g.spin
  const stage = sp?.stage ?? 'rolling'
  // パネル枠：リーチの格に応じて変わる
  roundRect(ctx, 26, REEL_Y - 8, W - 52, REEL_H + 16, 16)
  ctx.fillStyle = 'rgba(5,8,25,0.92)'
  ctx.fill()
  ctx.lineWidth = stage === 'rolling' ? 2 : 5
  if (stage === 'premium' || g.phase === 'fever') ctx.strokeStyle = rainbowGradient(ctx, 26, W - 26, t)
  else if (stage === 'super') ctx.strokeStyle = `rgba(255,50,80,${0.6 + 0.4 * Math.sin(t * 12)})`
  else if (stage === 'normal') {
    const tc = sp!.outcome.yokoku?.title ?? 'white'
    ctx.strokeStyle = tc === 'rainbow' ? rainbowGradient(ctx, 26, W - 26, t) : SIGN_FILL[tc]
  }
  else if (g.phase === 'rush') ctx.strokeStyle = '#ff4df0'
  else ctx.strokeStyle = 'rgba(160,190,255,0.5)'
  // 違和感：枠ランプが消えている
  if (sp?.outcome.iwakan !== 'lampOff') ctx.stroke()

  for (let i = 0; i < 3; i++) {
    const r = g.reels[i]
    const x = REEL_X[i]
    ctx.save()
    roundRect(ctx, x, REEL_Y, REEL_W, REEL_H, 10)
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fill()
    ctx.clip()
    const base = Math.floor(r.pos)
    const frac = r.pos - base
    const spinning = !r.stopped && !r.stopping
    const blur = spinning && r.speed > 10
    for (let k = -1; k <= 1; k++) {
      const idx = (((base + k) % SYMBOL_COUNT) + SYMBOL_COUNT) % SYMBOL_COUNT
      // pos が増えると図柄は上から下へ流れる
      const cy = REEL_Y + REEL_H / 2 + (frac - k) * 86
      const near = 1 - Math.min(1, Math.abs(frac - k))
      drawSymbol(ctx, idx, x + REEL_W / 2, cy, 0.8 + 0.2 * near, blur ? 0.45 : 0.35 + 0.65 * near)
    }
    ctx.restore()
  }

  // リーチ：揃った左右の図柄の枠が、リーチタイトルの色で脈打つように光る
  if (sp && sp.stage !== 'rolling' && !sp.dark) {
    const tc = sp.outcome.yokoku?.title ?? 'white'
    const glow = 0.55 + 0.45 * Math.sin(t * 9)
    ctx.save()
    for (const i of [0, 2]) {
      const x = REEL_X[i]
      ctx.strokeStyle = tc === 'rainbow' ? rainbowGradient(ctx, x, x + REEL_W, t) : SIGN_FILL[tc]
      ctx.shadowColor = tc === 'rainbow' ? '#ffffff' : SIGN_FILL[tc]
      ctx.shadowBlur = 18 * glow
      ctx.lineWidth = 3 + 2 * glow
      roundRect(ctx, x + 2, REEL_Y + 2, REEL_W - 4, REEL_H - 4, 10)
      ctx.stroke()
    }
    ctx.restore()
  }
  // 擬似連：回数ぶんパネル上端のランプが灯る
  if (sp && sp.nexts > 1) {
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.arc(W / 2 - 36 + i * 24, REEL_Y - 8, 6, 0, Math.PI * 2)
      ctx.fillStyle = i < sp.nexts ? (sp.nexts >= 3 ? '#ff3355' : '#39e0e0') : 'rgba(255,255,255,0.15)'
      ctx.fill()
    }
  }

  // 期待度ゲージ（リーチ中）
  if (sp && sp.stage !== 'rolling') {
    const gx = 44
    const gw = W - 88
    const gy = REEL_Y + REEL_H - 4
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    roundRect(ctx, gx, gy, gw, 10, 5)
    ctx.fill()
    ctx.fillStyle = sp.gauge > 0.8 ? rainbowGradient(ctx, gx, gx + gw, t) : sp.gauge > 0.4 ? '#ff3355' : '#ffd23d'
    roundRect(ctx, gx, gy, Math.max(10, gw * sp.gauge), 10, 5)
    ctx.fill()
  }
  if (sp?.dark) {
    // 決着前のタメ：画面全体を落とし、「・」を1つずつ灯す
    ctx.fillStyle = 'rgba(0,0,0,0.72)'
    ctx.fillRect(-20, -20, W + 40, H + 40)
    // 光の粒が1つずつ灯る
    const dots = Math.floor((t * 2.2) % 4)
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(W / 2 - 40 + i * 40, 470, 9, 0, Math.PI * 2)
      ctx.fillStyle = i < dots ? '#e6e9f5' : 'rgba(230,233,245,0.12)'
      ctx.fill()
    }
  }
  if (sp?.developing) {
    ctx.lineWidth = 6
    ctx.strokeStyle = Math.floor(t * 16) % 2 ? '#ffd23d' : '#ff3355'
    roundRect(ctx, 26, REEL_Y - 8, W - 52, REEL_H + 16, 16)
    ctx.stroke()
  }
}

function drawHolds(ctx: CanvasRenderingContext2D, g: Game, t: number) {
  const y = 236
  for (let i = 0; i < SPEC.maxHolds; i++) {
    const x = holdX(i)
    const h = g.holds[i]
    ctx.beginPath()
    ctx.arc(x, y, 11, 0, Math.PI * 2)
    if (h) {
      const lvl = holdLevel(h.shown)
      // 違和感：保留アイコンがほんの少しだけ大きい
      const odd = h.outcome.iwakan === 'bigHold' ? 1.22 : 1
      const pulse = (lvl >= 3 ? 1 + 0.12 * Math.sin(t * 10) : 1) * odd
      ctx.beginPath()
      ctx.arc(x, y, 11 * pulse, 0, Math.PI * 2)
      ctx.fillStyle = holdFill(ctx, h.shown, x, t)
      if (lvl >= 3) {
        ctx.shadowColor = h.shown === 'rainbow' ? '#fff' : HOLD_FILL[h.shown]
        ctx.shadowBlur = 14
      }
      ctx.fill()
      ctx.shadowBlur = 0
    } else {
      ctx.strokeStyle = 'rgba(200,210,255,0.3)'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }
  // 現在変動中の保留（当該）
  if (g.spin && g.spin.outcome.mode === 'normal') {
    const c = g.spin.outcome.tell
    const x = 250
    ctx.beginPath()
    ctx.arc(x + 12, y, g.spin.outcome.iwakan === 'bigHold' ? 14.5 : 12, 0, Math.PI * 2)
    ctx.fillStyle = holdFill(ctx, c, x + 12, t)
    ctx.fill()
  }
}

function drawHud(ctx: CanvasRenderingContext2D, g: Game, ui: Ui, fx: Fx, t: number) {
  // 持ち玉（数字だけ）
  ctx.textAlign = 'left'
  ctx.fillStyle = '#fff'
  ctx.font = '900 28px system-ui, sans-serif'
  ctx.fillText(Math.round(ui.displayBalls).toLocaleString(), 16, 40)
  if (ui.owner) {
    ctx.fillStyle = '#3ddc84'
    ctx.beginPath()
    ctx.arc(10, 30, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.textAlign = 'center'
  if (g.phase === 'rush') {
    // RUSH の残り回数：数字だけ。最後の1回は赤く脈打つ
    const last = g.rushLeft <= 1
    const pulse = last ? 1 + 0.15 * Math.abs(Math.sin(t * 8)) : 1 + 0.25 * Math.min(1, fx.hudPulse)
    ctx.save()
    ctx.translate(W / 2, 40)
    ctx.scale(pulse, pulse)
    ctx.font = '900 34px system-ui, sans-serif'
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'
    ctx.strokeText(String(g.rushLeft), 0, 0)
    ctx.fillStyle = last ? '#ff3355' : g.lt ? '#ffd23d' : rainbowGradient(ctx, -40, 40, t)
    ctx.fillText(String(g.rushLeft), 0, 0)
    ctx.restore()
  } else if (g.phase === 'fever' && g.fever) {
    // ラウンド数：数字だけ。開始・昇格のときは脈打ち、昇格中は虹色
    const pulse = fx.hudPulse > 0 ? 1 + 0.25 * Math.abs(Math.sin(t * 12)) * Math.min(1, fx.hudPulse) : 1
    ctx.save()
    ctx.translate(W / 2, 36)
    ctx.scale(pulse, pulse)
    ctx.font = '900 24px system-ui, sans-serif'
    ctx.fillStyle = fx.hudPulse > 0.6 ? rainbowGradient(ctx, -60, 60, t) : '#ffd23d'
    ctx.fillText(`${Math.max(1, g.fever.round)} / ${g.fever.shownRounds}`, 0, 0)
    ctx.restore()
  }

  // 設定ボタン（アイコンのみ）
  const btn = (b: { x: number; y: number; w: number; h: number }, on: boolean) => {
    roundRect(ctx, b.x, b.y, b.w, b.h, 8)
    ctx.fillStyle = on ? 'rgba(61,220,132,0.35)' : 'rgba(255,255,255,0.1)'
    ctx.fill()
  }
  btn(BTN_MUTE, false)
  ctx.fillStyle = '#fff'
  ctx.font = '16px system-ui, sans-serif'
  ctx.fillText(ui.muted ? '🔇' : '🔊', BTN_MUTE.x + BTN_MUTE.w / 2, BTN_MUTE.y + 21)
  btn(BTN_MOTION, false)
  ctx.fillText(ui.reducedMotion ? '◐' : '✦', BTN_MOTION.x + BTN_MOTION.w / 2, BTN_MOTION.y + 21)
  btn(BTN_CUSTOM, ui.custom !== 'standard')
  drawCustomIcon(ctx, ui.custom, BTN_CUSTOM.x + BTN_CUSTOM.w / 2, BTN_CUSTOM.y + BTN_CUSTOM.h / 2)
  btn(BTN_AUTO, ui.autoFire)
  // オート発射：右向きの三角が2つ（早送りの形）
  ctx.fillStyle = ui.autoFire ? '#3ddc84' : 'rgba(255,255,255,0.7)'
  const ax = BTN_AUTO.x + BTN_AUTO.w / 2
  const ay = BTN_AUTO.y + BTN_AUTO.h / 2
  for (const dx of [-7, 3]) {
    ctx.beginPath()
    ctx.moveTo(ax + dx - 4, ay - 7)
    ctx.lineTo(ax + dx + 6, ay)
    ctx.lineTo(ax + dx - 4, ay + 7)
    ctx.closePath()
    ctx.fill()
  }
}

/** 演出バランスのアイコン：標準＝丸1つ、先読み重視＝育っていく丸3つ、先バレ＝稲妻 */
function drawCustomIcon(ctx: CanvasRenderingContext2D, c: Custom, cx: number, cy: number) {
  ctx.fillStyle = '#fff'
  if (c === 'standard') {
    ctx.beginPath()
    ctx.arc(cx, cy, 6, 0, Math.PI * 2)
    ctx.fill()
  } else if (c === 'sakiyomi') {
    ;[3, 4.5, 6].forEach((r, i) => {
      ctx.fillStyle = ['#e8eef7', '#3d8bff', '#ff3355'][i]
      ctx.beginPath()
      ctx.arc(cx - 10 + i * 10, cy, r, 0, Math.PI * 2)
      ctx.fill()
    })
  } else {
    ctx.fillStyle = '#ffd23d'
    ctx.beginPath()
    ctx.moveTo(cx + 2, cy - 10)
    ctx.lineTo(cx - 6, cy + 2)
    ctx.lineTo(cx, cy + 2)
    ctx.lineTo(cx - 2, cy + 10)
    ctx.lineTo(cx + 6, cy - 2)
    ctx.lineTo(cx, cy - 2)
    ctx.closePath()
    ctx.fill()
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, fx: Fx) {
  for (const p of fx.particles) {
    const a = Math.max(0, p.life / p.max)
    ctx.globalAlpha = a
    if (p.kind === 'ring') {
      ctx.strokeStyle = p.color
      ctx.lineWidth = 4 * a
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * (1 - a) + 4, 0, Math.PI * 2)
      ctx.stroke()
    } else if (p.kind === 'shard') {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.moveTo(-p.size / 2, -p.size / 3)
      ctx.lineTo(p.size / 2, -p.size / 2)
      ctx.lineTo(p.size / 4, p.size / 2)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    } else if (p.kind === 'confetti') {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      ctx.restore()
    } else if (p.kind === 'coin') {
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.ellipse(p.x, p.y, p.size * Math.abs(Math.cos(p.rot)) + 1, p.size, 0, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

function drawPopups(ctx: CanvasRenderingContext2D, fx: Fx) {
  ctx.textAlign = 'center'
  for (const p of fx.popups) {
    ctx.globalAlpha = Math.min(1, p.life * 2)
    ctx.font = `900 ${p.size}px system-ui, sans-serif`
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'
    ctx.strokeText(p.text, p.x, p.y)
    ctx.fillStyle = p.color
    ctx.fillText(p.text, p.x, p.y)
  }
  ctx.globalAlpha = 1
}

function dragonLook(g: Game, chara: Chara, stage: Stage): DragonLook {
  return {
    mood: chara.mood,
    stage,
    gold: g.lt && (g.phase === 'rush' || g.phase === 'fever' || g.scene === 'ltIntro'),
    cracks: g.phase === 'normal' ? g.zoneCount : 0,
    wobble: chara.wobble,
    flame: chara.flame,
    eyeGold: g.spin?.outcome.iwakan === 'charaEye',
  }
}

/** 液晶の中のポッチ（舞台や中央に出ている間は消える）。始動口に入るたびに跳ねる */
function drawCharaHome(ctx: CanvasRenderingContext2D, g: Game, chara: Chara, stage: Stage, t: number) {
  // 大当たり中は盤面の真ん中で踊っているので、液晶からはいなくなる
  if (g.phase === 'fever' && g.scene === 'fever') return
  const a = 1 - Math.max(chara.centerK, chara.reachK)
  if (a <= 0.02) return
  const s = 40 + stage * 4
  const hop = -Math.abs(Math.sin(chara.hop * Math.PI)) * 18
  ctx.save()
  // 液晶の枠の中だけに描く
  roundRect(ctx, HOME.x0, REEL_Y - 4, HOME.x1 - HOME.x0, REEL_H + 8, 12)
  ctx.clip()
  // 足元のスポットライト
  const spot = ctx.createRadialGradient(HOME.x, HOME.y + s * 0.6, 4, HOME.x, HOME.y + s * 0.6, s * 1.4)
  spot.addColorStop(0, g.lt ? 'rgba(255,210,60,0.35)' : 'rgba(120,255,170,0.22)')
  spot.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = spot
  ctx.fillRect(HOME.x0, REEL_Y - 4, HOME.x1 - HOME.x0, REEL_H + 8)
  ctx.globalAlpha = a
  if (chara.evolveFlash > 0) {
    const k = chara.evolveFlash
    ctx.fillStyle = `rgba(255,255,255,${0.6 * k})`
    ctx.beginPath()
    ctx.arc(HOME.x, HOME.y, s * (1.2 + (1 - k) * 1.5), 0, Math.PI * 2)
    ctx.fill()
  }
  drawDragon(ctx, HOME.x, HOME.y + hop - stage * 2, s, dragonLook(g, chara, stage), t)
  ctx.restore()
}

/**
 * リーチ舞台：SUPER 以上では盤面が空になり、ポッチがクリスタルの卵に向かって構える。
 * ボタンで溜めて離すと炎のビーム。当たりならクリスタルが虹色に砕け、ハズレなら弾かれる。
 */
function drawReachStage(ctx: CanvasRenderingContext2D, g: Game, chara: Chara, stage: Stage, t: number) {
  const k = chara.reachK
  const premium = g.spin?.stage === 'premium'
  const top = BOARD_TOP - 10
  const h = BOARD_BOTTOM - top
  ctx.save()
  ctx.globalAlpha = Math.min(1, k * 1.2)
  // 空
  const sky = ctx.createLinearGradient(0, top, 0, BOARD_BOTTOM)
  if (premium) {
    sky.addColorStop(0, `hsl(${(t * 40) % 360},70%,28%)`)
    sky.addColorStop(1, `hsl(${(t * 40 + 120) % 360},70%,12%)`)
  } else {
    sky.addColorStop(0, '#3a0a2a')
    sky.addColorStop(0.6, '#5a1530')
    sky.addColorStop(1, '#14040e')
  }
  ctx.fillStyle = sky
  ctx.fillRect(WALL_L, top, WALL_R - WALL_L, h)
  // 流れる雲
  ctx.fillStyle = premium ? 'rgba(255,255,255,0.12)' : 'rgba(255,160,180,0.1)'
  for (let i = 0; i < 6; i++) {
    const x = ((i * 97 - t * (40 + i * 12)) % (W + 160)) + W + 80
    const xx = (x % (W + 160)) - 80
    const y = top + 40 + ((i * 67) % (h - 80))
    ctx.beginPath()
    ctx.ellipse(xx, y, 70 + (i % 3) * 20, 16 + (i % 2) * 6, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // クリスタルの卵（色＝カットイン色、なければタイトル色）
  const yk = g.spin?.outcome.yokoku
  const sign: SignColor = (yk?.cutin ?? yk?.title ?? 'red') as SignColor
  const ex = 330
  const ey = 470
  const burst = chara.crystal !== 0 ? Math.min(1, chara.crystalT / 0.35) : 0
  if (chara.crystal >= 0 || burst < 1) {
    ctx.save()
    ctx.translate(ex, ey)
    const shake = chara.crystal === -1 ? Math.sin(t * 60) * 6 * (1 - burst) : 0
    ctx.translate(shake, 0)
    const sc = chara.crystal === 1 ? 1 + burst * 0.6 : 1
    ctx.scale(sc, sc)
    ctx.globalAlpha = Math.min(1, k * 1.2) * (chara.crystal === 1 ? 1 - burst : 1)
    const fill = sign === 'rainbow' ? rainbowGradient(ctx, -40, 40, t) : SIGN_FILL[sign]
    ctx.shadowColor = sign === 'rainbow' ? '#ffffff' : SIGN_FILL[sign]
    ctx.shadowBlur = 25 + 15 * Math.sin(t * 6)
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.ellipse(0, 0, 42, 54, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    // ファセット（カット面）
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, -54)
    ctx.lineTo(-24, -6)
    ctx.lineTo(0, 54)
    ctx.lineTo(24, -6)
    ctx.closePath()
    ctx.moveTo(-42, 0)
    ctx.lineTo(42, 0)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.beginPath()
    ctx.ellipse(-14, -24, 7, 14, -0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  // ポッチ（左向きに反転して、クリスタルへ炎を吐く）
  ctx.save()
  ctx.translate(140, 500)
  ctx.scale(-1, 1)
  drawDragon(ctx, 0, Math.sin(t * 2.4) * 6, 80, dragonLook(g, chara, Math.max(stage, 2) as Stage), t)
  ctx.restore()
  // 炎のビーム
  if (chara.beam > 0) {
    const b = chara.beam / 0.35
    ctx.strokeStyle = chara.beamColor === 'rainbow' ? rainbowGradient(ctx, 160, ex, t * 4) : chara.beamColor
    ctx.shadowColor = '#ffffff'
    ctx.shadowBlur = 30
    ctx.lineCap = 'round'
    for (const [w, a] of [
      [26, 0.5],
      [12, 1],
    ] as const) {
      ctx.globalAlpha = a * b
      ctx.lineWidth = w * (0.5 + b * 0.5)
      ctx.beginPath()
      ctx.moveTo(165, 488)
      ctx.lineTo(ex - 20, ey)
      ctx.stroke()
    }
    ctx.shadowBlur = 0
  }
  ctx.restore()
}

/** 大当たり中：盤面の真ん中、降ってくる玉の後ろでポッチが踊る */
function drawFeverPochi(ctx: CanvasRenderingContext2D, g: Game, chara: Chara, stage: Stage, t: number) {
  ctx.save()
  ctx.globalAlpha = 0.85
  const sway = Math.sin(t * 5) * 0.12
  ctx.translate(W / 2, 520)
  ctx.rotate(sway)
  const look = dragonLook(g, chara, Math.max(stage, 2) as Stage)
  look.mood = 'joy'
  if (Math.sin(t * 2) > 0.6) look.flame = { color: 'rainbow', power: 0.8 }
  drawDragon(ctx, 0, -Math.abs(Math.sin(t * 5)) * 16, 85, look, t)
  ctx.restore()
}

/** 画面中央に大きく出るポッチ（SUPER・カットイン・大当たり・LT など） */
function drawCharaCenter(ctx: CanvasRenderingContext2D, g: Game, chara: Chara, stage: Stage, t: number) {
  const k = chara.centerK
  // 出現時に少し行き過ぎて戻る
  const pop = k < 0.98 ? k * (1 + 0.25 * Math.sin(k * Math.PI)) : 1
  const look = dragonLook(g, chara, Math.max(stage, 2) as Stage)
  ctx.save()
  const glow = ctx.createRadialGradient(W / 2, 470, 10, W / 2, 470, 190)
  glow.addColorStop(0, look.gold ? `rgba(255,210,60,${0.5 * k})` : `rgba(255,255,255,${0.35 * k})`)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 280, W, 380)
  ctx.globalAlpha = Math.min(1, k * 1.5)
  drawDragon(ctx, W / 2, 450, 95 * pop, look, t)
  ctx.restore()
}

function drawVignette(ctx: CanvasRenderingContext2D, color: string) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, color)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function drawCracks(ctx: CanvasRenderingContext2D, fx: Fx) {
  ctx.save()
  ctx.globalAlpha = Math.min(1, fx.crackLife)
  ctx.strokeStyle = '#ffffff'
  ctx.shadowColor = '#ffd23d'
  ctx.shadowBlur = 8
  ctx.lineWidth = 2
  for (const c of fx.cracks) {
    ctx.beginPath()
    c.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
    ctx.stroke()
  }
  ctx.restore()
}

const SIGN_FILL: Record<SignColor, string> = {
  white: '#e8eef7',
  blue: '#3d8bff',
  green: '#27d17f',
  red: '#ff3355',
  gold: '#ffd23d',
  rainbow: 'rainbow',
}
const STEP_COLORS: SignColor[] = ['white', 'white', 'blue', 'green', 'red', 'gold']

/** ステップアップ予告：枠が段階ごとに大きく・色が上がり、中の菱形が段階の数だけ重なる */
function drawStepUp(ctx: CanvasRenderingContext2D, step: number, finalStep: number, t: number) {
  const c = STEP_COLORS[Math.min(step, 5)]
  const w = 120 + step * 36
  const h = 50 + step * 12
  const x = W / 2 - w / 2
  const y = 470 - h / 2
  const max = step >= 5 && finalStep >= 5
  const fill = (x0: number, x1: number) => (max ? rainbowGradient(ctx, x0, x1, t) : SIGN_FILL[c] === 'rainbow' ? '#fff' : SIGN_FILL[c])
  ctx.save()
  roundRect(ctx, x, y, w, h, 12)
  ctx.fillStyle = 'rgba(0,0,0,0.75)'
  ctx.fill()
  ctx.lineWidth = 3 + step
  ctx.strokeStyle = fill(x, x + w)
  ctx.stroke()
  // ポッチが段階ごとに孵っていく：卵 → ヒビ → 顔を出す → 翼を広げる → 金の竜
  const hatch: Array<Partial<DragonLook>> = [
    {},
    { stage: 0, cracks: 0, wobble: 0.6 },
    { stage: 0, cracks: 3, wobble: 1 },
    { stage: 1, mood: 'hype' },
    { stage: 2, mood: 'hype' },
    { stage: 4, mood: 'joy', gold: true },
  ]
  const look: DragonLook = {
    mood: 'idle',
    stage: 0,
    gold: false,
    cracks: 0,
    wobble: 0,
    flame: null,
    eyeGold: false,
    ...hatch[Math.min(step, 5)],
  }
  if (max) drawStar(ctx, W / 2, 470, h * 0.6, rainbowGradient(ctx, W / 2 - 60, W / 2 + 60, t), t)
  drawDragon(ctx, W / 2, 462, 20 + step * 5, look, t)
  ctx.restore()
}

/** 星形（確定・上位演出の紋章） */
function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string | CanvasGradient, rot: number) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
    else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.shadowColor = '#fff'
  ctx.shadowBlur = 20
  ctx.fillStyle = fill
  ctx.fill()
  ctx.restore()
}

/** カットイン：画面を斜めに横切る色の帯と、走り抜ける光の筋。色が期待度のサイン */
function drawCutin(ctx: CanvasRenderingContext2D, c: { color: SignColor; t: number }, t: number) {
  const k = Math.min(1, c.t / 0.18)
  const off = (1 - k) * W * 1.2
  ctx.save()
  ctx.translate(W / 2 - off, 460)
  ctx.rotate(-0.12)
  ctx.fillStyle = c.color === 'rainbow' ? rainbowGradient(ctx, -W, W, t) : SIGN_FILL[c.color]
  ctx.globalAlpha = 0.92
  ctx.fillRect(-W, -46, W * 2, 92)
  ctx.globalAlpha = 1
  ctx.fillStyle = 'rgba(0,0,0,0.85)'
  ctx.fillRect(-W, -30, W * 2, 60)
  // 帯の中を走る光の筋（色が上がるほど本数が増える）
  const lines = 3 + ['white', 'blue', 'green', 'red', 'gold', 'rainbow'].indexOf(c.color) * 2
  ctx.strokeStyle = c.color === 'rainbow' ? rainbowGradient(ctx, -W, W, t) : SIGN_FILL[c.color]
  for (let i = 0; i < lines; i++) {
    const yy = -24 + ((i * 53) % 48)
    const xx = ((t * 900 + i * 170) % (W * 2)) - W
    ctx.lineWidth = 2 + (i % 3)
    ctx.beginPath()
    ctx.moveTo(xx, yy)
    ctx.lineTo(xx + 120 + (i % 4) * 30, yy)
    ctx.stroke()
  }
  ctx.restore()
}

/** 先読みゾーン：盤面の両脇に炎の柱が立ち、連続回数ぶん高くなる。対象の変動では赤く燃え上がる */
function drawZone(ctx: CanvasRenderingContext2D, count: number, target: boolean, t: number) {
  const h = Math.min(1, count / 4) * 320 + 40
  for (const x of [WALL_L + 6, WALL_R - 6]) {
    for (let i = 0; i < 14; i++) {
      const u = i / 14
      const flick = Math.sin(t * 12 + i * 1.7 + x) * 6
      const yy = BOARD_BOTTOM - u * h
      const r = (1 - u) * 16 + 4 + flick * 0.3
      ctx.fillStyle = target
        ? `rgba(255,${60 + u * 120},60,${0.35 * (1 - u) + 0.1})`
        : `rgba(${150 + u * 80},70,255,${0.3 * (1 - u) + 0.08})`
      ctx.beginPath()
      ctx.arc(x + flick * 0.4, yy, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/** 押しボタン（文字なし）。ドーム状に光る */
function drawButton(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, base: string, light: string, t: number) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.shadowColor = base
  ctx.shadowBlur = 30
  const grd = ctx.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.1, 0, 0, r * 1.05)
  grd.addColorStop(0, '#ffffff')
  grd.addColorStop(0.25, light)
  grd.addColorStop(1, base)
  ctx.fillStyle = grd
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 10)})`
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

/** PUSH：文字の無いボタンが脈打ち、上から「押せ」と山形が降りてくる。復活チャンスは金色でヒビの輪 */
function drawPush(ctx: CanvasRenderingContext2D, g: Game, t: number) {
  const cx = W / 2
  const cy = 600
  const waited = g.spin?.waitingPush ? g.spin.pushWait : g.sceneTime - 3.2
  const remain = Math.max(0, 1 - waited / PUSH_AUTO)
  const revive = !!g.spin?.lastChance
  // 長押し中はボタンが沈み込み、溜まるほど光が強くなる
  const pressed = g.charging ? 0.86 - g.charge * 0.06 : 1
  const pulse = g.charging ? 1 + 0.04 * Math.sin(t * 40) * g.charge : 1 + 0.08 * Math.sin(t * 14)
  if (g.charging) {
    const glow = ctx.createRadialGradient(cx, cy, 30, cx, cy, 90 + g.charge * 80)
    glow.addColorStop(0, `rgba(255,255,255,${0.25 + g.charge * 0.45})`)
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glow
    ctx.fillRect(cx - 200, cy - 200, 400, 400)
  }
  drawButton(ctx, cx, cy, 58 * pulse * pressed, revive ? '#d99a00' : '#d0002a', revive ? '#fff3b0' : '#ff8aa0', t)
  if (revive) {
    // ヒビの入った金の輪
    ctx.strokeStyle = '#fff3b0'
    ctx.lineWidth = 2
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t * 0.5
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * 62, cy + Math.sin(a) * 62)
      ctx.lineTo(cx + Math.cos(a + 0.15) * 80, cy + Math.sin(a + 0.15) * 80)
      ctx.lineTo(cx + Math.cos(a + 0.05) * 92, cy + Math.sin(a + 0.05) * 92)
      ctx.stroke()
    }
  }
  if (g.charging) {
    // 溜まり具合の輪（虹色に満ちていく）
    ctx.strokeStyle = rainbowGradient(ctx, cx - 70, cx + 70, t * 3)
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.arc(cx, cy, 70, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g.charge)
    ctx.stroke()
    return
  }
  // 残り時間の輪
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(cx, cy, 68, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remain)
  ctx.stroke()
  // 押す場所を示す山形
  ctx.lineWidth = 5
  for (let i = 0; i < 3; i++) {
    const ph = (t * 1.6 + i / 3) % 1
    ctx.globalAlpha = 1 - ph
    const yy = cy - 150 + ph * 60
    ctx.beginPath()
    ctx.moveTo(cx - 20, yy)
    ctx.lineTo(cx, yy + 16)
    ctx.lineTo(cx + 20, yy)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawRefill(ctx: CanvasRenderingContext2D, gate: GateState, t: number) {
  const b = BTN_REFILL
  const pulse = 0.85 + 0.15 * Math.sin(t * 5)
  let label = ''
  let sub = ''
  let color = `rgba(40,200,120,${pulse})`
  switch (gate.kind) {
    case 'free':
      label = '玉を補給（無料）'
      break
    case 'idle':
    case 'loading':
      label = '広告を準備中…'
      color = 'rgba(120,125,150,0.8)'
      break
    case 'ready':
      label = `▶ 広告を見て +${AD_REWARD}玉`
      sub = '最後まで見ると玉が補給されます'
      color = `rgba(255,140,40,${pulse})`
      break
    case 'showing':
      label = '広告を再生中…'
      color = 'rgba(120,125,150,0.8)'
      break
    case 'wait':
      label = `あと ${Math.ceil(gate.left)} 秒`
      sub = `広告を用意できませんでした。待つと +${FALLBACK_REWARD}玉`
      color = 'rgba(120,125,150,0.8)'
      break
    case 'fallbackReady':
      label = `+${FALLBACK_REWARD}玉を受け取る`
      break
  }
  roundRect(ctx, b.x, b.y, b.w, b.h, 14)
  ctx.fillStyle = color
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = '900 18px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, W / 2, b.y + 35)
  if (sub) {
    ctx.font = 'bold 12px system-ui, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText(sub, W / 2, b.y + b.h + 20)
  }
}

function drawSceneOverlay(ctx: CanvasRenderingContext2D, g: Game, ui: Ui, t: number) {
  if (g.scene === 'fever' && g.fever) {
    ctx.textAlign = 'center'
    ctx.font = '900 16px system-ui, sans-serif'
    ctx.fillStyle = '#ffd23d'
    ctx.font = '900 46px system-ui, sans-serif'
    ctx.lineWidth = 8
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'
    const txt = `${Math.round(ui.displayPayout).toLocaleString()}`
    ctx.strokeText(txt, W / 2, 346)
    ctx.fillStyle = rainbowGradient(ctx, W / 2 - 100, W / 2 + 100, t)
    ctx.fillText(txt, W / 2, 346)
    // ラウンド内カウント
    const f = g.fever
    for (let i = 0; i < SPEC.ballsPerRound; i++) {
      ctx.beginPath()
      ctx.arc(W / 2 - 90 + i * 20, 372, 6, 0, Math.PI * 2)
      ctx.fillStyle = i < f.inRound ? '#ffd23d' : 'rgba(255,255,255,0.15)'
      ctx.fill()
    }
    // オーバー入賞（規定数を超えて入った玉）はピンクで右に足していく
    for (let i = 0; i < f.overInRound; i++) {
      ctx.beginPath()
      ctx.arc(W / 2 - 90 + (SPEC.ballsPerRound + i) * 20, 372, 7, 0, Math.PI * 2)
      ctx.fillStyle = '#ff6fb5'
      ctx.fill()
    }

  }
  if (g.scene === 'challenge') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, BOARD_TOP - 12, W, H)
    ctx.textAlign = 'center'
    // 獲得数（数字のみ）
    if (g.fever) {
      ctx.font = '900 34px system-ui, sans-serif'
      ctx.fillStyle = '#ffd23d'
      ctx.fillText(`+${g.fever.payout.toLocaleString()}`, W / 2, 330)
    }
    // RUSH の色の扉が、ゲージの先で脈打つ
    const glow = 0.5 + 0.5 * Math.sin(t * 6)
    ctx.fillStyle = `rgba(255,77,240,${0.15 + 0.2 * glow})`
    roundRect(ctx, W - 60 - 10, 370, 20, 62, 8)
    ctx.fill()
    // 50% へ向かって上がるゲージ
    const k = g.challengeResult === null ? Math.min(1, g.sceneTime / 3.2) : 1
    const gx = 60
    const gw = W - 120
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    roundRect(ctx, gx, 390, gw, 22, 11)
    ctx.fill()
    const fill = g.challengeResult === true ? 1 : g.challengeResult === false ? 0.5 : 0.5 * (1 - Math.pow(1 - k, 3))
    ctx.fillStyle = g.challengeResult === true ? rainbowGradient(ctx, gx, gx + gw, t) : '#ff3355'
    roundRect(ctx, gx, 390, Math.max(22, gw * fill), 22, 11)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.beginPath()
    ctx.moveTo(gx + gw / 2, 384)
    ctx.lineTo(gx + gw / 2, 418)
    ctx.stroke()

  }
  if (g.scene === 'ltIntro') {
    // 上位 RUSH 突入：金の光芒が回り、中央の金の星が脈打ちながら大きくなる
    ctx.fillStyle = 'rgba(20,12,0,0.6)'
    ctx.fillRect(0, BOARD_TOP - 12, W, H)
    ctx.save()
    ctx.translate(W / 2, 500)
    ctx.rotate(t * 0.8)
    for (let i = 0; i < 16; i++) {
      ctx.rotate((Math.PI * 2) / 16)
      ctx.fillStyle = i % 2 ? 'rgba(255,210,61,0.35)' : 'rgba(255,243,176,0.2)'
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(420, -40)
      ctx.lineTo(420, 40)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }
  if (g.scene === 'rushEnd') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(0, BOARD_TOP - 12, W, H)
    ctx.textAlign = 'center'
    // 連チャン数は星の数で（1段10個まで）、総獲得は数字だけ
    const per = 10
    for (let i = 0; i < g.chain; i++) {
      const row = Math.floor(i / per)
      const inRow = Math.min(per, g.chain - row * per)
      const col = i % per
      const x = W / 2 + (col - (inRow - 1) / 2) * 34
      const y = 380 + row * 40
      const appear = Math.min(1, Math.max(0, g.sceneTime * 6 - i * 0.6))
      if (appear > 0) drawStar(ctx, x, y, 15 * appear, g.lt ? '#ffd23d' : rainbowGradient(ctx, x - 15, x + 15, t + i * 0.1), t * 0.5)
    }
    ctx.font = '900 34px system-ui, sans-serif'
    ctx.fillStyle = '#ffd23d'
    ctx.fillText(`+${g.chainTotal.toLocaleString()}`, W / 2, 380 + Math.ceil(g.chain / per) * 40 + 30)
  }
}

function drawTitle(ctx: CanvasRenderingContext2D, ui: Ui, t: number) {
  ctx.fillStyle = 'rgba(2,3,12,0.88)'
  ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'center'
  ctx.font = '900 50px system-ui, sans-serif'
  ctx.fillStyle = rainbowGradient(ctx, 40, 410, t)
  ctx.fillText('DOPAMINE', W / 2, 250)
  ctx.fillText('RUSH', W / 2, 305)
  ctx.font = 'bold 15px system-ui, sans-serif'
  ctx.fillStyle = '#cfd6ff'
  const lines = [
    '画面を押しっぱなしで玉を発射（指の位置に落ちる）。',
    '動く「START」に入れるとデジタル抽選。',
    '保留の色・光・音が期待度のサイン。',
    '光るボタンが出たら、自分の手で結果を開けよう。',
    '右上：▶▶ オート発射 ／ ● 演出バランス',
    '（● 標準 → ●●● 先読み重視 → ⚡ 先バレ）',
  ]
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 370 + i * 26))
  const a = 0.6 + 0.4 * Math.sin(t * 4)
  ctx.globalAlpha = a
  ctx.font = '900 24px system-ui, sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText('TAP TO START', W / 2, 560)
  ctx.globalAlpha = 1
  ctx.font = '11px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(200,210,255,0.5)'
  ctx.fillText('玉はゲーム内だけの数値です。現金・景品との交換価値はありません。', W / 2, 740)
  ctx.fillText('音が出ます 🔊 / 強い光が苦手な方は右上の ✦ で演出を控えめに', W / 2, 760)
  if (ui.best.chain > 0) {
    ctx.fillText(`自己ベスト ${ui.best.chain}連 / ${ui.best.total.toLocaleString()}玉`, W / 2, 610)
  }
}

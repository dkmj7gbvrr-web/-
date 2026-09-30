import { AD_REWARD, FALLBACK_REWARD, type GateState } from './ads/refillGate'
import type { Fx } from './fx'
import { holdLevel, PUSH_AUTO, RENDA_TIME, type Game } from './game/game'
import { SPEC, SYMBOL_COUNT, type HoldColor } from './game/odds'
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
}

export const BTN_MUTE = { x: W - 44, y: 12, w: 34, h: 30 }
export const BTN_MOTION = { x: W - 84, y: 12, w: 34, h: 30 }
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
const REEL_X = [44, 170, 296]
const REEL_W = 110

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

export function render(ctx: CanvasRenderingContext2D, g: Game, fx: Fx, ui: Ui, time: number) {
  ctx.save()
  const sh = fx.shakeOffset(time)
  ctx.translate(W / 2 + sh.x, H / 2 + sh.y)
  ctx.rotate(sh.r)
  ctx.translate(-W / 2, -H / 2)

  drawBackground(ctx, g, fx, time)
  drawBoard(ctx, g, time)
  drawReels(ctx, g, time)
  drawHolds(ctx, g, time)
  drawHud(ctx, g, ui, time)
  drawParticles(ctx, fx)
  drawSceneOverlay(ctx, g, ui, time)
  drawBanner(ctx, fx, time)
  if (g.spin?.renda) drawRenda(ctx, g, time)
  if (g.pushPending) drawPush(ctx, g, time)
  if (g.needsRefill) drawRefill(ctx, ui.gate, time)
  ctx.restore()

  if (fx.flash > 0) {
    ctx.globalAlpha = Math.min(1, fx.flash)
    ctx.fillStyle = fx.flashColor
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 1
  }
  if (g.spin?.blackout) {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
  }
  if (!ui.started) drawTitle(ctx, ui, time)
}

function drawBackground(ctx: CanvasRenderingContext2D, g: Game, fx: Fx, t: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  if (g.phase === 'rush') {
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
  const intensity = g.phase === 'fever' ? 0.22 : g.phase === 'rush' ? 0.12 + Math.min(0.2, g.chain * 0.02) : fx.rainbow
  if (intensity > 0) {
    ctx.save()
    ctx.translate(W / 2, 520)
    ctx.rotate(t * 0.4)
    for (let i = 0; i < 12; i++) {
      ctx.rotate((Math.PI * 2) / 12)
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
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 16px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(open ? 'ATTACKER OPEN' : 'CLOSE', W / 2, py + 25)
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
  ctx.globalAlpha = alpha
  ctx.font = `900 ${Math.round(78 * scale)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 7 * scale
  ctx.strokeStyle = n === 7 ? '#ffe066' : 'rgba(0,0,0,0.8)'
  ctx.strokeText(String(n), cx, cy)
  ctx.fillStyle = SYMBOL_COLORS[idx]
  ctx.fillText(String(n), cx, cy)
  ctx.globalAlpha = 1
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
  else if (stage === 'normal') ctx.strokeStyle = '#ffd23d'
  else if (g.phase === 'rush') ctx.strokeStyle = '#ff4df0'
  else ctx.strokeStyle = 'rgba(160,190,255,0.5)'
  ctx.stroke()

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
    const dots = Math.floor((t * 2.2) % 4)
    ctx.fillStyle = '#e6e9f5'
    ctx.font = '900 64px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('・'.repeat(dots), W / 2, 470)
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
  ctx.font = 'bold 11px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(200,210,255,0.6)'
  ctx.fillText('保留', 30, y + 4)
  for (let i = 0; i < SPEC.maxHolds; i++) {
    const x = 90 + i * 34
    const h = g.holds[i]
    ctx.beginPath()
    ctx.arc(x, y, 11, 0, Math.PI * 2)
    if (h) {
      const lvl = holdLevel(h.shown)
      const pulse = lvl >= 3 ? 1 + 0.12 * Math.sin(t * 10) : 1
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
    ctx.fillStyle = 'rgba(200,210,255,0.6)'
    ctx.fillText('当該', x - 34, y + 4)
    ctx.beginPath()
    ctx.arc(x + 12, y, 12, 0, Math.PI * 2)
    ctx.fillStyle = holdFill(ctx, c, x + 12, t)
    ctx.fill()
  }
}

function drawHud(ctx: CanvasRenderingContext2D, g: Game, ui: Ui, t: number) {
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(200,210,255,0.7)'
  ctx.font = 'bold 11px system-ui, sans-serif'
  ctx.fillText('持ち玉', 16, 20)
  ctx.fillStyle = '#fff'
  ctx.font = '900 28px system-ui, sans-serif'
  ctx.fillText(Math.round(ui.displayBalls).toLocaleString(), 16, 48)
  if (ui.owner) {
    ctx.font = 'bold 10px system-ui, sans-serif'
    ctx.fillStyle = '#3ddc84'
    ctx.fillText('OWNER', 60, 20)
  }

  ctx.textAlign = 'center'
  if (g.phase === 'rush' || (g.phase === 'fever' && g.chain > 0 && g.fever?.fromMode === 'rush')) {
    ctx.font = '900 22px system-ui, sans-serif'
    ctx.fillStyle = rainbowGradient(ctx, 150, 300, t)
    ctx.fillText(`RUSH ${g.chain}連`, W / 2, 30)
    if (g.phase === 'rush') {
      ctx.font = 'bold 12px system-ui, sans-serif'
      ctx.fillStyle = '#ffb3f5'
      ctx.fillText(`残り ${g.rushLeft} 回`, W / 2, 48)
    }
  } else if (g.phase === 'fever' && g.fever) {
    ctx.font = '900 20px system-ui, sans-serif'
    ctx.fillStyle = '#ffd23d'
    ctx.fillText(`ROUND ${Math.max(1, g.fever.round)} / ${g.fever.shownRounds}`, W / 2, 30)
  } else {
    ctx.font = 'bold 11px system-ui, sans-serif'
    ctx.fillStyle = 'rgba(200,210,255,0.55)'
    ctx.fillText(`最高 ${ui.best.chain}連 / ${ui.best.total.toLocaleString()}玉`, W / 2, 26)
    ctx.fillText('押しっぱなしで発射 ・ 指の位置に落ちる', W / 2, 44)
  }

  for (const [b, label] of [
    [BTN_MUTE, ui.muted ? '🔇' : '🔊'],
    [BTN_MOTION, ui.reducedMotion ? '◐' : '✦'],
  ] as const) {
    roundRect(ctx, b.x, b.y, b.w, b.h, 8)
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = '16px system-ui, sans-serif'
    ctx.fillText(label, b.x + b.w / 2, b.y + 21)
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

function drawBanner(ctx: CanvasRenderingContext2D, fx: Fx, t: number) {
  drawPopups(ctx, fx)
  const b = fx.banner
  if (!b) return
  const age = b.max - b.life
  // 出現時にオーバーシュートして弾む
  const k = Math.min(1, age / 0.25)
  const pop = k < 1 ? 0.3 + 0.7 * (1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2)) : 1
  const alpha = Math.min(1, b.life / 0.25)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(W / 2, 470)
  ctx.scale(pop, pop)
  ctx.textAlign = 'center'
  ctx.font = `900 ${b.size}px system-ui, sans-serif`
  ctx.lineWidth = 10
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'
  ctx.strokeText(b.text, 0, 0)
  ctx.fillStyle = b.rainbow ? rainbowGradient(ctx, -180, 180, t) : b.color
  ctx.fillText(b.text, 0, 0)
  if (b.sub) {
    ctx.font = '900 22px system-ui, sans-serif'
    ctx.lineWidth = 6
    ctx.strokeText(b.sub, 0, 40)
    ctx.fillStyle = '#fff'
    ctx.fillText(b.sub, 0, 40)
  }
  ctx.restore()
}

function drawRenda(ctx: CanvasRenderingContext2D, g: Game, t: number) {
  const r = g.spin!.renda!
  const cx = W / 2
  const cy = 600
  const beat = 1 + 0.12 * Math.abs(Math.sin(t * 18))
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(beat, beat)
  ctx.textAlign = 'center'
  ctx.font = '900 58px system-ui, sans-serif'
  ctx.lineWidth = 10
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'
  ctx.strokeText('連打!!', 0, 0)
  ctx.fillStyle = rainbowGradient(ctx, -110, 110, t)
  ctx.fillText('連打!!', 0, 0)
  ctx.restore()
  ctx.textAlign = 'center'
  ctx.font = 'bold 14px system-ui, sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText(`画面を連打してゲージを上げろ！  ${r.taps} HIT`, cx, cy + 40)
  // 残り時間
  const k = Math.max(0, r.left / RENDA_TIME)
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  roundRect(ctx, cx - 100, cy + 54, 200, 8, 4)
  ctx.fill()
  ctx.fillStyle = '#ff3355'
  roundRect(ctx, cx - 100, cy + 54, Math.max(8, 200 * k), 8, 4)
  ctx.fill()
}

function drawPush(ctx: CanvasRenderingContext2D, g: Game, t: number) {
  const cx = W / 2
  const cy = 600
  const waited = g.spin?.waitingPush ? g.spin.pushWait : g.sceneTime - 3.2
  const remain = Math.max(0, 1 - waited / PUSH_AUTO)
  const pulse = 1 + 0.08 * Math.sin(t * 14)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(pulse, pulse)
  ctx.shadowColor = '#ff2d55'
  ctx.shadowBlur = 30
  const grd = ctx.createRadialGradient(0, -10, 10, 0, 0, 62)
  grd.addColorStop(0, '#ff8aa0')
  grd.addColorStop(1, '#d0002a')
  ctx.fillStyle = grd
  ctx.beginPath()
  ctx.arc(0, 0, 58, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(0, 0, 68, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remain)
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.font = '900 30px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('PUSH', 0, 11)
  ctx.restore()
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = 'bold 13px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('画面をタップ！', cx, cy + 92)
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
    ctx.fillText('獲得', W / 2, 300)
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
  }
  if (g.scene === 'challenge') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, BOARD_TOP - 12, W, H)
    ctx.textAlign = 'center'
    ctx.font = '900 26px system-ui, sans-serif'
    ctx.fillStyle = rainbowGradient(ctx, 80, 370, t)
    ctx.fillText('RUSH 突入チャレンジ', W / 2, 330)
    if (g.fever) {
      ctx.font = '900 20px system-ui, sans-serif'
      ctx.fillStyle = '#ffd23d'
      ctx.fillText(`今回の獲得 +${g.fever.payout.toLocaleString()} 玉`, W / 2, 292)
    }
    ctx.font = 'bold 14px system-ui, sans-serif'
    ctx.fillStyle = '#ddd'
    ctx.fillText(`成功で「継続率 約${Math.round((1 - Math.pow(1 - SPEC.rushWinRate, SPEC.rushSpins)) * 100)}%」の RUSH へ`, W / 2, 358)
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
    ctx.font = 'bold 12px system-ui, sans-serif'
    ctx.fillStyle = '#fff'
    ctx.fillText('50%', gx + gw / 2, 432)
  }
  if (g.scene === 'rushEnd') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(0, BOARD_TOP - 12, W, H)
    ctx.textAlign = 'center'
    ctx.font = '900 24px system-ui, sans-serif'
    ctx.fillStyle = '#fff'
    ctx.fillText('RUSH 終了', W / 2, 360)
    ctx.font = '900 54px system-ui, sans-serif'
    ctx.fillStyle = rainbowGradient(ctx, 100, 350, t)
    ctx.fillText(`${g.chain}連`, W / 2, 430)
    ctx.font = '900 26px system-ui, sans-serif'
    ctx.fillStyle = '#ffd23d'
    ctx.fillText(`総獲得 ${g.chainTotal.toLocaleString()} 玉`, W / 2, 480)
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
    '画面を押しっぱなしで玉を発射。',
    '指の位置に玉が落ちます。',
    '動く「START」に入れるとデジタル抽選。',
    '保留の色・リーチの格は期待度のサイン。',
    'PUSH が出たら自分の手で結果を開けよう。',
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

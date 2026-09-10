import { useEffect, useRef, type RefObject } from 'react'
import { ATTACKER, OUT_LANE, START_CHUCKER } from '../game/board'
import { LANE_X, LANE_TOP_Y, LANE_BOTTOM_Y } from '../game/physics'
import type { Ball, GameState, Pin, Pocket } from '../game/types'
import { BALL_RADIUS, LAUNCH_LANE_WIDTH, PLAYFIELD_HEIGHT, PLAYFIELD_WIDTH } from '../game/types'

interface BoardProps {
  ballsRef: RefObject<Ball[]>
  pinsRef: RefObject<Pin[]>
  pocketsRef: RefObject<Pocket[]>
  stateRef: RefObject<GameState>
}

interface Bubble {
  x: number
  y: number
  r: number
  speed: number
  drift: number
}

function makeBubbles(count: number): Bubble[] {
  const bubbles: Bubble[] = []
  for (let i = 0; i < count; i++) {
    bubbles.push({
      x: Math.random() * PLAYFIELD_WIDTH,
      y: Math.random() * PLAYFIELD_HEIGHT,
      r: 1.5 + Math.random() * 3,
      speed: 8 + Math.random() * 18,
      drift: (Math.random() - 0.5) * 6,
    })
  }
  return bubbles
}

export function Board({ ballsRef, pinsRef, pocketsRef, stateRef }: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const bubblesRef = useRef<Bubble[]>(makeBubbles(26))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = PLAYFIELD_WIDTH * dpr
    canvas.height = PLAYFIELD_HEIGHT * dpr
    ctx.scale(dpr, dpr)

    let rafId = 0
    let last = performance.now()

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now

      const balls = ballsRef.current ?? []
      const pins = pinsRef.current ?? []
      const pockets = pocketsRef.current ?? []
      const gameState = stateRef.current

      drawBackground(ctx)
      updateAndDrawBubbles(ctx, bubblesRef.current, dt)
      drawLaunchLane(ctx)
      drawPins(ctx, pins)
      drawOutLane(ctx)
      drawPrizePockets(ctx, pockets)
      drawStartChucker(ctx, gameState)
      drawAttacker(ctx, gameState)
      drawBalls(ctx, balls)
      if (gameState && gameState.bonus.phase === 'opening') {
        drawJackpotBanner(ctx)
      }

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [ballsRef, pinsRef, pocketsRef, stateRef])

  return (
    <canvas
      ref={canvasRef}
      className="pachinko-board"
      style={{ width: PLAYFIELD_WIDTH, height: PLAYFIELD_HEIGHT }}
      aria-label="海テーマのパチンコ盤面"
      role="img"
    />
  )
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, 0, PLAYFIELD_HEIGHT)
  gradient.addColorStop(0, '#0a3d67')
  gradient.addColorStop(0.55, '#073158')
  gradient.addColorStop(1, '#031b34')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT)
}

function updateAndDrawBubbles(ctx: CanvasRenderingContext2D, bubbles: Bubble[], dt: number) {
  ctx.save()
  ctx.fillStyle = 'rgba(190, 230, 255, 0.35)'
  for (const b of bubbles) {
    b.y -= b.speed * dt
    b.x += b.drift * dt
    if (b.y < -10) {
      b.y = PLAYFIELD_HEIGHT + 10
      b.x = Math.random() * PLAYFIELD_WIDTH
    }
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawLaunchLane(ctx: CanvasRenderingContext2D) {
  const laneLeft = LANE_X - LAUNCH_LANE_WIDTH / 2
  ctx.save()
  const gradient = ctx.createLinearGradient(laneLeft, 0, laneLeft + LAUNCH_LANE_WIDTH, 0)
  gradient.addColorStop(0, '#0f2e46')
  gradient.addColorStop(0.5, '#2c5a7d')
  gradient.addColorStop(1, '#0f2e46')
  ctx.fillStyle = gradient
  ctx.fillRect(laneLeft, LANE_TOP_Y - 10, LAUNCH_LANE_WIDTH, LANE_BOTTOM_Y - LANE_TOP_Y + 30)
  ctx.restore()
}

function drawPins(ctx: CanvasRenderingContext2D, pins: Pin[]) {
  ctx.save()
  for (const pin of pins) {
    ctx.beginPath()
    ctx.arc(pin.pos.x, pin.pos.y, pin.radius, 0, Math.PI * 2)
    ctx.fillStyle = '#e8f6ff'
    ctx.shadowColor = 'rgba(180, 230, 255, 0.6)'
    ctx.shadowBlur = 3
    ctx.fill()
  }
  ctx.restore()
}

function drawPrizePockets(ctx: CanvasRenderingContext2D, pockets: Pocket[]) {
  ctx.save()
  for (const pocket of pockets) {
    if (pocket.kind !== 'prize') continue
    ctx.beginPath()
    ctx.arc(pocket.pos.x, pocket.pos.y, pocket.radius, 0, Math.PI * 2)
    ctx.fillStyle = '#173a52'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#ffd15c'
    ctx.stroke()
  }
  ctx.restore()
}

function drawStartChucker(ctx: CanvasRenderingContext2D, state: GameState | null) {
  const lit = !!state && !state.reel.spinning && state.bonus.phase === 'idle'
  ctx.save()
  ctx.beginPath()
  ctx.arc(START_CHUCKER.pos.x, START_CHUCKER.pos.y, START_CHUCKER.radius, 0, Math.PI * 2)
  ctx.fillStyle = lit ? '#ffe27a' : '#c98f2b'
  ctx.shadowColor = lit ? 'rgba(255, 226, 122, 0.8)' : 'transparent'
  ctx.shadowBlur = lit ? 10 : 0
  ctx.fill()
  ctx.restore()
}

function drawAttacker(ctx: CanvasRenderingContext2D, state: GameState | null) {
  const open = !!state && state.bonus.phase === 'attackerOpen'
  const width = ATTACKER.radius * 2.2
  const height = 26
  const x = ATTACKER.pos.x - width / 2
  const y = ATTACKER.pos.y - height / 2

  ctx.save()
  ctx.fillStyle = open ? '#1c9c6b' : '#8a2f2f'
  roundRect(ctx, x, y, width, height, 6)
  ctx.fill()

  if (open) {
    // 開いたフラップを左右に表現
    ctx.fillStyle = '#0d5c3d'
    roundRect(ctx, x - 4, y - 6, width / 2 - 2, 6, 3)
    ctx.fill()
    roundRect(ctx, x + width / 2 + 2, y - 6, width / 2 - 2, 6, 3)
    ctx.fill()
  }

  ctx.fillStyle = '#f4f4f4'
  ctx.font = 'bold 11px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(open ? 'OPEN' : 'V', ATTACKER.pos.x, ATTACKER.pos.y + 4)
  ctx.restore()
}

function drawOutLane(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.fillStyle = '#02121f'
  roundRect(ctx, OUT_LANE.pos.x - OUT_LANE.radius, OUT_LANE.pos.y - 14, OUT_LANE.radius * 2, 28, 8)
  ctx.fill()
  ctx.restore()
}

function drawBalls(ctx: CanvasRenderingContext2D, balls: Ball[]) {
  ctx.save()
  for (const ball of balls) {
    const gradient = ctx.createRadialGradient(
      ball.pos.x - 2,
      ball.pos.y - 2,
      0.5,
      ball.pos.x,
      ball.pos.y,
      BALL_RADIUS,
    )
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(1, '#b9c6cf')
    ctx.beginPath()
    ctx.arc(ball.pos.x, ball.pos.y, BALL_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = gradient
    ctx.fill()
  }
  ctx.restore()
}

function drawJackpotBanner(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.fillStyle = 'rgba(255, 209, 92, 0.15)'
  ctx.fillRect(0, PLAYFIELD_HEIGHT / 2 - 40, PLAYFIELD_WIDTH, 80)
  ctx.fillStyle = '#ffd15c'
  ctx.font = 'bold 26px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('大当たり！', PLAYFIELD_WIDTH / 2, PLAYFIELD_HEIGHT / 2 + 9)
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

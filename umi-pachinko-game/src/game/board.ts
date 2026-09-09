import type { Pin, Pocket } from './types'
import { LAUNCH_LANE_WIDTH, PIN_RADIUS, PLAYFIELD_HEIGHT, PLAYFIELD_WIDTH } from './types'

const PLAY_AREA_RIGHT = PLAYFIELD_WIDTH - LAUNCH_LANE_WIDTH

export const START_CHUCKER: Pocket = {
  id: 'start',
  pos: { x: PLAY_AREA_RIGHT / 2, y: 470 },
  radius: 12,
  kind: 'start',
}

export const ATTACKER: Pocket = {
  id: 'attacker',
  pos: { x: PLAY_AREA_RIGHT / 2, y: 530 },
  radius: 26,
  kind: 'attacker',
}

export const OUT_LANE: Pocket = {
  id: 'out',
  pos: { x: PLAY_AREA_RIGHT / 2, y: PLAYFIELD_HEIGHT - 6 },
  radius: 40,
  kind: 'out',
}

export const PRIZE_POCKETS: Pocket[] = [
  { id: 'prize-left', pos: { x: 46, y: 400 }, radius: 10, kind: 'prize' },
  { id: 'prize-right', pos: { x: PLAY_AREA_RIGHT - 46, y: 400 }, radius: 10, kind: 'prize' },
]

export function buildPockets(): Pocket[] {
  return [START_CHUCKER, ATTACKER, OUT_LANE, ...PRIZE_POCKETS]
}

/** ステージャード配置の釘フィールドを生成する。中央下部はチャッカー類のために空けてある。 */
export function buildPins(): Pin[] {
  const pins: Pin[] = []
  const spacingX = 30
  const spacingY = 30
  const marginX = 22
  const topY = 70
  const bottomY = 460

  let row = 0
  for (let y = topY; y <= bottomY; y += spacingY) {
    const offset = row % 2 === 0 ? 0 : spacingX / 2
    for (let x = marginX + offset; x <= PLAY_AREA_RIGHT - marginX; x += spacingX) {
      // 中央の抽選口・アタッカーへ続く落下ルートは釘を間引いて空ける
      const nearCenterBottom = y > 340 && Math.abs(x - PLAY_AREA_RIGHT / 2) < 34
      if (nearCenterBottom) continue
      pins.push({ pos: { x, y }, radius: PIN_RADIUS })
    }
    row += 1
  }

  return pins
}

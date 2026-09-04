import { useMemo } from 'react'
import { RARITY_RATES } from '../game/gacha'
import { MONSTERS } from '../game/monsters'
import { EGG_TIER_BY_RARITY, EGG_TIER_THEME, RARITY_STAR_COLOR } from '../game/orbTheme'
import type { Rarity } from '../game/types'

const RARITIES: readonly Rarity[] = [6, 5, 4, 3, 2, 1]

interface GachaRateModalProps {
  readonly onClose: () => void
}

/** 法令上の確率表示に相当する、排出率の一覧（景品表示法対応のイメージ） */
export const GachaRateModal = ({ onClose }: GachaRateModalProps) => {
  const poolCountByRarity = useMemo(() => {
    const map = new Map<Rarity, number>()
    for (const m of MONSTERS) map.set(m.rarity, (map.get(m.rarity) ?? 0) + 1)
    return map
  }, [])

  return (
    <div className="rate-modal-overlay" onClick={onClose}>
      <div className="rate-modal-card" onClick={(event) => event.stopPropagation()}>
        <h3>排出確率</h3>
        <table className="rate-modal-table">
          <thead>
            <tr>
              <th>卵</th>
              <th>レア度</th>
              <th>確率</th>
              <th>収録数</th>
            </tr>
          </thead>
          <tbody>
            {RARITIES.map((rarity) => {
              const tier = EGG_TIER_BY_RARITY[rarity]
              const poolCount = poolCountByRarity.get(rarity) ?? 0
              return (
                <tr key={rarity}>
                  <td>{EGG_TIER_THEME[tier].label}</td>
                  <td style={{ color: RARITY_STAR_COLOR[rarity] }}>{'★'.repeat(rarity)}</td>
                  <td>{RARITY_RATES[rarity]}%</td>
                  <td>{poolCount}種</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="rate-modal-note">
          10連には4★以上が1体以上確定する保証枠があります。また、通算50連ごとに5★以上が確定する天井もあります。
        </p>
        <button type="button" className="primary-button" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  )
}

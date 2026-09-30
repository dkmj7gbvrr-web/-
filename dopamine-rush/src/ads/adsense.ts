import type { AdCallbacks, AdProvider } from './refillGate'

/**
 * Google AdSense の H5 Games Ads（Ad Placement API）でリワード広告を出す。
 * 利用には AdSense アカウントと H5 Games Ads の審査通過が必要。
 * 設定は src/ads/config.ts。
 */

interface PlacementInfo {
  breakStatus?: string
}
interface AdBreakParams {
  type: 'reward'
  name: string
  beforeAd: () => void
  afterAd: () => void
  beforeReward: (showAdFn: () => void) => void
  adDismissed: () => void
  adViewed: () => void
  adBreakDone: (info: PlacementInfo) => void
}
interface AdConfigParams {
  sound: 'on' | 'off'
  preloadAdBreaks: 'on' | 'auto'
}

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

const push = (o: AdBreakParams | AdConfigParams) => {
  window.adsbygoogle = window.adsbygoogle || []
  window.adsbygoogle.push(o)
}

export function loadAdSense(client: string, opts: { test: boolean; frequencyHint: string }) {
  const s = document.createElement('script')
  s.async = true
  s.crossOrigin = 'anonymous'
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`
  if (opts.test) s.dataset.adbreakTest = 'on'
  s.dataset.adFrequencyHint = opts.frequencyHint
  document.head.appendChild(s)
}

export function configureAdSense(soundOn: boolean) {
  push({ sound: soundOn ? 'on' : 'off', preloadAdBreaks: 'on' })
}

export class AdSenseRewardProvider implements AdProvider {
  request(cb: AdCallbacks) {
    let offered = false
    push({
      type: 'reward',
      name: 'refill-balls',
      beforeAd: () => cb.onBeforeAd(),
      afterAd: () => cb.onAfterAd(),
      beforeReward: (showAdFn) => {
        offered = true
        cb.onReady(showAdFn)
      },
      adDismissed: () => cb.onDismissed(),
      adViewed: () => cb.onViewed(),
      adBreakDone: (info) => {
        // 広告が提示されずに終わった（未準備・頻度制限・エラーなど）
        if (!offered) cb.onUnavailable(info?.breakStatus ?? 'unknown')
        else if (info?.breakStatus === 'ignored') cb.onUnavailable('ignored')
      },
    })
  }
}

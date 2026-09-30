/**
 * 広告の設定。
 *
 * - AD_CLIENT が空のあいだは広告を出さず、これまでどおり無料で補給できる。
 *   AdSense の H5 Games Ads の審査に通ったら、発行されたパブリッシャー ID（"ca-pub-" から始まる）を入れる。
 * - AD_TEST が true のあいだは、本物の広告の代わりにテスト広告が出る（収益は発生しない）。
 *   動作を確かめたら false にする。
 */
export const AD_CLIENT = ''
export const AD_TEST = true
/** 広告どうしの最短間隔の目安（AdSense の data-ad-frequency-hint） */
export const AD_FREQUENCY_HINT = '30s'

/**
 * オーナー（運営者）は広告なしで補給できる。
 * `?owner=合言葉` を付けて一度開くと、その端末のブラウザに記憶される（`?owner=off` で解除）。
 * コードには合言葉そのものではなく SHA-256 ハッシュだけを置く。
 */
export const OWNER_PASSPHRASE_SHA256 = '0d5b9efd90cd4a7e43df2e62bf87448b8b95dbf35e60fb1e09b590aa5cd74fbd'

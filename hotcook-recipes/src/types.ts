/** ホットクックで使うモード（自動メニュー or 手動の設定）1つぶん */
export interface HotcookMode {
  /** auto: 自動メニュー（番号指定） / manual: 手動で作る / other: 判別できないメモ */
  kind: 'auto' | 'manual' | 'other'
  /** 一覧・詳細に出す表示用の文字列（ユーザーが自由に書き換えられる） */
  label: string
  /** 手動のカテゴリー（例: 煮物を作る、炒める） */
  category?: string
  stir?: 'まぜる' | 'まぜない'
  minutes?: number
  celsius?: number
  /** 自動メニューの番号（例: "123"、"煮物2-1"） */
  menuNo?: string
  /** 抽出の根拠になった原文（自動抽出したときだけ） */
  snippet?: string
}

export interface Recipe {
  id: string
  url: string
  title: string
  image?: string
  servings?: string
  /** 1行1材料。「【A】」のような見出し行もそのまま入れる */
  ingredients: string[]
  steps: string[]
  modes: HotcookMode[]
  tags: string[]
  memo: string
  /** 0〜5 */
  rating: number
  cookedCount: number
  lastCookedAt?: string
  /** サイト名（og:site_name かドメイン） */
  source?: string
  createdAt: string
  updatedAt: string
}

/** URL・テキストから読み取った、保存前の下書き */
export interface RecipeDraft {
  title: string
  url: string
  image?: string
  servings?: string
  ingredients: string[]
  steps: string[]
  modes: HotcookMode[]
  source?: string
  /** どの方法で読み取れたか（画面で「構造化データから」「本文から推測」と出し分ける） */
  method: 'jsonld' | 'heuristic' | 'manual'
}

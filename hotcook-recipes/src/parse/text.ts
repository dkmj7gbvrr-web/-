/**
 * 構造化データが無いページ（個人ブログなど）や、貼り付けたテキストから
 * 「材料」「作り方」の見出しを手がかりに中身を推測する。
 */

export interface TextRecipe {
  title?: string
  servings?: string
  ingredients: string[]
  steps: string[]
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'IFRAME', 'NAV', 'FOOTER', 'HEADER', 'ASIDE', 'FORM', 'BUTTON', 'SELECT'])
const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'BLOCKQUOTE', 'BR', 'DD', 'DIV', 'DL', 'DT', 'FIGCAPTION', 'FIGURE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'HR', 'LI', 'MAIN', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TD', 'TH', 'TR', 'UL',
])

/** 見た目の改行をおおよそ再現したテキストにする（textContent だと li や p がつながってしまう） */
export function visibleText(root: Element): string {
  const parts: string[] = []
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? '')
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    if (SKIP_TAGS.has(el.tagName.toUpperCase())) return
    const block = BLOCK_TAGS.has(el.tagName.toUpperCase())
    if (block) parts.push('\n')
    if (el.tagName.toUpperCase() === 'TD' || el.tagName.toUpperCase() === 'TH') parts.push(' ')
    for (const child of Array.from(el.childNodes)) walk(child)
    if (block) parts.push('\n')
  }
  walk(root)
  return parts
    .join('')
    .split('\n')
    .map((l) => l.replace(/[ \t 　]+/g, ' ').trim())
    .filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n')
}

const MARK = String.raw`^[\s【■□●○◆◇▼▽★☆◎\[［〈《「『#＃・*＊]*`
const INGREDIENT_HEAD = new RegExp(`${MARK}(材料|食材|用意するもの)`)
const STEP_HEAD = new RegExp(`${MARK}(作り方|つくり方|手順|調理方法|調理手順|レシピ手順|作りかた)`)
const END_HEAD = new RegExp(
  `${MARK}(ポイント|コツ|メモ|保存方法|保存|栄養|関連|おすすめ|人気|この記事|シェア|コメント|つくれぽ|みんなの|SNS|プロフィール|カテゴリー|タグ|前の記事|次の記事|広告|スポンサー|まとめ|参考)`,
)

const STEP_NUMBER = /^\s*(?:STEP\s*)?(?:[0-9０-９]{1,2}\s*[.．、)）:：]|[①-⑳]|\(\s*[0-9]{1,2}\s*\)|（\s*[0-9０-９]{1,2}\s*）)\s*/i

function servingsFrom(line: string): string | undefined {
  const m = line.match(/[（(]?\s*([0-9０-９一二三四五六七八九十]+\s*(?:〜|~|～)?\s*[0-9０-９]*\s*(?:人分|人前|皿分|個分|食分))\s*[）)]?/)
  return m ? m[1].replace(/\s+/g, '') : undefined
}

export function extractFromText(text: string, maxSteps = 40): TextRecipe {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const result: TextRecipe = { ingredients: [], steps: [] }
  // スクショの1行目はステータスバー（「12:34 5G」など）のことがあるので、文字（かな・漢字・英字）を含む行だけを料理名の候補にする
  result.title = lines.find((l) => l.length > 0 && l.length <= 60 && !/^\d{1,2}[:：]\d{2}/.test(l) && /[\p{L}]{2,}/u.test(l.replace(/\d+G|LTE|[A-Z]{1,3}\b/g, '')))

  const ingIdx = lines.findIndex((l) => INGREDIENT_HEAD.test(l) && l.length <= 30)
  const stepIdx = lines.findIndex((l, i) => i > ingIdx && STEP_HEAD.test(l) && l.length <= 30)

  if (ingIdx >= 0) {
    result.servings = servingsFrom(lines[ingIdx])
    const end = stepIdx > ingIdx ? stepIdx : Math.min(lines.length, ingIdx + 40)
    for (const line of lines.slice(ingIdx + 1, end)) {
      if (!line) continue
      if (END_HEAD.test(line) && line.length <= 20) break
      if (!result.servings) result.servings = servingsFrom(line)
      // 材料行は短い。長い行は説明文なので飛ばす
      // 行頭の箇条書き記号（・ • ● - * など）は落とす
      const item = line.replace(/^[・•●○◦▪■□\-–*＊]+\s*/, '')
      if (item && item.length <= 50) result.ingredients.push(item)
    }
  }

  if (stepIdx >= 0) {
    let current = ''
    const flush = () => {
      if (current.trim()) result.steps.push(current.trim())
      current = ''
    }
    for (const line of lines.slice(stepIdx + 1)) {
      if (END_HEAD.test(line) && line.length <= 20) break
      if (INGREDIENT_HEAD.test(line) && line.length <= 20) break
      if (!line) {
        flush()
        continue
      }
      if (/^(?:STEP\s*)?[0-9０-９]{1,2}$/i.test(line)) {
        flush()
        continue
      }
      if (STEP_NUMBER.test(line)) {
        flush()
        current = line.replace(STEP_NUMBER, '')
      } else {
        current = current ? `${current} ${line}` : line
      }
      // 番号のない書き方でも、文末（。）で終わる行はそこで1手順とする
      if (/[。！!]$/.test(current)) flush()
      if (result.steps.length >= maxSteps) break
    }
    flush()
    result.steps = result.steps.filter((s) => !/^[0-9０-９]{1,2}$/.test(s)).slice(0, maxSteps)
  }

  return result
}

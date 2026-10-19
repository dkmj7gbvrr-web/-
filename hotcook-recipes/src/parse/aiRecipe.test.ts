import { describe, expect, it } from 'vitest'
import { aiPrompt, parseAiRecipe } from './aiRecipe'

const reply = `はい、読み取りました。

\`\`\`json
{
  "title": "鶏チャーシュー（焼き肉のタレ味）",
  "servings": "",
  "ingredients": ["鶏肉（むね or もも） 1枚（約260g）", "お好みの焼き肉のタレ 大さじ3"],
  "steps": ["内鍋に鶏肉を入れる（皮目を下に）", "自動メニュー No.239 で加熱"],
  "modes": [{ "kind": "auto", "menuNo": "239", "label": "自動メニュー No.239 さっぱり鶏ももチャーシュー" }],
  "memo": "",
  "source": "X：たろすけ@ホットクック",
  "url": ""
}
\`\`\`
`

describe('parseAiRecipe', () => {
  it('コードブロックの JSON を下書きにする（空欄は入れない）', () => {
    const d = parseAiRecipe(reply)
    expect(d).toMatchObject({
      method: 'ai',
      title: '鶏チャーシュー（焼き肉のタレ味）',
      ingredients: ['鶏肉（むね or もも） 1枚（約260g）', 'お好みの焼き肉のタレ 大さじ3'],
      steps: ['内鍋に鶏肉を入れる（皮目を下に）', '自動メニュー No.239 で加熱'],
      modes: [{ kind: 'auto', menuNo: '239', label: '自動メニュー No.239 さっぱり鶏ももチャーシュー' }],
      source: 'X：たろすけ@ホットクック',
    })
    expect(d?.servings).toBeUndefined()
    expect(d?.memo).toBeUndefined()
  })

  it('コードブロックが無くても前後の文章ごと貼られた JSON を読む', () => {
    const d = parseAiRecipe('結果です → {"title":"肉じゃが","ingredients":["じゃがいも 3個"],"steps":[]} 以上')
    expect(d?.title).toBe('肉じゃが')
  })

  it('label が無いモードはアプリの形で組み立て、使えない値は捨てる', () => {
    const d = parseAiRecipe(
      JSON.stringify({
        title: 'カレー',
        ingredients: [],
        steps: ['煮る'],
        modes: [{ kind: 'manual', category: '煮物を作る', stir: 'まぜる', minutes: '30' }, { kind: 'other' }, 'x'],
      }),
    )
    expect(d?.modes).toEqual([{ kind: 'manual', category: '煮物を作る', stir: 'まぜる', minutes: 30, label: '手動 › 煮物を作る（まぜる） 30分' }])
  })

  it('レシピの JSON でなければ null（普通のテキストとして解析させる）', () => {
    expect(parseAiRecipe('材料\n玉ねぎ 1個\n作り方\n1. 切る。')).toBeNull()
    expect(parseAiRecipe('{ 壊れた JSON ')).toBeNull()
    expect(parseAiRecipe('{"foo": 1}')).toBeNull()
  })

  it('URL 欄の値を補い、JSON の url を優先する', () => {
    expect(parseAiRecipe('{"title":"a","steps":["b"]}', 'https://example.com/x')?.url).toBe('https://example.com/x')
    expect(parseAiRecipe('{"title":"a","steps":["b"],"url":"https://y.example/"}', 'https://example.com/x')?.url).toBe('https://y.example/')
  })
})

describe('aiPrompt', () => {
  it('容量を選んだときだけ、その容量の分だけ書くよう頼む', () => {
    expect(aiPrompt('1.6L')).toContain('1.6L の分だけを書き')
    expect(aiPrompt('')).not.toContain('の分だけを書き')
  })

  it('依頼文の中の JSON の見本は、そのまま取り込める形になっている', () => {
    const d = parseAiRecipe(aiPrompt(''))
    expect(d?.method).toBe('ai')
  })
})

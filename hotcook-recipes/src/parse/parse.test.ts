import { describe, expect, it } from 'vitest'
import { parseRecipeHtml, parseRecipeText } from './index'
import { extractModes } from './mode'

describe('extractModes', () => {
  it('手動の設定（カテゴリー・まぜる・時間）を拾う', () => {
    const modes = extractModes(['材料を内鍋に入れ、手動で作る→煮物を作る（まぜる）→30分でスタート。'])
    expect(modes).toHaveLength(1)
    expect(modes[0]).toMatchObject({ kind: 'manual', category: '煮物を作る', stir: 'まぜる', minutes: 30 })
    expect(modes[0].label).toBe('手動 › 煮物を作る（まぜる） 30分')
  })

  it('まぜない・時間表記（1時間10分）・全角数字を読む', () => {
    const [m] = extractModes(['手動 煮物を作る まぜない １時間１０分'])
    expect(m).toMatchObject({ stir: 'まぜない', minutes: 70 })
  })

  it('発酵・低温調理の温度を拾う', () => {
    const [m] = extractModes(['手動の発酵・低温調理で60℃ 2時間'])
    expect(m).toMatchObject({ category: '発酵・低温調理', celsius: 60, minutes: 120 })
  })

  it('自動メニュー番号を拾う', () => {
    expect(extractModes(['自動メニュー No.123 で加熱します'])[0]).toMatchObject({ kind: 'auto', menuNo: '123' })
    expect(extractModes(['メニュー番号045「肉じゃが」を選ぶ'])[0]).toMatchObject({ kind: 'auto', menuNo: '045' })
  })

  it('機種別の「煮物2-1」形式を拾う', () => {
    const [m] = extractModes(['ホットクックの煮物２－１で加熱'])
    expect(m).toMatchObject({ kind: 'auto', menuNo: '煮物2-1', label: '自動メニュー 煮物2-1' })
  })

  it('普通の手順（ホットクックの設定でない文）は拾わない', () => {
    expect(extractModes(['フライパンで玉ねぎを5分炒める。', 'ボウルでよく混ぜる。', '200gの豚肉'])).toEqual([])
    expect(extractModes(['No.1 人気のレシピ'])).toEqual([])
  })

  it('同じ設定は1つにまとめる', () => {
    expect(extractModes(['手動 炒める 10分', '手動 炒める 10分'])).toHaveLength(1)
  })
})

describe('parseRecipeHtml', () => {
  it('JSON-LD の Recipe（@graph・HowToSection・実体参照）を読む', () => {
    const ld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'のらブログ' },
        {
          '@type': ['Recipe'],
          name: 'ホットクックで無水カレー',
          image: [{ url: '/img/curry.jpg' }],
          recipeYield: ['4', '4人分'],
          recipeIngredient: ['玉ねぎ 2個', 'トマト缶 1缶', 'カレールウ &amp; スパイス 適量'],
          recipeInstructions: [
            { '@type': 'HowToSection', name: '下ごしらえ', itemListElement: [{ '@type': 'HowToStep', text: '野菜を切る。' }] },
            { '@type': 'HowToStep', text: '内鍋に入れて手動で作る→煮物を作る（まぜる）→45分。' },
          ],
        },
      ],
    }
    const html = `<html><head><title>無水カレー | のらブログ</title>
      <meta property="og:site_name" content="のらブログ">
      <script type="application/ld+json">${JSON.stringify(ld)}</script></head><body><p>本文</p></body></html>`
    const d = parseRecipeHtml(html, 'https://example.com/recipes/curry')
    expect(d.method).toBe('jsonld')
    expect(d.title).toBe('ホットクックで無水カレー')
    expect(d.image).toBe('https://example.com/img/curry.jpg')
    expect(d.servings).toBe('4人分')
    expect(d.ingredients).toEqual(['玉ねぎ 2個', 'トマト缶 1缶', 'カレールウ & スパイス 適量'])
    expect(d.steps).toEqual(['【下ごしらえ】', '野菜を切る。', '内鍋に入れて手動で作る→煮物を作る（まぜる）→45分。'])
    expect(d.modes.map((m) => m.label)).toEqual(['手動 › 煮物を作る（まぜる） 45分'])
    expect(d.source).toBe('のらブログ')
  })

  it('JSON-LD が無いブログは見出しから推測する', () => {
    const html = `<html><head><title>【ホットクック】豚の角煮 - 週末ごはん</title></head><body>
      <header>サイトメニュー 手動 炒める 99分</header>
      <article>
        <h1>【ホットクック】豚の角煮</h1>
        <p>今日は角煮。</p>
        <h2>材料（2人分）</h2>
        <ul><li>豚バラブロック 400g</li><li>しょうゆ 大さじ3</li><li>砂糖 大さじ2</li></ul>
        <h2>作り方</h2>
        <ol><li>豚肉を3cm幅に切る。</li><li>全部を内鍋に入れ、自動メニュー No.21 を選んでスタート。</li></ol>
        <h2>ポイント</h2><p>一晩おくとおいしい。</p>
      </article></body></html>`
    const d = parseRecipeHtml(html, 'https://www.example.org/kakuni')
    expect(d.method).toBe('heuristic')
    expect(d.title).toBe('【ホットクック】豚の角煮')
    expect(d.servings).toBe('2人分')
    expect(d.ingredients).toEqual(['豚バラブロック 400g', 'しょうゆ 大さじ3', '砂糖 大さじ2'])
    expect(d.steps).toEqual(['豚肉を3cm幅に切る。', '全部を内鍋に入れ、自動メニュー No.21 を選んでスタート。'])
    expect(d.modes.map((m) => m.label)).toEqual(['自動メニュー No.21'])
    expect(d.source).toBe('example.org')
  })
})

describe('parseRecipeText', () => {
  it('貼り付けたテキスト（番号付き手順）を読む', () => {
    const text = `鶏むね肉のしっとり煮
材料 3〜4人分
鶏むね肉 2枚
塩 小さじ1

作り方
1. 鶏肉に塩をすりこむ
2. 内鍋に入れる
3
手動→発酵・低温調理→63℃→1時間30分
ポイント
冷蔵で3日`
    const d = parseRecipeText(text)
    expect(d.title).toBe('鶏むね肉のしっとり煮')
    expect(d.servings).toBe('3〜4人分')
    expect(d.ingredients).toEqual(['鶏むね肉 2枚', '塩 小さじ1'])
    expect(d.steps).toEqual(['鶏肉に塩をすりこむ', '内鍋に入れる', '手動→発酵・低温調理→63℃→1時間30分'])
    expect(d.modes[0]).toMatchObject({ category: '発酵・低温調理', celsius: 63, minutes: 90 })
  })
})

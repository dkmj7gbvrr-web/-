# 割り勘家計簿（WarikanKakeibo）

2人（A・B）で分担する支出を管理する家計簿アプリです。2つの実装があります。

- **iOSネイティブ版**（このREADME）: SwiftUI + SwiftData。Xcodeでビルドが必要です。
- **Web版（共有版）**: [`docs/`](./docs) 以下。ブラウザだけで動き、Firestoreで2人の
  データをリアルタイムに共有できます。セットアップ手順は [`docs/README.md`](./docs/README.md) を参照してください。

以下はiOSネイティブ版の説明です。

## できること

支出ごとに、以下の5パターンのいずれかで負担割合を指定できます。

1. **Aが100%負担**
2. **Bが100%負担**
3. **半々で負担**（50% / 50%）
4. **収入割合で負担** — 直近12ヶ月の手取り収入の割合を5%単位で丸めた比率（収入タブで手取りを月ごとに登録）
5. **任意の割合で負担** — 支出ごとに手入力の割合（5%刻みのスライダー）

各支出には「実際に立て替えた人（A/B）」も記録します。設定した締め日（デフォルト: 毎月6日）を基準に、締め日の翌日から翌締め日までを1つの請求サイクルとして自動でグルーピングし、「集計」タブで

- 各人の本来の負担額
- 各人が実際に立て替えた額
- 差額（どちらがどちらにいくら支払えばよいか）
- 負担パターン別の内訳

をまとめて確認できます。A・Bの表示名や締め日は「設定」タブから変更可能です。

## プロジェクト構成

```
WarikanKakeibo/
  Info.plist
  Sources/
    App/            アプリのエントリーポイントとルートのタブ画面
    Models/          SwiftDataモデル（Expense, IncomeRecord, AppSettings）と値型（SplitType, PersonRole, YearMonth）
    Engine/          締めサイクル・収入割合・負担額・精算額の計算ロジック（UI非依存、テスト対象）
    Views/           支出・集計・収入・設定の各画面
    Support/         通貨フォーマットなどの補助コード
  Resources/
    Assets.xcassets  アプリアイコン・アクセントカラー
WarikanKakeiboTests/  Engine配下の計算ロジックに対するユニットテスト
project.yml            XcodeGen用のプロジェクト定義
```

計算ロジック（締めサイクルの算出、収入割合の丸め、負担額の分解、精算額の計算）は`Sources/Engine`にUIから独立した形でまとめてあり、`WarikanKakeiboTests`から検証しています。

## セットアップ（macOS + Xcode）

このリポジトリは`.xcodeproj`を直接コミットせず、[XcodeGen](https://github.com/yonaskolb/XcodeGen)の`project.yml`からプロジェクトファイルを生成する構成にしています。

```bash
brew install xcodegen
xcodegen generate
open WarikanKakeibo.xcodeproj
```

Xcodeで開いたら、Signing & Capabilitiesタブで自分のDevelopment Teamを設定してください（`PRODUCT_BUNDLE_IDENTIFIER`は`project.yml`内の`com.warikankakeibo.app`をお好みのIDに変更してもOKです）。iOS 17以降のシミュレータ／実機で動作します。

`Cmd+U`でユニットテスト（`WarikanKakeiboTests`）を実行できます。

> **Note:** この変更はLinux上のサンドボックス環境で作成したため、Xcodeでのビルド・テスト実行は未検証です。上記手順でopenした際に問題があれば教えてください。

## 精算の考え方

- 支出ごとに「負担割合（5パターンのいずれか）」から、Aの負担額とBの負担額を算出します（端数はBに寄せて合計が必ず元の金額と一致するようにしています）。
- 締めサイクルごとに、各人の「本来の負担額の合計」と「実際に立て替えた額の合計」を比較し、差額を精算額として表示します。
- 「収入割合で負担」の支出は、その支出が属する締めサイクルの締め月を基準に、直近12ヶ月の収入データから都度計算します（月をまたいで登録された収入データが増えるほど反映されます）。

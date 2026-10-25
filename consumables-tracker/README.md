# 消耗品トラッカー

同棲する二人で使う、家庭の消耗品（洗剤・トイレットペーパー・調味料など）の残量を共有管理するWebアプリです。**アカウント登録（メールアドレス・パスワード）は不要**で、名前を選ぶだけで使えます。

## できること

- **残量を4段階のラフな管理**（多い／普通／少ない／切れた）。数値での在庫管理はしません。
- **一覧からワンタップで残量を更新** — 品目カードのボタンを押すだけで残量ステータスが変わります。
- **残量が少ない／切れたら自動的に色分け表示**（黄＝少ない、赤＝切れた）。
- **買い物リストとの連携** — 残量が「少ない」「切れた」の品目は自動的に買い物リストに並びます。「買った」を押すと残量が「多い」に戻り、リストから自動的に消えます（買い物リスト専用のデータは持たず、常に品目の残量から導出しています）。
- **誰が更新したかの記録** — 「誰ですか」画面で名前を選ぶ/入力するとその人として認識され、各品目に最終更新者と更新日時が表示されます。厳密なパスワード認証は行いません。
- **カテゴリごとのフィルタ表示**。
- **品目ごとの更新履歴**（いつ誰が残量を変えたか、直近20件）。
- **定期交換品の管理**（浄水器カートリッジなど） — 残量ではなく「前回交換日＋交換目安の日数」で次回の交換時期を管理します。次回目安日を過ぎると赤、7日以内に迫ると黄色で表示され、一覧から「交換した」を押すだけで前回交換日が今日に更新されます。押し忘れた場合は、編集画面から過去の日付を指定して後から記録することもできます。
- **プッシュ通知**（任意） — 「通知を有効にする」を押すと、(1) 品目の残量が新たに「少ない／切れた」になった瞬間に本人以外へ、(2) 毎日1回、定期交換品が期限切れ/もうすぐの時に、それぞれ通知が届きます。

## 使い方（利用者向け）

1. デプロイしたURLを開き、名前を選ぶ/入力して「はじめる」
2. 右下の「＋」から品目を追加する（品目名・カテゴリ・初期残量を入力）
3. 一覧のボタンをワンタップして残量を更新する
4. 残量が「少ない」「切れた」になった品目は自動的に画面上部の「買い物リスト」に表示される。買ったら「買った」を押す

もう一人も同じURLを開き、自分の名前を選ぶ/入力すれば、同じデータをリアルタイムに共有できます（「人を切り替える」から別の名前に切り替えることもできます）。

## データモデル

```
User                          Item                              StatusHistoryEntry
--------------------          --------------------              --------------------
id                            id                                id
name                          name                              itemId    -> Item
loginCode?                    category (自由入力の文字列)        userId?   -> User
createdAt                     status (MANY/NORMAL/LOW/OUT)       fromStatus?
                               lastUpdatedById -> User?           toStatus
                               createdAt / updatedAt              createdAt

ReplacementItem                          ReplacementLogEntry
--------------------                     --------------------
id                                       id
name                                     itemId    -> ReplacementItem
intervalDays (交換目安の日数)             userId?   -> User
lastReplacedAt (前回交換日)               replacedAt
lastUpdatedById -> User?
createdAt / updatedAt
```

- **User** — 表示名のみ。メール・パスワードは持たない。Cookie(`ct_uid`)に保存したユーザーIDで本人を識別する。
- **Item** — 品目本体。`status`が残量の現在値。カテゴリは固定enumにせず自由入力の文字列にしており、「洗剤・紙類・調味料・日用品」などはあくまで入力時のサジェスト候補。
- **StatusHistoryEntry** — 残量が変わるたびに1行追記される変更履歴（品目編集画面の「更新履歴」に表示）。
- 買い物リストは独立したテーブルを持たない。`Item.status`が`LOW`/`OUT`のものを毎回抽出して表示し、「買った」は`status`を`MANY`に戻すだけ。
- **ReplacementItem** — 浄水器カートリッジなど、日数で交換時期を管理する品目。次回交換予定日は列として持たず、`lastReplacedAt + intervalDays`から毎回計算する（`src/lib/replacement.ts`）。一覧の「交換した」ボタンは`lastReplacedAt`を今日の日付に更新するだけ。
- **ReplacementLogEntry** — 交換した記録。押すたびに1行追記される（編集画面の「交換履歴」に表示）。
- **PushSubscription** — 通知を有効にした端末ごとのWeb Push購読情報（端末=ブラウザ単位）。「通知を有効にする」を押した時点のログインユーザーに紐づく。

詳細は [`prisma/schema.prisma`](./prisma/schema.prisma) を参照してください。

## デプロイ手順（Vercel）

このアプリはデータベースを使うため、静的ホスティング（GitHub Pagesなど）では動きません。Vercelなら無料枠でそのまま動かせます。

### 1. Vercelにプロジェクトを作る

1. [vercel.com](https://vercel.com) に GitHub アカウントでログイン
2. 「Add New…」→「Project」からこのリポジトリを選ぶ
3. **Root Directory に `consumables-tracker` を指定**（リポジトリ直下ではありません）
4. まだ Deploy は押さずに、次の手順でデータベースを用意します

### 2. データベースをつなぐ

1. Vercelのプロジェクト画面で「Storage」タブを開く
2. Postgres（Neon など）を選んで作成する
3. 作成したデータベースをこのプロジェクトに接続する

接続すると `DATABASE_URL` が環境変数として自動で設定されます。手動で設定する場合は、Settings → Environment Variables に以下を追加してください。

| 変数名 | 値 |
| --- | --- |
| `DATABASE_URL` | `postgresql://ユーザー:パスワード@ホスト/データベース?sslmode=require` |

> サーバーレス環境から接続するため、**プーリング対応の接続文字列**（Neonなら `-pooler` が付いたホスト）を使ってください。

### 3. デプロイする

「Deploy」を押すと、ビルド時に自動で以下が実行されます。

- `prisma generate` — DBクライアントの生成（`postinstall`）
- `prisma migrate deploy` — テーブルの作成（`build`）
- `next build` — アプリのビルド

完了すると `https://〇〇.vercel.app` のようなURLが発行されます。そのURLを一緒に使う人に共有すれば、二人とも同じデータを見られます。

### 4. プッシュ通知を使う場合（任意）

通知機能を使わない場合はこの手順は不要です（通知ボタンが自動的に非表示になります）。使う場合は、以下の環境変数をVercelの Settings → Environment Variables に追加してください。

| 変数名 | 値 |
| --- | --- |
| `VAPID_PUBLIC_KEY` | Web Push用の公開鍵 |
| `VAPID_PRIVATE_KEY` | Web Push用の秘密鍵 |
| `CRON_SECRET` | 定期交換品チェック用cronの認証に使うランダムな文字列 |

`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` は以下のコマンドで生成できます。

```bash
npx web-push generate-vapid-keys
```

追加後に再度Deployすると、定期交換品を毎日チェックするcron（`vercel.json`、Vercel Hobbyプランの上限である1日1回で設定）が有効になり、ホーム画面に「通知を有効にする」ボタンが表示されるようになります。

> iPhoneでは、Safariで普通に開いただけでは通知を受け取れません。「ホーム画面に追加」したアプリとして開き、そこで通知を許可する必要があります（iOS 16.4以降で対応）。

## ローカルで動かす

PostgreSQLが必要です。

```bash
cd consumables-tracker
npm install
cp .env.example .env     # DATABASE_URL を自分の環境に合わせて書き換える
npx prisma migrate dev   # テーブルを作成
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いてください。

## 技術構成

- Next.js 16（App Router / Server Actions）+ TypeScript
- PostgreSQL + Prisma 7（`@prisma/adapter-pg`）
- Tailwind CSS（モバイル操作優先のUI・セーフエリア対応）
- 本人確認はCookieのみ（パスワードもセッションサーバーも持ちません）

```
src/
  app/
    welcome/                 誰ですか画面（名前の選択・入力）
    page.tsx                 品目一覧＋買い物リスト（メイン画面）
    items/new                品目の追加
    items/[id]/edit          品目の編集・削除・更新履歴
    replacements             定期交換品の一覧
    replacements/new         定期交換品の追加
    replacements/[id]/edit   定期交換品の編集・削除・交換履歴
    api/cron/check-replacements  定期交換品の毎日チェック(Vercel Cronから呼ばれる)
  actions/    Server Actions（本人確認・品目のCRUD・残量更新・定期交換品のCRUD・通知購読の保存）
  lib/        DBクライアント、残量/交換時期ステータスの表示定義、Web Push送信、バリデーションなど
  components/ 一覧カード・買い物リスト・カテゴリフィルタ・通知ボタンなどのUI部品
public/sw.js                 プッシュ通知を受け取るService Worker
vercel.json                  定期交換品チェックcronのスケジュール設定
prisma/schema.prisma        データ定義
```

## セキュリティについて

URLを知っている人は誰でも名前を登録して使えます。パスワード認証は行っていないため、社外に漏れて困る情報を扱う用途には向きません。

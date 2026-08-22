# TaskCircle(タスクサークル)

グループで使うiOS向けのタスク管理Webアプリです。Next.js(App Router)+ Prisma(SQLite)で実装しています。

## できること

- **グループ参加コード**: グループを作成すると6桁の参加コードが発行され、コードを入力するだけで他のメンバーが参加できます(Setlogのようなイメージ)。
- **公開範囲の選択**: タスクごとに「自分のみ」か「グループ全員に公開」かを選べます。あとから切り替えることもできます。
- **承認依頼(タスクを投げる)**: 自分のタスクを、同じグループの別のメンバーに承認依頼として送れます。依頼されたメンバーはアプリ内通知で気づき、承認/却下できます。承認するとそのメンバーが担当者になります。
- **Teams通知連携**: プロフィール設定で個人のMicrosoft Teams Webhook URLを登録しておくと、承認依頼や承認/却下の結果がTeamsにも通知されます。
- **重複タスクの検知**: タスク追加時にタイトルを入力すると、グループ内の他のメンバーが同じようなタスクに取り組んでいないかをリアルタイムでチェックし、「◯◯さんも同じようなタスクに取り組んでいます」と表示します。タスク一覧でも、複数人が同時に取り組んでいるタスクにはバッジが付きます。

## 技術構成

- Next.js 16(App Router / Server Actions)+ TypeScript
- Prisma 7 + SQLite(`@prisma/adapter-better-sqlite3`)
- NextAuth v5(Credentials認証 + JWTセッション)
- Tailwind CSS(iOS風のUI、ボトムタブバー、セーフエリア対応)
- PWA対応(`manifest.json` / apple-touch-icon)。iOS SafariからホームDに追加すればアプリのように使えます。

## ディレクトリ構成

```
src/
  app/
    (auth)/login, register        ログイン・新規登録
    (app)/groups                  グループ一覧・作成・参加
    (app)/groups/[groupId]        グループのタスク一覧(みんなのタスク / 自分のタスク)
    (app)/groups/[groupId]/tasks  タスク作成・詳細(承認依頼・ステータス変更)
    (app)/groups/[groupId]/members  メンバー一覧・参加コード
    (app)/notifications            通知一覧
    (app)/settings                 プロフィール・Teams Webhook設定
  actions/     Server Actions(認証・グループ・タスク・依頼・通知・プロフィール)
  components/  UIコンポーネント
  lib/         Prismaクライアント、類似度判定、Teams通知、バリデーションなど
prisma/schema.prisma  データモデル定義
```

## セットアップ

```bash
npm install
cp .env.example .env   # AUTH_SECRET を生成して設定してください (例: openssl rand -base64 32)
npx prisma migrate dev
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いてください。

## Teams通知の設定方法

1. 通知を受け取りたいTeamsのチャンネルで「ワークフロー」→「Webhook要求を受信したときに投稿する」を追加します。
2. 発行されたWebhook URLをアプリの「設定」画面の「Teams Webhook URL」に貼り付けて保存します。
3. 以降、自分宛てにタスクの承認依頼が届いたとき・自分が送った依頼が承認/却下されたときにTeamsへ通知が届きます。

## 重複タスク検知の仕組み

タイトルを正規化(全角/半角・記号・空白の統一)した上でLevenshtein距離ベースの類似度を計算し、しきい値以上、または一方が他方を包含する場合に「同じタスク」とみなしています(`src/lib/similarity.ts`)。判定対象は同じグループ内で「グループ公開」に設定されている未完了タスクのみで、プライバシー設定(自分のみ)のタスクは比較対象に含めません。

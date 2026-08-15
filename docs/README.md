# わりかん家計簿（共有版・Web）

`docs/index.html` は、2人でリアルタイムにデータを共有できる Web 版アプリです。
[WarikanKakeibo](../WarikanKakeibo)（iOSネイティブ版）と同じ「5パターンの負担割合」
「クレカ締め日ごとの集計」というロジックを、ブラウザだけで動く1ファイルの
アプリとして実装しています。

データの保存・同期には [Firebase Firestore](https://firebase.google.com/) を使います。
ログイン機能はなく、代わりにランダムな「世帯コード」を知っている人だけが
同じデータを読み書きできる、という仕組みです（`firestore.rules` 参照）。

## セットアップ手順

### 1. Firebaseプロジェクトを作る

1. https://console.firebase.google.com/ を開き、Googleアカウントでログイン
2. 「プロジェクトを作成」→ 好きな名前（例: `warikan-kakeibo`）を入力
   → Googleアナリティクスは「このプロジェクトでは有効にしない」でOK → 作成

### 2. Firestore Databaseを有効にする

1. 左メニュー「構築」→「Firestore Database」→「データベースの作成」
2. ロケーションは `asia-northeast1`（東京）を選択 → 本番環境モードで開始
3. 作成後、上部の「ルール」タブを開き、このリポジトリの
   [`docs/firestore.rules`](./firestore.rules) の内容を貼り付けて「公開」

### 3. Webアプリを登録し、設定値を取得する

1. 左上の歯車アイコン →「プロジェクトの設定」
2. 下にスクロールして「マイアプリ」→ `</>`（ウェブ）アイコンをクリック
3. アプリのニックネームを適当に入力して「アプリを登録」
   （Firebase Hostingの設定は使わないのでスキップでOK）
4. 表示される次のような設定値をコピーする:
   ```js
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

### 4. `docs/index.html` に設定値を埋め込む

`docs/index.html` 内で `__FIREBASE_API_KEY__` のように `__..._​_` で囲まれた
プレースホルダーを、手順3で取得した実際の値に置き換えてコミットします。
（この値は公開されても問題ありません。アクセス制御は Firestore のルール側で行います。）

### 5. GitHub Pagesを有効にする

1. このリポジトリの Settings → Pages を開く
2. 「Source」を「Deploy from a branch」にし、ブランチとフォルダで
   このアプリがあるブランチと `/docs` を選択して Save
3. 数分待つと `https://<owner>.github.io/<repo>/` でアプリが公開されます

## 使い方（利用者向け）

1. 上記のURLをiPhoneのSafariで開く
2. 「新しく世帯を作る」を押すとコードが発行されるので、もう1人に伝える
3. もう1人は「招待されたコードを入力」でそのコードを入力して参加
4. 以降、どちらの端末で入力してもリアルタイムでもう片方に反映されます
5. Safariの共有ボタン →「ホーム画面に追加」しておくとアプリのように使えます

## 制限事項

- ログイン認証はありません。URLと世帯コードの両方を知っている人は誰でも
  読み書きできます（Googleドキュメントの共同編集リンクに近い考え方です）。
- Firestoreの無料枠（Sparkプラン）は2人の個人利用であれば十分な範囲に収まります。

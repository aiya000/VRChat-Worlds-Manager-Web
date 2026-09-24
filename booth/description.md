# BOOTH 商品ページ

BOOTH の商品編集画面に、そのまま貼り付ける文面です。
BOOTH の説明文は Markdown として表示されないので、見出しは【】で書いています。
英語の説明は、日本語のあとに続けて置きます。

## 商品名

VRChat Worlds Manager Web（VRCWW）｜お気に入りワールド整理ツール【無料・ブラウザで動作】

## 価格

0 円

## 配布ファイル

- `vrcww-guide-ja.pdf`（導入手順・日本語）
- `vrcww-guide-en.pdf`（Getting started・English）

どちらも `bun run booth:pdf` で `booth/dist/` に書き出したものです。

## 説明文

（ブロックごとに段落を追加する）

（商品紹介文）

```
VRChat のお気に入りワールドを、フォルダで整理できる Web アプリです！

ブラウザで開くだけで

PC でも
スマートフォンでも
VR のオーバーレイからでも…！！
どこからでも使えます！

▼ アプリはこちら（無料）
https://vrcww.com

▼ はじめての方へ（使い方）
https://vrcww.com/guide

※
このアプリはブラウザで動く Web アプリです。ダウンロードするファイルは導入手順の PDF です。
アプリ本体ではありません。
迷う方用にPDFを作成しておりますが、案内が必要なければすぐに https://vrcww.com にアクセスしていただけます。
```

【ご利用の前に】

```
・このアプリは、有志が個人で開発している非公式のツールです。VRChat Inc. とは関係ありません。
・お気に入りワールドを読み込むために、VRChat のアカウントでログインします。
　ユーザー名、パスワード、認証コードは VRChat の公式 API との通信にだけ使い、保存はしません。
　くわしくはプライバシーポリシーをご覧ください: https://vrcww.com/privacy
・ワールドやフォルダのデータは、お使いのブラウザの中に保存されます。
・ソースコードは GitHub で公開しています: https://github.com/aiya000/VRChat-Worlds-Manager-Web
```

【できること】

```
・VRChat のお気に入りワールドを取り込んで、VRChat 側の枠に縛られずに残せます
・自分で作ったフォルダに整理できます（1 つのワールドを複数のフォルダに入れられます）
・名前、作者、タグ、フォルダで、手元のワールドをすぐに探せます
・VRChat のワールドを検索して、見つけたものをそのままフォルダに入れられます
・アプリからインスタンスを作って、届いた招待からそのワールドへ入れます
・ホーム画面やデスクトップに追加して、ふつうのアプリのように開けます
・Google Drive に接続すると、複数の端末で同じデータを使えます（任意）
```

【VR の中で使う】

```
PC のブラウザでこのアプリを開き、そのウィンドウを XSOverlay などで VR 空間に映す使い方がおすすめです。
ヘッドセットを外さずに、フォルダを見て、次のワールドへそのまま移動できます。
```

【AndroidのVRChatアプリと使う】

```
Androidのフローティングウィンドウ（Galaxy端末では「ポップアップ表示」）を使うことで、デスクトップ環境のVRChatアプリと同じように、自己招待でのワールド遷移をすることができます。
```

【困ったときは】

```
不具合の報告や質問は、GitHub の Issues か Discord で受け付けています。
・GitHub Issues: https://github.com/aiya000/VRChat-Worlds-Manager-Web/issues
・Discord: https://discord.gg/g5nq5GuGPJ
```

【Special Thanks】

```
・オリジナルアプリ: VRC Worlds Manager v2（https://github.com/Raifa21/VRC-Worlds-Manager-v2） by Raifa & siloneco
・VRChat および VRChat API コミュニティの皆様、API ドキュメントの提供に感謝します。
・旧サイドバーアイコンは、黒音キト様より CC-BY-NC-4.0 ライセンスで提供されていました。現在は未使用です。
・旧アプリケーションアイコンは Ciel-chan を使用していました。ArmoireLepus 様の許可を得ています。現在は未使用です。
皆様、ありがとうございます。
```

【English】

```
―――――――――――――――――――――

VRChat Worlds Manager Web (VRCWW) is a web app for organising your VRChat favorite worlds into folders.
It runs in your browser, on a PC, on a phone, or in a VR overlay.

▼ Open the app (free)
https://vrcww.com

▼ Getting started
https://vrcww.com/guide

* This is a web app that runs in your browser. The downloadable files are getting-started PDFs, not the app itself.

[What it does]
- Keeps your VRChat favorite worlds, beyond the limits of VRChat's own favorite slots
- Sorts them into your own folders (a world can be in more than one)
- Finds worlds quickly by name, author, tag, or folder
- Searches VRChat's worlds and adds what you find straight into a folder
- Creates an instance from the app, and takes you there through the invite you receive
- Can be added to your home screen or desktop and opened like any other app
- Syncs the same data across devices through Google Drive (optional)

[Using it in VR]
We recommend opening the app in a desktop browser and showing that window in VR with XSOverlay or a similar overlay.

[Before you start]
- This is an unofficial tool built by an independent developer, and is not affiliated with VRChat Inc.
- It signs in with your VRChat account to read your favorite worlds.
  Your username, password and authentication codes are used only to talk to VRChat's official API, and are never stored.
  Privacy policy: https://vrcww.com/privacy
- Your worlds and folders are kept inside the browser you use.
- Source code: https://github.com/aiya000/VRChat-Worlds-Manager-Web

[Need help?]
- GitHub Issues: https://github.com/aiya000/VRChat-Worlds-Manager-Web/issues
- Discord: https://discord.gg/g5nq5GuGPJ

[Special Thanks]
- Original app: VRC Worlds Manager v2 (https://github.com/Raifa21/VRC-Worlds-Manager-v2) by Raifa & siloneco
- The VRChat and VRChat API community, for the API documentation
- The former sidebar icon was provided by 黒音キト under CC-BY-NC-4.0. It is no longer used.
- The former application icon was Ciel-chan, used with permission from ArmoireLepus. It is no longer used.
Thank you all.
```

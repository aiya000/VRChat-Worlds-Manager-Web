<div align="center">

# VRChat Worlds Manager Web (VRCWW)

\- **[bɯi aːɾɯ ɕiː waɾawaɾa]** \-

[![Tests](https://github.com/aiya000/VRC-Worlds-Manager-Web/actions/workflows/test.yml/badge.svg)](https://github.com/aiya000/VRC-Worlds-Manager-Web/actions/workflows/test.yml)
[![Web App](https://img.shields.io/badge/Web%20App-vrchat--worlds--manager--web.pages.dev-blue?logo=cloudflarepages)](https://vrchat-worlds-manager-web.pages.dev)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)

[English README is here / 英語のREADMEはこちら。](./README.md)

</div>

**VRChat Worlds Manager Web (VRCWW)** は、好きなワールドを簡単に整理・保存するためのVRChat向けプログレッシブウェブアプリ（PWA）です。オリジナルのデスクトップアプリ [VRC Worlds Manager v2](https://github.com/Raifa21/VRC-Worlds-Manager-v2) をベースに、PCブラウザ・スマートフォン・VRオーバーレイ（XSOverlay等）からシームレスに利用できるようWebアプリとして再構築されています。

🌐 **公開Webアプリ**: [https://vrchat-worlds-manager-web.pages.dev](https://vrchat-worlds-manager-web.pages.dev)

---

## 機能

- **Web & PWA 対応（VR-first / レスポンシブ設計）**
  - PC、スマートフォン、VRオーバーレイ（XSOverlay、SteamVRブラウザ、Questブラウザなど）のあらゆる環境で動作します。
  - 折りたたみ式サイドバー（モバイル時はドロワー化）やレーザーポインタ・タッチ操作に最適化したUI設計。
  - PWA（Progressive Web Apps）としてホーム画面やデスクトップにインストール可能です。
  - オリジナル版のVRC Worlds Manager v2と同様に、デスクトップアプリとしてお使いいただけます。
  - デスクトップアプリで編集した内容（お気に入りの追加・フォルダ分けなど）をスマートフォンや他のPCと同期ができます。データの復元・インポートなしに共通で扱うことができます

- **お気に入りワールドの追加と永続保存**
  - VRChat APIを使用して、お気に入り（Favorites）に入っているワールドを自動取得し、アプリ内に保存します。
  - VRChat側のお気に入り枠から削除したり枠が上限に達しても、アプリ側には永続して残ります。
  - ワールドURLを直接入力して追加することも可能です。

- **ワールドのフォルダ分けと表示カスタマイズ**
  - 保存されたワールドをフォルダ分けできます（同じワールドを複数のフォルダに所属させることも可能）。
  - ワールドカードの表示項目トグル機能（作者名や説明、タグなどの表示/非表示を個別に設定可能）。
  - ワールドごとにメモをつけることができます。

- **マルチアカウント連携とお気に入り整理ツール**
  - 別アカウントのVRChatお気に入りワールドをフォルダへインポートできます。
  - アカウント内のVRChatお気に入りを一括パージ（全削除）するメンテナンス機能を搭載。

- **検索と発見**
  - ワールド名、作者名、タグ、フォルダでの高速なローカル検索に対応。
  - 最近訪れたワールド履歴の取得。
  - タグ・キーワード・除外タグによるVRChatパブリックワールド検索。

- **インスタンスの作成**
  - アプリ内からインスタンス（グループインスタンス含む）を生成できます。VRChat公式サイトと同様に、起動中のクライアントへインバイトが届きます。

- **フォルダの共有**
  - フォルダを共有し、30日間有効なURL（UUID）を生成できます。
  - Web上でフォルダをそのまま閲覧できます。

- **安心のクライアントサイド保管**
  - ワールドデータや認証セッションはブラウザのローカルストレージ（IndexedDB / Dexie.js）に安全に保存されます。
  - 通信はCloudflare Worker（CORSプロキシ）を介して公式VRChat APIと安全に行われます。

---

## スクリーンショット

### PCで、VRChatと並べて使う

VRChatとアプリを別のウィンドウで並べておくと、いまいるワールドを離れずに自分のワールドへ手が届きます。

ワールドを選ぶとインスタンスができて自分あてに招待が届き、VRChatの通知からそのワールドへ入ります。
公式サイトの「ワールドを起動」と同じ流れです。

|                                                                      |                                                                        |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| ![VRChatと並べたアプリ](docs/screenshots/pc-1-app-beside-vrchat.jpg) | ![インスタンスの選択](docs/screenshots/pc-2-choosing-the-instance.jpg) |
| **1.** ワールドにいるあいだ、アプリは隣に並んでいます                | **2.** 誰向けか、どの地域かを選ぶと、招待が送られます                  |
| ![VRChatに届いた招待](docs/screenshots/pc-3-invite-appears.jpg)      | ![ワールドへ移動中](docs/screenshots/pc-4-traveling.jpg)               |
| **3.** VRChat側に、招待が届いたことが出ます                          | **4.** 受けると、そのワールドへ移動します                              |
| ![接続中](docs/screenshots/pc-5-connecting.jpg)                      | ![ワールドに到着](docs/screenshots/pc-6-arrived.jpg)                   |
| **5.** 接続しています                                                | **6.** 到着。アプリはそのまま隣に残っています                          |

### Androidで、VRChatと一緒に使う

端末のフローティングウィンドウ機能でゲームの上に浮かべておくと、いまいるワールドを離れずにアプリへ手が届きます。
呼び名は機種によって違います（Galaxy端末なら「ポップアップ表示」）。

ワールドを選ぶと自分あてに招待が届き、VRChatの通知からそのワールドへ入ります。
Androidでは、リンクからインスタンスへ直接入る方法がないため、この経路になります。

|                                                                                      |                                                                                  |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| ![バブルとして待機しているアプリ](docs/screenshots/android-1-bubble-over-vrchat.jpg) | ![VRChatの上で開いたアプリ](docs/screenshots/android-2-app-open-over-vrchat.jpg) |
| **1.** ワールドにいるあいだ、アプリは端で待っています                                | **2.** 開くと、ゲームの上に自分のワールドが並びます                              |
| ![インスタンスの選択](docs/screenshots/android-3-choosing-the-instance.jpg)          | ![招待を送ったところ](docs/screenshots/android-4-invite-sent.jpg)                |
| **3.** 誰向けか、どの地域かを選びます                                                | **4.** インスタンスができて、自分あてに招待が届きます                            |
| ![VRChatに届いた招待](docs/screenshots/android-5-invite-appears.jpg)                 | ![通知に残っている招待](docs/screenshots/android-6-invite-in-notifications.jpg)  |
| **5.** VRChat側に、招待が届いたことが出ます                                          | **6.** 通知のなかで待っています                                                  |
| ![ワールドへ移動中](docs/screenshots/android-7-traveling.jpg)                        | ![ワールドに到着](docs/screenshots/android-8-arrived.jpg)                        |
| **7.** 受けると、そのワールドへ移動します                                            | **8.** 到着。アプリはそのまま端に残っています                                    |

> スクリーンショットは追加予定です。VRオーバーレイの中。

---

## 技術スタック

- **フロントエンド**: Next.js 16 + React 19 + Tailwind CSS 4 + Shadcn/UI
- **サービスレイヤー**: Effect-TS
- **データストレージ**: IndexedDB (Dexie.js) + localStorage
- **APIプロキシ**: Cloudflare Worker (CORSプロキシ、2FA・セッションリレー・レート制限対応)
- **パッケージマネージャー**: Bun
- **デプロイ**: Cloudflare Pages (Static Export) & Cloudflare Workers

---

## 開発とセットアップ

### 前提条件

- [Bun](https://bun.sh/) (v1.2以上)

### 開発コマンド

```bash
# 依存関係のインストール
bun install

# 開発サーバーの起動
bun run dev

# コード品質チェック（Prettier, ESLint, TypeCheck）
bun run check

# 単体・統合テストの実行
bun run test

# E2Eテストの実行（Playwright）
bun run test:e2e

# プロダクションビルド
bun run build
```

---

## コントリビュート

貢献は大歓迎です！
ガイドラインは [CONTRIBUTING.md](CONTRIBUTING.md) をご覧ください。

---

## ライセンス

本プロジェクトはMITライセンスです。詳細は [LICENSE](LICENSE) ファイルをご覧ください。

一部のコンポーネントは [CC-BY-NC-4.0](https://creativecommons.org/licenses/by-nc/4.0/) ライセンスで提供されており、非営利目的でのみ使用できます。詳細は [LICENSE_ADDITIONAL](LICENSE_ADDITIONAL) ファイルをご覧ください。

---

## クレジット

- オリジナルアプリ: [VRC Worlds Manager v2](https://github.com/Raifa21/VRC-Worlds-Manager-v2) by Raifa & siloneco
- VRChatおよびVRChat APIコミュニティの皆様、APIドキュメントの提供に感謝します。
- サイドバーアイコンは黒音キト様よりCC-BY-NC-4.0ライセンスで提供されています。
- 旧アプリケーションアイコンはCiel-chanを使用。ArmoireLepus様の許可を得ています。ただし現在は未使用。スペシャルサンクスとして、ここに情報を残させて頂いています。
- 皆様、ありがとうございます。

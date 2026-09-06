# VRChat Worlds Manager Web (VRCWW)

[![Tests](https://github.com/aiya000/VRC-Worlds-Manager-Web/actions/workflows/test.yml/badge.svg)](https://github.com/aiya000/VRC-Worlds-Manager-Web/actions/workflows/test.yml)
[![Web App](https://img.shields.io/badge/Web%20App-vrchat--worlds--manager--web.pages.dev-blue?logo=cloudflarepages)](https://vrchat-worlds-manager-web.pages.dev)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)

[English README is here / 英語のREADMEはこちら。](./README.md)

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
- アプリケーションアイコンはCiel-chanを使用、ArmoireLepus様の許可を得ています。

# Offline Cards 🃏 (オフラインカード)

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

**Offline Cards** は、対面でのローカルエリアネットワーク (LAN) ゲームにおいて、物理的なトランプの代わりとなる、完全オフラインかつサーバーレスのクロスプラットフォームアプリケーション（Web および Android 対応）です。

## コアコンセプト

このアプリケーションは、中央集権型のバックエンドサーバーや WebSockets の使用を**一切禁止**しています。すべてのゲームデータは、ローカルネットワーク上の WebRTC (`RTCDataChannel`) を介して、デバイス間で直接送受信されます。

これは**マニュアルシグナリング (Manual Signaling)** を使用して実現されます。つまり、圧縮された WebRTC Session Description Protocol (SDP) 文字列を、QR コードとカメラを通じてデバイス間で交換します。

## 現在の進捗状況

**開発フェーズ: アクティブ開発 (ゲームエンジンと UI の統合)**

*   **プラットフォーム対応:** Expo / React Native へ完全に移行し、**Web (PWA)** および **Android ネイティブ** ビルドの両方をサポートしています。
*   **コアシグナリング:** 完了。WebRTC データチャネルと QR コードを使用したシームレスな P2P 接続。
*   **ゲームエンジン:** 状態管理と同期のための `boardgame.io` を統合。
*   **実装済みのゲームモード:**
    *   **UnoLite:** Uno (ウノ) の簡略版。
    *   **争上遊 (ZhengShangYou):** クラシックなカードゲーム。
*   **UI/UX:**
    *   React Native の Animated と PanResponder を使った、スムーズなドラッグ＆ドロップカード操作。
    *   **複数カードの同期ドラッグ**アニメーションに対応。
    *   完全な多言語化 (i18n) サポート (英語、中国語、日本語)。
*   **APIと拡張性:** `boardgame.io` のセットアップにより、将来的に新しいカードゲームを簡単に追加することができます。

## テクノロジースタック

*   **フレームワーク:** Web と Android ネイティブを対象とした Expo (React Native)
*   **ゲームエンジン:** `boardgame.io`
*   **ネットワーク:** ネイティブ `RTCPeerConnection` および `RTCDataChannel`
    *   純粋な LAN 動作を保証し STUN/TURN サーバーを回避するため、`iceServers` は明示的に空 (`[]`) に設定されています。
*   **シグナリング圧縮:** `lz-string`
*   **QR コード:** `react-qr-code` & `expo-camera` (ネイティブ用) / `html5-qrcode` (Web 用)
*   **デプロイ:** GitHub Pages (Web) & EAS Build (Android)

## ローカル開発セットアップ

1.  **依存関係のインストール:**
    ```bash
    npm install
    # Expo およびネイティブモジュール用
    npx expo install
    ```

2.  **Expo 開発サーバーの起動:**
    ```bash
    npm start
    # または npm run web (Web ブラウザでのテスト用)
    # または npm run android (Android エミュレータ/デバイスでの起動用)
    ```

3.  **Android APK のビルド:**
    ```bash
    npm run build:android:preview
    ```

## 新しいゲームの追加と拡張

新しいゲームを追加するには：
1. `src/game-modules/YourGame.ts` に新しいモジュールを作成し、`boardgame.io` のゲームオブジェクトを定義します。
2. エンジンは汎用的な `GameBoard` コンポーネント (`src/components/GameBoard.tsx`) を使用しており、これを再利用または拡張して新しいゲームのカードやインタラクションをレンダリングできます。
3. `App.tsx` 内で新しいゲームの流れを統合します。

## ブループリント

詳細なアーキテクチャの決定、ステートマシンロジック、および過去の開発フェーズについては、[BLUEPRINT.md](./BLUEPRINT.md) を参照してください。

[English](./README.md) | [简体中文](./README_zh.md) | [日本語](./README_ja.md)

# Offline Cards

**Offline Cards** は、物理的なトランプカードの代わりに、対面のローカルエリアネットワーク (LAN) で遊べる純粋なオフラインのサーバーレスプログレッシブウェブアプリケーション (PWA) です。

## コア哲学

このアプリケーションでは、中央集権型のバックエンドサーバーや WebSockets の使用を**厳格に禁止**しています。すべてのゲームデータは、ローカルネットワーク上の2台のデバイスのブラウザ間で WebRTC (`RTCDataChannel`) を通じて直接送信されます。

これは**マニュアルシグナリング**を使用して実現されています。デバイス間でカメラを用いたQRコードのスキャンと、`quiet.js` を利用した超音波音声通信によって、圧縮された WebRTC Session Description Protocol (SDP) 文字列を交換します。

## 技術スタック

*   **フレームワーク:** Expo (React Native for Web)
*   **ネットワーキング:** ネイティブブラウザの `RTCPeerConnection` と `RTCDataChannel`
    *   純粋なLAN操作を確実にするため、`iceServers` は明示的に `[]` に設定されています。
*   **シグナリングとハンドシェイク:**
    *   `lz-string` (QRコードを小さくするため、SDPをURLセーフな文字列に圧縮)
    *   `react-qr-code` (生成) & `html5-qrcode` / `expo-camera` (スキャン)
    *   `quiet.js` (オフラインハンドシェイクのための超音波音声通信)
*   **ゲームエンジン:** `boardgame.io` (純粋なクライアントサイドのステートマシン処理。厳密なオフラインメカニクスを適用)
*   **国際化 (i18n):** `i18next` と `react-i18next` (英語、簡体字中国語、日本語に対応)
*   **デプロイメント:** GitHub Pages (`gh-pages`)

## 現在のステータス: フェーズ 1 (コア通信リンク)

現在、アプリケーションは基礎的な WebRTC シグナリングフローとシンプルなテキストベースのチャットをサポートしています。カードUIやゲームエンジンのロジックはまだ実装されていません。

### 動作原理 (ハンドシェイクフロー):
1.  **ホスト** がルームを作成し、Offer を生成し、ICE 収集を待機した後、それを圧縮し、QRコードと `quiet.js` の超音波の両方で同時にブロードキャストします。
2.  **ゲスト** が Offer を受け取り（ホストのQRコードをスキャンするか超音波を傍受して）、Offer を解凍して Answer を生成します。ICE 収集を待機後、圧縮し、自身の応答をQRコードと超音波でブロードキャストします。
3.  **ホスト** がゲストの Answer を受信します。
4.  **接続確立！** デバイスは純粋な P2P WebRTC を介して直接通信できるようになります。

## ローカル開発環境のセットアップ

1.  **依存関係のインストール:**
    ```bash
    npm install
    # ネットワーク制限によりローカルキャッシュを使用する場合:
    # npm install --prefer-offline --no-audit
    ```

2.  **Expo 開発サーバーの起動 (Web のみ):**
    ```bash
    npx expo start --web
    ```
    *アプリは `http://localhost:8081` で実行されます。*

3.  **ローカルビルド / サンドボックステスト:**
    デプロイ前にローカルでコンパイルを確認します。
    ```bash
    npx tsc --noEmit
    npx expo export -p web
    ```
    *フロントエンドの検証にサンドボックスモードを使用する場合は、メイン画面の「ローカルサンドボックスに入室」ボタンを探してください。*

## デプロイメント

このアプリケーションは GitHub Pages へのデプロイが簡単にできるよう設定されています。（Metro バンドラーの資産の動的キャッシュのための Service Worker の適切な構成など、PWAの要件に従ってデプロイ構成が一致していることを確認してください）。

1.  `package.json` 内の `homepage` URL を GitHub Pages のURL (例: `https://<username>.github.io/<repo-name>`) に更新します。同時に `app.json` 内の `experiments.baseUrl` がサブパスと一致することを確認してください。
2.  デプロイスクリプトの実行:
    ```bash
    npm run deploy
    # または GitHub Actions を利用します (main ブランチへの push 時に自動的にビルドされ、dist ディレクトリが gh-pages ブランチにプッシュされます)。
    ```

## ブループリント

詳細なアーキテクチャの決定、ステートマシンのロジック、および今後の開発フェーズについては、[BLUEPRINT.md](./BLUEPRINT.md) を参照してください。

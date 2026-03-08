[English](./README.md) | [简体中文](./README_zh.md) | [日本語](./README_ja.md)

# Offline Cards

**Offline Cards** is a pure offline, serverless Progressive Web Application (PWA) designed to replace physical playing cards for face-to-face local area network (LAN) gaming.

## Core Philosophy

This application **strictly forbids** the use of any centralized backend servers or WebSockets. All game data is transmitted directly between two devices' browsers via WebRTC (`RTCDataChannel`) over a local network.

This is achieved using **Manual Signaling**: devices exchange compressed WebRTC Session Description Protocol (SDP) strings via QR codes and device cameras, as well as Ultrasonic audio transmission using `quiet.js`.

## Technology Stack

*   **Framework:** Expo (React Native for Web)
*   **Networking:** Native Browser `RTCPeerConnection` and `RTCDataChannel`
    *   `iceServers` are explicitly set to `[]` to ensure pure LAN operation.
*   **Signaling & Handshake:**
    *   `lz-string` (Compresses SDPs into URL-safe strings for smaller QR codes)
    *   `react-qr-code` (Generation) & `html5-qrcode` / `expo-camera` (Scanning)
    *   `quiet.js` (Ultrasonic audio transmission for offline handshake)
*   **Game Engine:** `boardgame.io` (Pure client-side state machine handling, enforcing strictly offline mechanics)
*   **Internationalization (i18n):** `i18next` and `react-i18next` (Supports English, Simplified Chinese, and Japanese)
*   **Deployment:** GitHub Pages (`gh-pages`)

## Current Status: Phase 1 (Core Communication Link)

Currently, the application supports the foundational WebRTC signaling flow and simple text-based chat. No card UI or game engine logic is implemented yet.

### How it works (The Handshake):
1.  **Host** creates a room, generates an Offer, waits for ICE gathering, compresses it, and broadcasts it simultaneously via a QR Code and `quiet.js` ultrasonic audio.
2.  **Guest** receives the Offer (either by scanning the Host's QR Code or listening via ultrasonic audio), decompresses the Offer, generates an Answer, waits for ICE gathering, compresses it, and broadcasts their own response via QR Code and ultrasonic audio.
3.  **Host** receives the Guest's Answer.
4.  **Connection Established!** Devices can now communicate directly via pure P2P WebRTC.

## Local Development Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    # If using local node_modules due to network constraints:
    # npm install --prefer-offline --no-audit
    ```

2.  **Start the Expo Development Server (Web Only):**
    ```bash
    npx expo start --web
    ```
    *The app will be available at `http://localhost:8081`.*

3.  **Local Build / Sandbox Testing:**
    Verify compilation locally before deploying.
    ```bash
    npx tsc --noEmit
    npx expo export -p web
    ```
    *If you want to use the Sandbox mode for frontend verification, look for "ENTER LOCAL SANDBOX" on the main screen.*

## Deployment

This application is configured for easy deployment to GitHub Pages. Ensure your deployment configuration aligns with PWA requirements (such as correctly serving the Service Worker for dynamic caching of Metro bundler assets).

1.  Update the `homepage` URL in `package.json` to match your GitHub Pages URL (e.g., `https://<username>.github.io/<repo-name>`). Ensure `experiments.baseUrl` in `app.json` matches the subpath.
2.  Run the deploy script:
    ```bash
    npm run deploy
    # or rely on GitHub Actions which builds and pushes the dist directory to the gh-pages branch on pushes to main.
    ```

## Blueprint

For detailed architectural decisions, state machine logic, and future development phases, see the [BLUEPRINT.md](./BLUEPRINT.md).

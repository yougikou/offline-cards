# Offline Cards

**Offline Cards** is a pure offline, serverless Progressive Web Application (PWA) designed to replace physical playing cards for face-to-face local area network (LAN) gaming.

## Core Philosophy

This application **strictly forbids** the use of any centralized backend servers or WebSockets. All game data is transmitted directly between two devices' browsers via WebRTC (`RTCDataChannel`) over a local network.

This is achieved using **Manual Signaling**: devices exchange compressed WebRTC Session Description Protocol (SDP) strings via QR codes and device cameras.

## Technology Stack

*   **Framework:** Expo (React Native for Web)
*   **Networking:** Native Browser `RTCPeerConnection` and `RTCDataChannel`
    *   `iceServers` are explicitly set to `[]` to ensure pure LAN operation.
*   **Signaling Compression:** `lz-string` (Compresses SDPs into URL-safe strings for smaller QR codes)
*   **QR Code Handling:** `react-qr-code` (Generation) & `html5-qrcode` (Scanning)
*   **Deployment:** GitHub Pages (`gh-pages`)

## Current Status: Phase 1 (Core Communication Link)

Currently, the application supports the foundational WebRTC signaling flow and simple text-based chat. No card UI or game engine logic is implemented yet.

### How it works (The Handshake):
1.  **Host** creates a room, generates an Offer, waits for ICE gathering, compresses it, and displays a QR Code.
2.  **Guest** scans the Host's QR Code, decompresses the Offer, generates an Answer, waits for ICE gathering, compresses it, and displays their own QR Code.
3.  **Host** scans the Guest's QR Code.
4.  **Connection Established!** Devices can now communicate directly.

## Local Development Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    npx expo install react-native-web react-dom @expo/metro-runtime typescript @types/react
    ```

2.  **Start the Expo Development Server (Web Only):**
    ```bash
    npm run web
    ```
    *The app will be available at `http://localhost:8081`.*

## Deployment

This application is configured for easy deployment to GitHub Pages.

1.  Update the `homepage` URL in `package.json` to match your GitHub Pages URL (e.g., `https://<username>.github.io/<repo-name>`).
2.  Run the deploy script:
    ```bash
    npm run deploy
    ```
    *(This script automatically runs `npx expo export -p web` to build the app and pushes the `dist` directory to the `gh-pages` branch).*

## Blueprint

For detailed architectural decisions, state machine logic, and future development phases, see the [BLUEPRINT.md](./BLUEPRINT.md).

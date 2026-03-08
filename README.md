# Offline Cards 🃏

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

**Offline Cards** is a pure offline, serverless cross-platform application (Web & Android) designed to replace physical playing cards for face-to-face local area network (LAN) gaming.

## Core Philosophy

This application **strictly forbids** the use of any centralized backend servers or WebSockets. All game data is transmitted directly between devices via WebRTC (`RTCDataChannel`) over a local network (LAN-only).

This is achieved using **Manual Signaling**: devices exchange compressed WebRTC Session Description Protocol (SDP) strings via QR codes and device cameras.

## Current Progress & Status

**Phase: Active Development (Game Engine & UI Integration)**

*   **Platform Support:** Fully migrated to Expo/React Native, supporting both **Web (PWA)** and **Android Native** builds.
*   **Core Signaling:** Complete. Smooth peer-to-peer connection via QR codes using WebRTC data channels.
*   **Game Engine:** Integrated with `boardgame.io` for robust state management and synchronization.
*   **Game Modes implemented:**
    *   **UnoLite:** A streamlined version of Uno.
    *   **ZhengShangYou (ZSY):** A classic climbing card game.
*   **UI/UX:** 
    *   Smooth drag-and-drop card interactions using React Native Animated and PanResponder.
    *   **Multi-card dragging** support (just implemented!).
    *   Full Internationalization (i18n) support (English, Chinese, Japanese).
*   **APIs & Extensibility:** The `boardgame.io` setup allows for easy plug-and-play of new card games in the future.

## Technology Stack

*   **Framework:** Expo (React Native) targeting Web and Android Native
*   **Game Engine:** `boardgame.io`
*   **Networking:** Native `RTCPeerConnection` and `RTCDataChannel`
    *   `iceServers` are explicitly set to `[]` to ensure pure LAN operation without STUN/TURN servers.
*   **Signaling Compression:** `lz-string`
*   **QR Code:** `react-qr-code` & `expo-camera` (for Native) / `html5-qrcode` (for Web)
*   **Deployment:** GitHub Pages (Web) & EAS Build (Android)

## Local Development Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    # For Expo and native modules
    npx expo install
    ```

2.  **Start the Expo Development Server:**
    ```bash
    npm start
    # or npm run web (for web testing)
    # or npm run android (to run on Android emulator/device)
    ```

3.  **Build Android APK:**
    ```bash
    npm run build:android:preview
    ```

## Extending and Adding Games

To add a new game:
1. Create a new module in `src/game-modules/YourGame.ts` defining the `boardgame.io` game object.
2. The engine uses a generic `GameBoard` component (`src/components/GameBoard.tsx`) that you can extend or reuse to render your new game's cards and interactions.
3. Hook up the game flow in `App.tsx` matching the `Game` schema.

## Blueprint

For detailed architectural decisions, state machine logic, and past development phases, see the [BLUEPRINT.md](./BLUEPRINT.md).

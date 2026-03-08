# Offline Cards 🃏 (离线卡牌)

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

**Offline Cards** 是一款纯离线、无服务端的跨平台应用（支持 Web 和 Android），旨在替代实体扑克牌，用于面对面局域网 (LAN) 游戏。

## 核心理念

本应用**严格禁止**使用任何中心化后端服务器或 WebSockets。所有游戏数据完全通过局域网内的 WebRTC (`RTCDataChannel`) 直接在设备之间传输。

这通过**手动信令 (Manual Signaling)** 实现：设备通过二维码和设备的摄像头交换经过压缩的 WebRTC 会话描述协议 (SDP) 字符串。

## 当前进度和状态

**开发阶段：活跃开发（游戏引擎和 UI 整合）**

*   **平台支持:** 已全面迁移至 Expo / React Native，支持 **Web (PWA)** 和 **Android 原生** 构建。
*   **核心信令:** 已完成。通过二维码使用 WebRTC 数据通道实现流畅的点对点连接。
*   **游戏引擎:** 集成了 `boardgame.io`，用于强大的状态管理和同步。
*   **已实现的游戏模式:**
    *   **UnoLite:** 精简版 Uno。
    *   **争上游 (ZhengShangYou):** 经典扑克游戏。
*   **UI/UX:**
    *   基于 React Native Animated 和 PanResponder 的流畅拖拽出牌交互。
    *   支持**多选卡牌同步拖拽**动画。
    *   完整的国际化 (i18n) 支持（包含中、英、日三语）。
*   **API 和扩展性:** 基于 `boardgame.io` 的架构允许在未来极其方便地即插即用新卡牌游戏。

## 技术栈

*   **框架:** Expo (React Native) 用于构建 Web 和 Android 端
*   **游戏引擎:** `boardgame.io`
*   **网络通信:** 原生 `RTCPeerConnection` 和 `RTCDataChannel`
    *   为确保纯局域网运行，`iceServers` 被显式置空 (`[]`)，不使用任何 STUN/TURN 服务器。
*   **信令压缩:** `lz-string`
*   **二维码:** `react-qr-code` 和 `expo-camera` (针对原生端) / `html5-qrcode` (针对 Web 端)
*   **部署:** GitHub Pages (Web 端) & EAS Build (Android 预览版)

## 本地开发设置

1.  **安装依赖:**
    ```bash
    npm install
    # 安装 Expo 及相关的 native 模块
    npx expo install
    ```

2.  **启动 Expo 开发服务器:**
    ```bash
    npm start
    # 或者 npm run web (仅在浏览器测试)
    # 或者 npm run android (在 Android 模拟器/设备上运行)
    ```

3.  **构建 Android APK:**
    ```bash
    npm run build:android:preview
    ```

## 如何开发并添加新游戏

要添加一款新游戏：
1. 在 `src/game-modules/YourGame.ts` 中创建一个新模块，定义 `boardgame.io` 的 `Game` 对象。
2. 引擎提供了一个通用的 `GameBoard` 组件 (`src/components/GameBoard.tsx`)，你可以复用或扩展它来渲染新游戏的卡牌和交互。
3. 在 `App.tsx` 中注册游戏并适配主业务流。

## 架构蓝图

关于详细的架构决策、状态机逻辑以及早期的开发阶段记录，请参阅 [BLUEPRINT.md](./BLUEPRINT.md)。

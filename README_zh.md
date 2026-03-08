[English](./README.md) | [简体中文](./README_zh.md) | [日本語](./README_ja.md)

# Offline Cards

**Offline Cards** 是一款纯离线、无服务器的渐进式 Web 应用（PWA），旨在为面对面的局域网（LAN）游戏替代实体扑克牌。

## 核心理念

该应用程序**严格禁止**使用任何集中式后端服务器或 WebSocket。所有游戏数据均通过局域网在两台设备的浏览器之间通过 WebRTC（`RTCDataChannel`）直接传输。

这通过**手动信令**实现：设备之间通过二维码扫描（摄像头）和基于 `quiet.js` 的超声波音频传输来交换压缩的 WebRTC 会话描述协议（SDP）字符串。

## 技术栈

*   **框架：** Expo (React Native for Web)
*   **网络：** 原生浏览器 `RTCPeerConnection` 与 `RTCDataChannel`
    *   `iceServers` 被明确设置为空 `[]` 以确保纯局域网操作。
*   **信令与握手：**
    *   `lz-string` (将 SDP 压缩成 URL 安全的字符串以缩小二维码尺寸)
    *   `react-qr-code` (生成) & `html5-qrcode` / `expo-camera` (扫描)
    *   `quiet.js` (离线握手的超声波音频传输)
*   **游戏引擎：** `boardgame.io` (纯客户端状态机处理，强制实现离线机制)
*   **国际化 (i18n)：** `i18next` 与 `react-i18next` (支持英语、简体中文及日语)
*   **部署：** GitHub Pages (`gh-pages`)

## 当前状态：第一阶段 (核心通信链路)

目前，应用程序支持基础的 WebRTC 信令流程及简单的文本聊天功能。卡牌 UI 或游戏引擎逻辑尚未完全实现。

### 工作原理 (握手流程)：
1.  **主机** 创建房间，生成 Offer，等待 ICE 收集完成，将其压缩，并同时通过二维码和 `quiet.js` 超声波广播。
2.  **访客** 接收 Offer（通过扫描主机二维码或监听超声波），解压该 Offer，生成 Answer，等待 ICE 收集完成，进行压缩，随后通过二维码和超声波广播自己的回应。
3.  **主机** 收到访客的 Answer。
4.  **连接建立！** 双方设备即可通过纯 P2P WebRTC 相互通信。

## 本地开发环境设置

1.  **安装依赖项：**
    ```bash
    npm install
    # 如果由于网络限制需要优先使用本地缓存：
    # npm install --prefer-offline --no-audit
    ```

2.  **启动 Expo 开发服务器 (仅适用于 Web 端)：**
    ```bash
    npx expo start --web
    ```
    *应用程序将在 `http://localhost:8081` 运行。*

3.  **本地构建 / 沙盒测试：**
    在部署前进行本地编译验证。
    ```bash
    npx tsc --noEmit
    npx expo export -p web
    ```
    *若需使用沙盒模式进行前端验证，请在主界面上寻找 "单机沙盒测试" 按钮。*

## 部署

该应用程序配置简便，可快速部署到 GitHub Pages。请确保你的部署配置符合 PWA 的要求（比如，对于基于 Metro 的资产缓存，正确配置 Service Worker）。

1.  更新 `package.json` 中的 `homepage` URL 为对应的 GitHub Pages 地址（例如 `https://<username>.github.io/<repo-name>`）。同时确保 `app.json` 中的 `experiments.baseUrl` 与子路径相匹配。
2.  运行部署脚本：
    ```bash
    npm run deploy
    # 或依赖 GitHub Actions（在 push 到 main 分支时自动构建并将 dist 目录推送到 gh-pages 分支）。
    ```

## Blueprint 蓝图

有关详细的架构决策、状态机逻辑以及未来的开发阶段，请参阅 [BLUEPRINT.md](./BLUEPRINT.md)。

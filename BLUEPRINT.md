# Offline Cards Blueprint

## 1. Project Background and Objective

**Offline Cards** is designed as a pure offline web application to replace physical playing cards for face-to-face local area network (LAN) gaming.

**Core Principle:** No centralized backend servers. No WebSockets. Absolutely no internet reliance for gameplay.
All data is transmitted via a direct peer-to-peer (P2P) connection established directly between two device browsers over a local network.

## 2. Technical Architecture

The architecture intentionally avoids traditional signaling servers (like WebSockets or Firebase) to maintain a pure offline experience. Instead, it relies on manual signaling via QR codes.

### 2.1 Technology Stack
*   **Framework:** Expo (React Native for Web) packaged as a Progressive Web App (PWA).
*   **Networking:** Native browser WebRTC APIs (`RTCPeerConnection`, `RTCDataChannel`).
    *   **Crucial Rule:** `iceServers` must be strictly empty (`[]`) to enforce pure LAN connectivity.
*   **Signaling Compression:** `lz-string` (Compressing SDP Offer/Answer into URL-safe strings).
*   **QR Code Handling:**
    *   Generation: `react-qr-code`
    *   Scanning: `html5-qrcode` (Direct DOM manipulation via refs to access device cameras).
*   **Deployment:** GitHub Pages (`gh-pages`)

### 2.2 Application State Machine

The UI is driven by a simple state machine:

1.  **`HOME`**: The entry point. The user can choose to act as a **Host** or a **Guest**.
2.  **`SIGNALING_HOST`**: The Host generates an SDP Offer, waits for ICE gathering to complete, compresses it, and displays it as a QR code. The Host then waits to scan the Guest's Answer.
3.  **`SIGNALING_GUEST`**: The Guest scans the Host's QR code, generates an SDP Answer, waits for ICE gathering, compresses it, and displays it as a QR code for the Host to scan.
4.  **`CONNECTED`**: Both devices have successfully exchanged ICE candidates and established a direct `RTCDataChannel`. They can now communicate seamlessly in real-time.

### 2.3 WebRTC Handshake Flow (Manual Signaling)

1.  **Host**:
    *   Creates `RTCPeerConnection`.
    *   Creates `RTCDataChannel`.
    *   Creates Offer -> Sets Local Description.
    *   **Waits** for `onicegatheringstatechange` to reach `complete`.
    *   Compresses the full SDP with `lz-string`.
    *   Generates **QR Code A**.
2.  **Guest**:
    *   Scans **QR Code A**.
    *   Decompresses SDP -> Sets Remote Description.
    *   Creates Answer -> Sets Local Description.
    *   **Waits** for `onicegatheringstatechange` to reach `complete`.
    *   Compresses the full SDP with `lz-string`.
    *   Generates **QR Code B**.
3.  **Host**:
    *   Scans **QR Code B**.
    *   Decompresses SDP -> Sets Remote Description.
4.  **Connection Established**: `RTCDataChannel` triggers `onopen`.

## 3. Development Phases

### Phase 1: Core Communication Link (Completed)
*   Setup Expo Web project.
*   Implement manual WebRTC signaling (QR + Camera).
*   Establish `RTCDataChannel` and verify bidirectional text messaging.
*   Configure GitHub Pages CI/CD pipeline.

### Phase 2: Session Recovery (Disaster Recovery & State Persistence)
*   **Precise Connection Monitoring**: Strictly monitor `RTCPeerConnection.onconnectionstatechange`.
    *   State `disconnected`: UI soft prompt "网络波动，尝试重连中..." (Network fluctuation, attempting to reconnect...), underlying layer waits for WebRTC to auto-recover.
    *   State `failed`: UI hard prompt "连接彻底断开" (Connection completely lost), and render a "生成重连二维码" (Generate Reconnection QR Code) button for the Host.
*   **State Snapshot Persistence**:
    *   On the Host side, whenever the game state changes, immediately serialize the full State JSON snapshot and save it to `localStorage`, bound to a unique `RoomID`.
    *   On the Guest side, save its own `PlayerID` and the associated `RoomID`.
*   **Seamless Resume**: When a `failed` disconnection occurs and the Guest establishes a new WebRTC connection by re-scanning the Host's new QR code:
    1.  The Host must first verify the Guest's `RoomID` and `PlayerID` via the `DataChannel`.
    2.  If it matches the local storage record from the previous session, the Host is strictly forbidden from re-initializing the game; instead, it must directly dispatch the last valid snapshot from `localStorage` to the Guest.
    3.  Upon receiving the snapshot, the Guest directly renders the table state exactly as it was just before the disconnection. This achieves a seamless recovery of game progress after a physical disconnection and re-scan.

### Phase 3: Deck Engine and State Synchronization (Upcoming)
*   Define standard JSON structures for a deck of cards.
*   Implement deterministic shuffling algorithms.
*   Synchronize game state (e.g., Draw, Play, Discard) between peers via `RTCDataChannel`.

### Phase 4: Card Game UI/UX (Future)
*   Implement React Native gesture handlers for drawing, dragging, and dropping cards.
*   Design responsive playing field (hand, deck, discard pile).
*   Add animations and haptic feedback.

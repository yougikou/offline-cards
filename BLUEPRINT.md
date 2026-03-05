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

### Phase 2: Deck Engine and State Synchronization (Upcoming)
*   Define standard JSON structures for a deck of cards.
*   Implement deterministic shuffling algorithms.
*   Synchronize game state (e.g., Draw, Play, Discard) between peers via `RTCDataChannel`.

### Phase 3: Card Game UI/UX (Future)
*   Implement React Native gesture handlers for drawing, dragging, and dropping cards.
*   Design responsive playing field (hand, deck, discard pile).
*   Add animations and haptic feedback.

import { compressSDPPayload, decompressSDPPayload } from './sdpUtils';

// A wrapper around RTCPeerConnection to support completely offline SDP exchange
export class OfflineWebRTCManager {
  public peerConnection: RTCPeerConnection;
  public dataChannel: RTCDataChannel | null = null;
  public pendingCandidates: RTCIceCandidateInit[] = [];

  public onMessageCallback: ((message: string) => void) | null = null;
  public onConnectionStateChangeCallback: ((state: string) => void) | null = null;
  public onDataChannelOpenCallback: (() => void) | null = null;

  // Emit the compressed SDP payload when it's fully generated
  public onGeneratedPayloadCallback: ((payload: string) => void) | null = null;

  constructor() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // Also fallback to a common stun server
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    });

    this.peerConnection.onicecandidate = (e) => {
      if (e.candidate === null) {
        // ICE gathering finished, we have our complete SDP
        if (this.peerConnection.localDescription) {
          const type = this.peerConnection.localDescription.type as 'offer' | 'answer';
          const sdp = this.peerConnection.localDescription.sdp;
          const compressed = compressSDPPayload(type, sdp);
          console.log(`[OfflineWebRTC] ICE Gathering Complete. Generated ${type}. Length: ${compressed.length}`);
          this.onGeneratedPayloadCallback?.(compressed);
        }
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log(`[OfflineWebRTC] Connection state: ${state}`);
      this.onConnectionStateChangeCallback?.(state);
    };

    this.peerConnection.ondatachannel = (e) => {
      console.log(`[OfflineWebRTC] Received DataChannel from Remote`);
      this.setupDataChannel(e.channel);
    };
  }

  // Host: Generate Offer
  public async generateOffer() {
    this.dataChannel = this.peerConnection.createDataChannel('game', {
      negotiated: false, // let WebRTC negotiate it internally
      id: 0
    });
    this.setupDataChannel(this.dataChannel);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    // onicecandidate will fire and trigger onGeneratedPayloadCallback
  }

  // Guest: Receive Offer -> Generate Answer
  public async handleOfferAndGenerateAnswer(compressedOffer: string): Promise<boolean> {
    try {
      const payload = decompressSDPPayload(compressedOffer);
      if (!payload || payload.type !== 'offer') {
         console.warn("Invalid compressed offer");
         return false;
      }

      const offer = new RTCSessionDescription({ type: 'offer', sdp: payload.sdp });
      await this.peerConnection.setRemoteDescription(offer);

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      // onicecandidate will fire and trigger onGeneratedPayloadCallback
      return true;
    } catch(e) {
      console.error("Error setting offer", e);
      return false;
    }
  }

  // Host: Receive Answer -> Connection closes
  public async handleAnswer(compressedAnswer: string): Promise<boolean> {
    try {
      const payload = decompressSDPPayload(compressedAnswer);
      if (!payload || payload.type !== 'answer') {
         console.warn("Invalid compressed answer");
         return false;
      }

      const answer = new RTCSessionDescription({ type: 'answer', sdp: payload.sdp });
      await this.peerConnection.setRemoteDescription(answer);
      return true;
    } catch(e) {
       console.error("Error setting answer", e);
       return false;
    }
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;

    channel.onopen = () => {
      console.log('[OfflineWebRTC] Data channel open!');
      this.onConnectionStateChangeCallback?.('connected');
      this.onDataChannelOpenCallback?.();
    };

    channel.onmessage = (e) => {
      if (typeof e.data === 'string') {
        this.onMessageCallback?.(e.data);
      } else {
        console.warn("[OfflineWebRTC] Received non-string data", e.data);
      }
    };

    channel.onclose = () => {
      console.log('[OfflineWebRTC] Data channel closed!');
      this.onConnectionStateChangeCallback?.('disconnected');
    };

    channel.onerror = (err) => {
      console.error("[OfflineWebRTC] Data Channel Error:", err);
      this.onConnectionStateChangeCallback?.('failed');
    };
  }

  public close() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    this.peerConnection.close();
  }

  public sendMessage(message: string) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(message);
    } else {
      console.warn("[OfflineWebRTC] Data channel is not open");
    }
  }
}

import LZString from 'lz-string';

const rtcConfig: RTCConfiguration = {
  iceServers: [], // Empty for pure LAN/Offline
};

export class WebRTCManager {
  public peerConnection: RTCPeerConnection | null = null;
  public dataChannel: RTCDataChannel | null = null;

  private onMessageCallback: ((message: string) => void) | null = null;
  private onConnectionStateChangeCallback: ((state: string) => void) | null = null;

  constructor(
    onMessage: (msg: string) => void,
    onConnectionStateChange: (state: string) => void
  ) {
    this.onMessageCallback = onMessage;
    this.onConnectionStateChangeCallback = onConnectionStateChange;
  }

  public initPeerConnection() {
    this.peerConnection = new RTCPeerConnection(rtcConfig);

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        this.onConnectionStateChangeCallback?.(this.peerConnection.connectionState);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.peerConnection) {
        console.log('ICE Connection State:', this.peerConnection.iceConnectionState);
      }
    };
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    this.dataChannel.onopen = () => {
      console.log('Data channel open!');
    };
    this.dataChannel.onmessage = (event) => {
      this.onMessageCallback?.(event.data);
    };
  }

  public async createOffer(): Promise<string> {
    this.initPeerConnection();
    if (!this.peerConnection) throw new Error("PeerConnection not initialized");

    const channel = this.peerConnection.createDataChannel('p2p-deck');
    this.setupDataChannel(channel);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    return new Promise((resolve) => {
      if (this.peerConnection?.iceGatheringState === 'complete') {
        const compressed = this.compressSDP(this.peerConnection.localDescription);
        resolve(compressed);
      } else {
        const checkState = () => {
          if (this.peerConnection?.iceGatheringState === 'complete') {
            this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
            const compressed = this.compressSDP(this.peerConnection.localDescription);
            resolve(compressed);
          }
        };
        this.peerConnection?.addEventListener('icegatheringstatechange', checkState);
      }
    });
  }

  public async acceptOfferAndCreateAnswer(compressedOffer: string): Promise<string> {
    this.initPeerConnection();
    if (!this.peerConnection) throw new Error("PeerConnection not initialized");

    this.peerConnection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };

    const offerSDP = this.decompressSDP(compressedOffer);
    if (!offerSDP) throw new Error("Invalid Offer");

    await this.peerConnection.setRemoteDescription(offerSDP);

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    return new Promise((resolve) => {
      if (this.peerConnection?.iceGatheringState === 'complete') {
        const compressed = this.compressSDP(this.peerConnection.localDescription);
        resolve(compressed);
      } else {
        const checkState = () => {
          if (this.peerConnection?.iceGatheringState === 'complete') {
            this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
            const compressed = this.compressSDP(this.peerConnection.localDescription);
            resolve(compressed);
          }
        };
        this.peerConnection?.addEventListener('icegatheringstatechange', checkState);
      }
    });
  }

  public async acceptAnswer(compressedAnswer: string) {
    if (!this.peerConnection) throw new Error("PeerConnection not initialized");

    const answerSDP = this.decompressSDP(compressedAnswer);
    if (!answerSDP) throw new Error("Invalid Answer");

    await this.peerConnection.setRemoteDescription(answerSDP);
  }

  public sendMessage(message: string) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(message);
    } else {
      console.warn("Data channel is not open");
    }
  }

  private compressSDP(sdp: RTCSessionDescription | null): string {
    if (!sdp) return '';
    const jsonStr = JSON.stringify(sdp);
    return LZString.compressToEncodedURIComponent(jsonStr);
  }

  private decompressSDP(compressed: string): RTCSessionDescriptionInit | null {
    if (!compressed) return null;
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
    if (!decompressed) return null;
    try {
      return JSON.parse(decompressed);
    } catch (e) {
      console.error("Failed to parse decompressed SDP", e);
      return null;
    }
  }
}

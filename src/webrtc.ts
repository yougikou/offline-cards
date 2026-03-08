import LZString from 'lz-string';

const rtcConfig: RTCConfiguration = {
  iceServers: [], // Empty for pure LAN/Offline
};

export class WebRTCManager {
  public peerConnection: RTCPeerConnection | null = null;
  public dataChannel: RTCDataChannel | null = null;

  public onMessageCallback: ((message: string) => void) | null = null;
  public onConnectionStateChangeCallback: ((state: string) => void) | null = null;
  public onDataChannelOpenCallback: (() => void) | null = null;

  constructor() {}

  public static parseCompressedDescription(compressed: string): RTCSessionDescriptionInit | null {
    if (!compressed) return null;
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
    if (!decompressed) return null;
    try {
      const parsed = JSON.parse(decompressed);
      if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string' || typeof parsed.sdp !== 'string') {
        return null;
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse decompressed SDP', e);
      return null;
    }
  }

  public static isCompressedDescription(compressed: string): boolean {
    return WebRTCManager.parseCompressedDescription(compressed) !== null;
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
      this.onDataChannelOpenCallback?.();
    };
    this.dataChannel.onmessage = (event) => {
      this.onMessageCallback?.(event.data);
    };
  }

  public close() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  public async createOffer(): Promise<string> {
    this.initPeerConnection();
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');

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
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');

    this.peerConnection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };

    const offerSDP = this.decompressSDP(compressedOffer);
    if (!offerSDP) throw new Error('Invalid Offer');

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
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');

    const answerSDP = this.decompressSDP(compressedAnswer);
    if (!answerSDP) throw new Error('Invalid Answer');

    await this.peerConnection.setRemoteDescription(answerSDP);
  }

  public sendMessage(message: string) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(message);
    } else {
      console.warn('Data channel is not open');
    }
  }

  private compressSDP(sdp: RTCSessionDescription | null): string {
    if (!sdp) return '';
    const jsonStr = JSON.stringify(sdp);
    return LZString.compressToEncodedURIComponent(jsonStr);
  }

  private decompressSDP(compressed: string): RTCSessionDescriptionInit | null {
    return WebRTCManager.parseCompressedDescription(compressed);
  }
}

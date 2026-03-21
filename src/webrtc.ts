import LZString from 'lz-string';
import { Platform } from 'react-native';

// Import native WebRTC polyfills for Android/iOS
let NativeRTCPeerConnection: any;
let NativeRTCSessionDescription: any;

if (Platform.OS !== 'web') {
  try {
    const webrtc = require('react-native-webrtc');
    NativeRTCPeerConnection = webrtc.RTCPeerConnection;
    NativeRTCSessionDescription = webrtc.RTCSessionDescription;
    // Register globals for react-native-webrtc
    webrtc.registerGlobals();
  } catch (e) {
    console.warn('react-native-webrtc not available, WebRTC will only work on web');
  }
}

const getRTCPeerConnection = (): typeof RTCPeerConnection => {
  if (Platform.OS !== 'web' && NativeRTCPeerConnection) {
    return NativeRTCPeerConnection;
  }
  return RTCPeerConnection;
};

const rtcConfig: RTCConfiguration = {
  iceServers: [], // Empty for pure LAN/Offline
};

export class WebRTCManager {
  public peerConnection: RTCPeerConnection | null = null;
  public dataChannel: RTCDataChannel | null = null;

  public onMessageCallback: ((message: string) => void) | null = null;
  public onConnectionStateChangeCallback: ((state: string) => void) | null = null;
  public onDataChannelOpenCallback: (() => void) | null = null;

  constructor() { }

  public initPeerConnection() {
    const PeerConnectionClass = getRTCPeerConnection();
    this.peerConnection = new PeerConnectionClass(rtcConfig);

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

    // 1. Split into lines
    const lines = sdp.sdp.split('\r\n');
    const filteredLines: string[] = [];

    let skipMode = false;
    for (const line of lines) {
      // We only care about the data channel application part, strip out video/audio
      if (line.startsWith('m=video') || line.startsWith('m=audio')) {
        skipMode = true;
        continue;
      }
      if (line.startsWith('m=')) {
        skipMode = false;
      }
      if (skipMode) continue;
      if (line.trim() === '') continue;

      // Use a dictionary for common SDP keys
      let compressedLine = line;
      if (compressedLine.startsWith('a=ice-ufrag:')) compressedLine = compressedLine.replace('a=ice-ufrag:', 'u:');
      else if (compressedLine.startsWith('a=ice-pwd:')) compressedLine = compressedLine.replace('a=ice-pwd:', 'p:');
      else if (compressedLine.startsWith('a=fingerprint:')) compressedLine = compressedLine.replace('a=fingerprint:', 'f:');
      else if (compressedLine.startsWith('a=candidate:')) compressedLine = compressedLine.replace('a=candidate:', 'c:');

      filteredLines.push(compressedLine);
    }

    const minifiedSDP = filteredLines.join('\n');

    // 2. Create minimal payload
    const payload = {
      t: sdp.type === 'offer' ? 'o' : 'a',
      s: minifiedSDP
    };

    const jsonStr = JSON.stringify(payload);
    // 3. Compress using LZString
    return LZString.compressToEncodedURIComponent(jsonStr);
  }

  private decompressSDP(compressed: string): RTCSessionDescriptionInit | null {
    if (!compressed) return null;

    let decompressed: string | null = null;
    try {
      // First try decompressing with LZString
      decompressed = LZString.decompressFromEncodedURIComponent(compressed);
      if (!decompressed) {
         // Fallback for older non-minified version if it was pure JSON or unencoded
         try {
           JSON.parse(compressed);
           decompressed = compressed;
         } catch {
           return null;
         }
      }
    } catch (e) {
      console.error("Failed to decompress SDP", e);
      return null;
    }

    if (!decompressed) return null;

    try {
      const payload = JSON.parse(decompressed);

      // Backward compatibility with old full JSON payloads
      if (payload.type && payload.sdp) {
        return payload as RTCSessionDescriptionInit;
      }

      const type = payload.t === 'o' ? 'offer' : 'answer';
      const lines = (payload.s as string).split('\n');

      const restoredLines = lines.map(line => {
        if (line.startsWith('u:')) return line.replace('u:', 'a=ice-ufrag:');
        if (line.startsWith('p:')) return line.replace('p:', 'a=ice-pwd:');
        if (line.startsWith('f:')) return line.replace('f:', 'a=fingerprint:');
        if (line.startsWith('c:')) return line.replace('c:', 'a=candidate:');
        return line;
      });

      // SDP strictly requires \r\n endings
      const restoredSDP = restoredLines.join('\r\n') + '\r\n';

      return {
        type: type as RTCSdpType,
        sdp: restoredSDP
      };
    } catch (e) {
      console.error("Failed to parse decompressed SDP", e);
      return null;
    }
  }
}

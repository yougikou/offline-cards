import { Peer, DataConnection } from 'peerjs';

export class WebRTCManager {
  public dataChannel: DataConnection | null = null;
  public peer: Peer | null = null; // Only used by Guest to hold the Peer instance

  public onMessageCallback: ((message: string) => void) | null = null;
  public onConnectionStateChangeCallback: ((state: string) => void) | null = null;
  public onDataChannelOpenCallback: (() => void) | null = null;

  constructor() {}

  // For Host: Wrap an existing DataConnection from the Host's Peer
  public wrapConnection(connection: DataConnection) {
    this.dataChannel = connection;
    this.setupDataChannel(this.dataChannel);
  }

  // For Guest: Initialize a new Peer and connect to the Host
  public connectToHost(roomCode: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer();

        this.peer.on('open', () => {
          this.dataChannel = this.peer!.connect('MYGAME_' + roomCode);
          this.setupDataChannel(this.dataChannel, resolve);
        });

        this.peer.on('error', (err) => {
          console.error("Guest Peer Error:", err);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private setupDataChannel(channel: DataConnection, resolveOpen?: () => void) {
    channel.on('open', () => {
      console.log('Data channel open!');
      this.onConnectionStateChangeCallback?.('connected');
      this.onDataChannelOpenCallback?.();
      if (resolveOpen) resolveOpen();
    });

    channel.on('data', (data: unknown) => {
      // Data is sent as a stringified JSON
      if (typeof data === 'string') {
        this.onMessageCallback?.(data);
      } else {
        console.warn("Received non-string data", data);
      }
    });

    channel.on('close', () => {
      this.onConnectionStateChangeCallback?.('disconnected');
    });

    channel.on('error', (err) => {
      console.error("Data Channel Error:", err);
      this.onConnectionStateChangeCallback?.('failed');
    });
  }

  public close() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }

  public sendMessage(message: string) {
    if (this.dataChannel && this.dataChannel.open) {
      this.dataChannel.send(message);
    } else {
      console.warn("Data channel is not open");
    }
  }
}

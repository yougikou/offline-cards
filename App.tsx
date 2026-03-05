import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, TextInput, ScrollView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebRTCManager } from './src/webrtc';
import Scanner from './src/components/Scanner';
import QRCodeDisplay from './src/components/QRCodeDisplay';

type AppState = 'HOME' | 'SIGNALING_HOST' | 'SIGNALING_GUEST' | 'CONNECTED';
type Role = 'HOST' | 'GUEST' | null;

export default function App() {
  const [appState, setAppState] = useState<AppState>('HOME');
  const [role, setRole] = useState<Role>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');

  const [messages, setMessages] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [webrtcManager, setWebrtcManager] = useState<WebRTCManager | null>(null);

  // Signaling state
  const [qrValue, setQrValue] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [showMode, setShowMode] = useState<'qr' | 'scanner'>('qr');

  // Persistence helpers
  const saveHostState = (id: string, msgs: string[]) => {
    if (Platform.OS === 'web') {
      localStorage.setItem('hostRoomId', id);
      localStorage.setItem('hostState', JSON.stringify({ messages: msgs }));
    }
  };

  const saveGuestState = (rId: string, pId: string) => {
    if (Platform.OS === 'web') {
      localStorage.setItem('guestRoomId', rId);
      localStorage.setItem('guestPlayerId', pId);
    }
  };

  const clearStorage = () => {
    if (Platform.OS === 'web') {
      localStorage.removeItem('hostRoomId');
      localStorage.removeItem('hostState');
      localStorage.removeItem('guestRoomId');
      localStorage.removeItem('guestPlayerId');
    }
  };

  useEffect(() => {
    const manager = new WebRTCManager();
    setWebrtcManager(manager);
    return () => manager.close();
  }, []);

  // Use refs for callbacks to access latest state without reconnecting DataChannel
  const roleRef = useRef(role);
  const roomIdRef = useRef(roomId);
  const playerIdRef = useRef(playerId);
  const messagesRef = useRef(messages);

  useEffect(() => {
    roleRef.current = role;
    roomIdRef.current = roomId;
    playerIdRef.current = playerId;
    messagesRef.current = messages;
  }, [role, roomId, playerId, messages]);

  useEffect(() => {
    if (!webrtcManager) return;

    webrtcManager.onMessageCallback = (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data.type === 'HELLO') {
          if (roleRef.current === 'HOST') {
            // For Phase 1, Guest may not know room ID initially, let's accept and inform Guest of room ID
            // If they are resuming, they should pass the correct roomId, or empty if new.
            if (!data.roomId || data.roomId === roomIdRef.current) {
              webrtcManager.sendMessage(JSON.stringify({ type: 'WELCOME', roomId: roomIdRef.current, state: { messages: messagesRef.current } }));
            } else {
              webrtcManager.sendMessage(JSON.stringify({ type: 'ERROR', message: 'Room ID mismatch' }));
            }
          }
        } else if (data.type === 'WELCOME') {
          if (roleRef.current === 'GUEST') {
            setMessages(data.state.messages || []);
            // Save guest state on welcome to sync room ID correctly
            if (data.roomId) {
              setRoomId(data.roomId);
              saveGuestState(data.roomId, playerIdRef.current);
            }
          }
        } else if (data.type === 'ACTION_CHAT') {
          const newMessages = [...messagesRef.current, `Remote: ${data.text}`];
          setMessages(newMessages);
          if (roleRef.current === 'HOST') {
            saveHostState(roomIdRef.current, newMessages);
          }
        } else if (data.type === 'STATE_UPDATE') {
          if (roleRef.current === 'GUEST') {
             setMessages(data.state.messages || []);
          }
        }
      } catch (e) {
        // Fallback for raw strings during development
        setMessages((prev) => [...prev, `Remote: ${msg}`]);
      }
    };

    webrtcManager.onConnectionStateChangeCallback = (state) => {
      setConnectionStatus(state);
      if (state === 'connected') {
        setAppState('CONNECTED');
      }
      // If disconnected/failed, we stay in CONNECTED or move to a specific UI, don't reset immediately.
    };

    webrtcManager.onDataChannelOpenCallback = () => {
      if (roleRef.current === 'GUEST') {
        webrtcManager.sendMessage(JSON.stringify({
          type: 'HELLO',
          roomId: roomIdRef.current,
          playerId: playerIdRef.current
        }));
      }
    };
  }, [webrtcManager]);

  const handleHost = async (resume: boolean = false) => {
    if (!webrtcManager) return;
    setAppState('SIGNALING_HOST');
    setRole('HOST');

    if (!resume) {
      const newRoomId = Math.random().toString(36).substring(2, 9);
      setRoomId(newRoomId);
      setMessages([]);
      clearStorage();
    } else {
      // roomId and messages should already be loaded from storage before calling handleHost(true)
    }

    setQrValue('');
    setIsScanning(false);
    setShowMode('qr'); // Start by showing offer
    try {
      const offerStr = await webrtcManager.createOffer();
      setQrValue(offerStr);
      setIsScanning(true); // Host now needs to scan guest's answer
    } catch (e) {
      console.error("Host Error:", e);
      setAppState('HOME');
    }
  };

  const handleGuest = (resume: boolean = false) => {
    setAppState('SIGNALING_GUEST');
    setRole('GUEST');

    if (!resume) {
      const newPlayerId = Math.random().toString(36).substring(2, 9);
      // Assuming Guest doesn't know room ID until first scan or message,
      // but to persist we need it. For Phase 1, we just set a dummy or update it later.
      // Actually, Guest gets roomId from HOST's HELLO response or scanning payload?
      // In this pure manual setup, Guest scans Offer (SDP). We'll set a generic room for now
      // or extract from offer. Let's just generate a player ID.
      setPlayerId(newPlayerId);
      clearStorage();
    }

    setQrValue('');
    setIsScanning(true); // Guest scans host's offer first
    setShowMode('scanner'); // Start by scanning host's offer
  };

  const handleScanSuccess = async (scannedText: string) => {
    if (!webrtcManager) return;
    setIsScanning(false);

    try {
      if (appState === 'SIGNALING_HOST') {
        // Host scanned Guest's answer
        await webrtcManager.acceptAnswer(scannedText);
      } else if (appState === 'SIGNALING_GUEST') {
        // Guest scanned Host's offer
        const answerStr = await webrtcManager.acceptOfferAndCreateAnswer(scannedText);
        setQrValue(answerStr);
        setShowMode('qr'); // Guest now displays QR for Host to scan
        // Guest now displays QR for Host to scan
      }
    } catch (e) {
      console.error("Signaling Error:", e);
      alert("Error during signaling: " + String(e));
      setAppState('HOME');
    }
  };

  const handleSendMessage = () => {
    if (inputText.trim() && webrtcManager) {
      const payload = { type: 'ACTION_CHAT', text: inputText };
      webrtcManager.sendMessage(JSON.stringify(payload));

      const newMessages = [...messages, `Me: ${inputText}`];
      setMessages(newMessages);

      if (role === 'HOST') {
        saveHostState(roomId, newMessages);
      }

      setInputText('');
    }
  };

  const renderHome = () => {
    let savedHostRoomId = '';
    let savedGuestRoomId = '';
    let hasHostState = false;
    let hasGuestState = false;

    if (Platform.OS === 'web') {
      savedHostRoomId = localStorage.getItem('hostRoomId') || '';
      savedGuestRoomId = localStorage.getItem('guestRoomId') || '';
      hasHostState = !!savedHostRoomId;
      hasGuestState = !!savedGuestRoomId;
    }

    return (
      <View style={styles.content}>
        <Text style={styles.title}>Offline Cards</Text>
        <Text style={styles.subtitle}>No servers. Pure WebRTC LAN.</Text>
        <View style={styles.buttonContainer}>
          <Button title="Create Room (Host)" onPress={() => handleHost(false)} />
          <View style={{ height: 20 }} />
          <Button title="Join Room (Guest)" onPress={() => handleGuest(false)} />

          {(hasHostState || hasGuestState) && (
            <View style={{ marginTop: 40 }}>
              <Text style={{ textAlign: 'center', marginBottom: 10, color: 'gray' }}>Session Recovery</Text>
              {hasHostState && (
                <Button title={`Resume Hosted Room`} color="orange" onPress={() => {
                  setRoomId(savedHostRoomId);
                  const stateStr = localStorage.getItem('hostState');
                  if (stateStr) {
                    try {
                      setMessages(JSON.parse(stateStr).messages || []);
                    } catch (e) {}
                  }
                  handleHost(true);
                }} />
              )}
              {hasGuestState && (
                <View style={{ marginTop: 10 }}>
                  <Button title={`Resume Joined Room`} color="orange" onPress={() => {
                    setRoomId(savedGuestRoomId);
                    setPlayerId(localStorage.getItem('guestPlayerId') || '');
                    handleGuest(true);
                  }} />
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderSignaling = () => (
    <View style={styles.content}>
      <Text style={styles.title}>
        {appState === 'SIGNALING_HOST' ? 'Host Mode' : 'Guest Mode'}
      </Text>
      <Text style={{ marginBottom: 10 }}>Status: {connectionStatus}</Text>

      {qrValue && isScanning && (
        <View style={{ flexDirection: 'row', marginBottom: 10, gap: 10 }}>
          <Button
            title="Show My QR"
            onPress={() => setShowMode('qr')}
            color={showMode === 'qr' ? '#007AFF' : '#999'}
          />
          <Button
            title="Scan Other's QR"
            onPress={() => setShowMode('scanner')}
            color={showMode === 'scanner' ? '#007AFF' : '#999'}
          />
        </View>
      )}

      <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        {showMode === 'qr' && qrValue ? (
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={{ marginBottom: 10, textAlign: 'center' }}>Show this QR Code to the other device:</Text>
            <QRCodeDisplay value={qrValue} />
          </View>
        ) : null}

        {showMode === 'scanner' && isScanning ? (
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={{ marginBottom: 10, textAlign: 'center' }}>Scan the other device's QR Code:</Text>
            {Platform.OS === 'web' ? (
              <Scanner onScan={handleScanSuccess} />
            ) : (
              <Text>Scanning requires web environment</Text>
            )}
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: 20, width: '100%', maxWidth: 300 }}>
        <Button title="Cancel" onPress={() => setAppState('HOME')} color="red" />
      </View>
    </View>
  );

  const renderConnected = () => {
    const isDisconnected = connectionStatus === 'disconnected';
    const isFailed = connectionStatus === 'failed';

    return (
      <View style={styles.content}>
        <Text style={styles.title}>
          {isFailed ? "连接彻底断开" : isDisconnected ? "网络波动，尝试重连中..." : "Connected!"}
        </Text>
        {isFailed && (
          <View style={{ marginVertical: 20 }}>
            <Button title={role === 'HOST' ? "生成重连二维码" : "重新扫描主机二维码"} color="orange" onPress={() => {
              // Properly close old connections
              webrtcManager?.close();
              if (role === 'HOST') {
                handleHost(true);
              } else {
                handleGuest(true);
              }
            }} />
          </View>
        )}
        <ScrollView style={styles.messageBox}>
          {messages.map((m, i) => (
            <Text key={i} style={styles.messageText}>{m}</Text>
          ))}
        </ScrollView>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            onSubmitEditing={handleSendMessage}
            editable={connectionStatus === 'connected'}
          />
          <Button title="Send" onPress={handleSendMessage} disabled={connectionStatus !== 'connected'} />
        </View>
        <View style={{ marginTop: 20 }}>
          <Button title="Disconnect" onPress={() => {
            webrtcManager?.close();
            clearStorage();
            setAppState('HOME');
            setMessages([]);
            setRole(null);
          }} color="red" />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      {appState === 'HOME' && renderHome()}
      {(appState === 'SIGNALING_HOST' || appState === 'SIGNALING_GUEST') && renderSignaling()}
      {appState === 'CONNECTED' && renderConnected()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
  },
  section: {
    alignItems: 'center',
    marginVertical: 15,
    width: '100%',
  },
  messageBox: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 8,
    marginVertical: 20,
  },
  messageText: {
    fontSize: 16,
    marginVertical: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 500,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 4,
    marginRight: 10,
  },
});

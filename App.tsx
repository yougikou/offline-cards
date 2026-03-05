import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, TextInput, ScrollView, Platform } from 'react-native';
import { WebRTCManager } from './src/webrtc';
import Scanner from './src/components/Scanner';
import QRCodeDisplay from './src/components/QRCodeDisplay';

type AppState = 'HOME' | 'SIGNALING_HOST' | 'SIGNALING_GUEST' | 'CONNECTED';

export default function App() {
  const [appState, setAppState] = useState<AppState>('HOME');
  const [messages, setMessages] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [webrtcManager, setWebrtcManager] = useState<WebRTCManager | null>(null);

  // Signaling state
  const [qrValue, setQrValue] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [showMode, setShowMode] = useState<'qr' | 'scanner'>('qr');

  useEffect(() => {
    const manager = new WebRTCManager(
      (msg) => {
        setMessages((prev) => [...prev, `Remote: ${msg}`]);
      },
      (state) => {
        setConnectionStatus(state);
        if (state === 'connected') {
          setAppState('CONNECTED');
        } else if (state === 'disconnected' || state === 'failed') {
          setAppState('HOME');
          setMessages([]);
        }
      }
    );
    setWebrtcManager(manager);
    return () => {
      // Cleanup peer connection on unmount if needed
      manager.peerConnection?.close();
    };
  }, []);

  const handleHost = async () => {
    if (!webrtcManager) return;
    setAppState('SIGNALING_HOST');
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

  const handleGuest = () => {
    setAppState('SIGNALING_GUEST');
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
      webrtcManager.sendMessage(inputText);
      setMessages((prev) => [...prev, `Me: ${inputText}`]);
      setInputText('');
    }
  };

  const renderHome = () => (
    <View style={styles.content}>
      <Text style={styles.title}>Offline P2P Deck</Text>
      <Text style={styles.subtitle}>No servers. Pure WebRTC LAN.</Text>
      <View style={styles.buttonContainer}>
        <Button title="Create Room (Host)" onPress={handleHost} />
        <View style={{ height: 20 }} />
        <Button title="Join Room (Guest)" onPress={handleGuest} />
      </View>
    </View>
  );

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

  const renderConnected = () => (
    <View style={styles.content}>
      <Text style={styles.title}>Connected!</Text>
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
        />
        <Button title="Send" onPress={handleSendMessage} />
      </View>
      <View style={{ marginTop: 20 }}>
        <Button title="Disconnect" onPress={() => {
          webrtcManager?.peerConnection?.close();
          setAppState('HOME');
          setMessages([]);
        }} color="red" />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
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

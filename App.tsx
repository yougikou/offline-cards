import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, TextInput, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebRTCManager } from './src/webrtc';
import Scanner from './src/components/Scanner';
import QRCodeDisplay from './src/components/QRCodeDisplay';
import GameBoard from './src/components/GameBoard';
import { StandardPokerModule } from './src/game-modules/poker';
import { GameState, GameAction } from './src/game-modules/types';

type AppState = 'HOME' | 'SIGNALING_HOST' | 'SIGNALING_GUEST' | 'CONNECTED' | 'SANDBOX';
type Role = 'HOST' | 'GUEST' | null;

// The Targeted Sanitization function
function sanitizeStateForPlayer(globalState: GameState, targetPlayerId: string): GameState {
  const safeState: GameState = {
    ...globalState,
    deckCount: globalState.deck?.length || 0,
    deck: undefined, // Hide the actual deck array
    hands: {}
  };

  // Replace other players' hand arrays with generic objects, keep target player's exact hand
  if (globalState.hands) {
    for (const [pId, handArray] of Object.entries(globalState.hands)) {
      if (pId === targetPlayerId) {
        safeState.hands[pId] = [...handArray]; // True cards
      } else {
        // Map to card backs/hidden markers
        safeState.hands[pId] = handArray.map(() => ({ id: Math.random().toString(), hidden: true }));
      }
    }
  }

  return safeState;
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('HOME');
  const [role, setRole] = useState<Role>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>(''); // For guests it's their ID, for host it's 'host'

  const [messages, setMessages] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');

  // Guest uses a single connection manager
  const [guestWebrtcManager, setGuestWebrtcManager] = useState<WebRTCManager | null>(null);

  // Host uses a pool of connection managers mapped by guest ID
  // For signaling we need a "pending" manager that hasn't been assigned an ID yet
  const [pendingHostManager, setPendingHostManager] = useState<WebRTCManager | null>(null);
  const hostConnections = useRef(new Map<string, WebRTCManager>());

  // Signaling state
  const [qrValue, setQrValue] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [showMode, setShowMode] = useState<'qr' | 'scanner'>('qr');

  // Sandbox & Game state
  const [gameState, setGameState] = useState<GameState | null>(null);

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

  // Helper to send game syncs to all connected guests
  const broadcastSync = (state: GameState, connections: Map<string, WebRTCManager>) => {
    connections.forEach((manager, guestId) => {
      const safeState = sanitizeStateForPlayer(state, guestId);
      manager.sendMessage(JSON.stringify({ type: 'SYNC', state: safeState }));
    });
  };

  const roleRef = useRef(role);
  const roomIdRef = useRef(roomId);
  const playerIdRef = useRef(playerId);
  const messagesRef = useRef(messages);
  const gameStateRef = useRef(gameState);

  useEffect(() => {
    roleRef.current = role;
    roomIdRef.current = roomId;
    playerIdRef.current = playerId;
    messagesRef.current = messages;
    gameStateRef.current = gameState;
  }, [role, roomId, playerId, messages, gameState]);

  // Handle Guest Connection
  useEffect(() => {
    if (role !== 'GUEST' || !guestWebrtcManager) return;

    const manager = guestWebrtcManager;

    manager.onMessageCallback = (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data.type === 'WELCOME') {
          setMessages(data.state.messages || []);
          if (data.roomId) {
            setRoomId(data.roomId);
            saveGuestState(data.roomId, playerIdRef.current);
          }
        } else if (data.type === 'SYNC') {
          setGameState(data.state);
        }
      } catch (e) {
        setMessages((prev) => [...prev, `Remote: ${msg}`]);
      }
    };

    manager.onConnectionStateChangeCallback = (state) => {
      setConnectionStatus(state);
      if (state === 'connected') {
        setAppState('CONNECTED');
      }
    };

    manager.onDataChannelOpenCallback = () => {
      manager.sendMessage(JSON.stringify({
        type: 'HELLO',
        roomId: roomIdRef.current,
        playerId: playerIdRef.current
      }));
    };
  }, [guestWebrtcManager, role]);

  // Host setup pending manager handler
  const setupHostManager = (manager: WebRTCManager) => {
    manager.onMessageCallback = (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data.type === 'HELLO') {
          // Identify guest and add to pool if not there
          const gId = data.playerId;
          if (gId) {
            hostConnections.current.set(gId, manager);
            manager.sendMessage(JSON.stringify({ type: 'WELCOME', roomId: roomIdRef.current, state: { messages: messagesRef.current } }));

            // Immediately sync current state if it exists, otherwise initialize it.
            // In a dynamic N-player game, if a new player joins, we add them to state if not there.
            if (gameStateRef.current) {
              let currentState = { ...gameStateRef.current };
              if (!currentState.players.includes(gId)) {
                currentState = {
                  ...currentState,
                  players: [...currentState.players, gId],
                  hands: {
                    ...currentState.hands,
                    [gId]: []
                  }
                };
                setGameState(currentState);
              }
              const safeState = sanitizeStateForPlayer(currentState, gId);
              manager.sendMessage(JSON.stringify({ type: 'SYNC', state: safeState }));

              // Inform existing players of the new state
              broadcastSync(currentState, hostConnections.current);
            }
          }
        } else if (data.type === 'ACTION') {
          if (gameStateRef.current) {
            const newState = StandardPokerModule.reducer(gameStateRef.current, data.action);
            setGameState(newState);
            broadcastSync(newState, hostConnections.current);
          }
        }
      } catch (e) {
        // Ignored
      }
    };

    manager.onConnectionStateChangeCallback = (state) => {
      // Aggregate connection status is tricky. Let's just monitor this one for UI,
      // but 'CONNECTED' should trigger if AT LEAST ONE guest is connected.
      // Wait, we can always just transition the Host to CONNECTED since the host manages the room.
      setConnectionStatus(state);
    };

    manager.onDataChannelOpenCallback = () => {
      setAppState('CONNECTED');
    };
  };

  const handleHost = async (resume: boolean = false) => {
    setAppState('SIGNALING_HOST');
    setRole('HOST');
    setPlayerId('host'); // Fixed ID for the host player

    if (!resume) {
      const newRoomId = Math.random().toString(36).substring(2, 9);
      setRoomId(newRoomId);
      setMessages([]);
      clearStorage();

      // Initialize state immediately for the host
      const initialState = StandardPokerModule.setup(['host']);
      setGameState(initialState);
    }

    startNewHostPendingConnection();
  };

  const startNewHostPendingConnection = async () => {
    const manager = new WebRTCManager();
    setupHostManager(manager);
    setPendingHostManager(manager);

    setQrValue('');
    setIsScanning(false);
    setShowMode('qr'); // Start by showing offer
    try {
      const offerStr = await manager.createOffer();
      setQrValue(offerStr);
      setIsScanning(true); // Host scans guest's answer
    } catch (e) {
      console.error("Host Offer Error:", e);
    }
  };

  const handleGuest = (resume: boolean = false) => {
    setAppState('SIGNALING_GUEST');
    setRole('GUEST');

    if (!resume) {
      const newPlayerId = 'guest_' + Math.random().toString(36).substring(2, 9);
      setPlayerId(newPlayerId);
      clearStorage();
    }

    const manager = new WebRTCManager();
    setGuestWebrtcManager(manager);

    setQrValue('');
    setIsScanning(true);
    setShowMode('scanner');
  };

  const handleScanSuccess = async (scannedText: string) => {
    setIsScanning(false);

    try {
      if (appState === 'SIGNALING_HOST' && pendingHostManager) {
        await pendingHostManager.acceptAnswer(scannedText);
        setAppState('CONNECTED');
      } else if (appState === 'SIGNALING_GUEST' && guestWebrtcManager) {
        const answerStr = await guestWebrtcManager.acceptOfferAndCreateAnswer(scannedText);
        setQrValue(answerStr);
        setShowMode('qr');
      }
    } catch (e) {
      console.error("Signaling Error:", e);
      alert("Error during signaling: " + String(e));
      setAppState('HOME');
    }
  };

  const handleGameAction = (action: GameAction) => {
    if (appState === 'SANDBOX') {
      if (gameState) {
        const newState = StandardPokerModule.reducer(gameState, action);
        setGameState(newState);
      }
    } else if (appState === 'CONNECTED') {
      if (role === 'HOST' && gameState) {
        const newState = StandardPokerModule.reducer(gameState, action);
        setGameState(newState);
        broadcastSync(newState, hostConnections.current);
      } else if (role === 'GUEST') {
        guestWebrtcManager?.sendMessage(JSON.stringify({ type: 'ACTION', action }));
      }
    }
  };

  const renderHome = () => {
    return (
      <View style={styles.content}>
        <Text style={styles.title}>Offline Cards</Text>
        <Text style={styles.subtitle}>Multi-player LAN</Text>
        <View style={styles.buttonContainer}>
          <Button title="Create Room (Host)" onPress={() => handleHost(false)} />
          <View style={{ height: 20 }} />
          <Button title="Join Room (Guest)" onPress={() => handleGuest(false)} />

          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <Text style={{ textAlign: 'center', marginBottom: 10, color: 'gray' }}>Local Testing</Text>
            <Button title="Enter Local Sandbox" color="purple" onPress={() => {
              setAppState('SANDBOX');
              setPlayerId('host');
              setGameState(StandardPokerModule.setup(['host', 'guest_1', 'guest_2']));
            }} />
          </View>
        </View>
      </View>
    );
  };

  const renderSandbox = () => {
    if (!gameState) return null;
    return (
      <GameBoard
        gameState={gameState}
        myPlayerId="host"
        onAction={handleGameAction}
        onExit={() => { setGameState(null); setAppState('HOME'); }}
        onReset={() => setGameState(StandardPokerModule.setup(['host', 'guest_1', 'guest_2']))}
        isSandbox={true}
      />
    );
  };

  const renderSignaling = () => (
    <View style={styles.content}>
      <Text style={styles.title}>
        {appState === 'SIGNALING_HOST' ? 'Host Mode (Add Player)' : 'Guest Mode'}
      </Text>

      {qrValue && isScanning && (
        <View style={{ flexDirection: 'row', marginBottom: 10, gap: 10 }}>
          <Button title="Show My QR" onPress={() => setShowMode('qr')} color={showMode === 'qr' ? '#007AFF' : '#999'} />
          <Button title="Scan Other's QR" onPress={() => setShowMode('scanner')} color={showMode === 'scanner' ? '#007AFF' : '#999'} />
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
        {appState === 'SIGNALING_HOST' && (
          <View style={{ marginBottom: 10 }}>
            <Button title="Skip / Start Game" onPress={() => setAppState('CONNECTED')} color="green" />
          </View>
        )}
        <Button title="Cancel" onPress={() => {
          if (appState === 'SIGNALING_HOST') pendingHostManager?.close();
          if (appState === 'SIGNALING_GUEST') guestWebrtcManager?.close();
          setAppState('HOME');
        }} color="red" />
      </View>
    </View>
  );

  const renderConnected = () => {
    // If we're CONNECTED but have no game state, something is wrong
    if (!gameState) {
      return (
        <View style={styles.content}>
          <Text style={styles.title}>Waiting for state...</Text>
          <Button title="Exit" onPress={() => {
            setAppState('HOME');
          }} color="red" />
        </View>
      );
    }

    return (
      <View style={styles.sandboxContainer}>
        {role === 'HOST' && (
          <View style={{ position: 'absolute', top: 40, right: 10, zIndex: 10 }}>
            <Button title="+ Add Player" onPress={() => {
              startNewHostPendingConnection();
              setAppState('SIGNALING_HOST');
            }} />
          </View>
        )}
        <GameBoard
          gameState={gameState}
          myPlayerId={playerId}
          onAction={handleGameAction}
          onExit={() => {
            if (role === 'HOST') {
              hostConnections.current.forEach(m => m.close());
              hostConnections.current.clear();
            } else {
              guestWebrtcManager?.close();
              setGuestWebrtcManager(null);
            }
            setAppState('HOME');
            setGameState(null);
          }}
          isSandbox={false}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      {appState === 'HOME' && renderHome()}
      {(appState === 'SIGNALING_HOST' || appState === 'SIGNALING_GUEST') && renderSignaling()}
      {appState === 'CONNECTED' && renderConnected()}
      {appState === 'SANDBOX' && renderSandbox()}
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
  sandboxContainer: {
    flex: 1,
    width: '100%',
    flexDirection: 'column',
    overflow: 'hidden',
  }
});

import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, TextInput, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import './i18n/index'; // Initialize i18n
import { WebRTCManager, initQuiet } from './webrtc';
import GameBoard from './components/GameBoard';
import QRScanner from './components/QRScanner';
import QRCode from 'react-native-qrcode-svg';
import { UnoLiteGame } from './game-modules/unoLite';
import { ZhengShangYouGame } from './game-modules/ZhengShangYou';
import { Client } from 'boardgame.io/client';

type AppState = 'HOME' | 'SIGNALING_HOST' | 'SIGNALING_GUEST' | 'CONNECTED' | 'SANDBOX';
type GameMode = 'UnoLite' | 'ZhengShangYou';
type Role = 'HOST' | 'GUEST' | null;

export interface BgioAction {
  type: string;
  moveName: string;
  args: any[];
}

export default function App() {
  const { t, i18n } = useTranslation();
  const [appState, setAppState] = useState<AppState>('HOME');
  const [role, setRole] = useState<Role>(null);
  const [playerId, setPlayerId] = useState<string>(''); // For guests it's their ID, for host it's 'host'

  const [messages, setMessages] = useState<string[]>([]);

  // Webrtc Managers
  const [guestWebrtcManager, setGuestWebrtcManager] = useState<WebRTCManager | null>(null);
  const hostConnections = useRef(new Map<string, WebRTCManager>());

  // To handle current joining process for host
  const pendingHostManager = useRef<WebRTCManager | null>(null);

  const hostClientRef = useRef<any>(null);

  // Signaling state
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [generatedPayload, setGeneratedPayload] = useState<string>('');
  const [scanningMode, setScanningMode] = useState<boolean>(false);
  const [audioListening, setAudioListening] = useState<boolean>(false);

  // Lobby
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode>('UnoLite');
  const [gameState, setGameState] = useState<any>(null);

  const selectedGameModeRef = useRef(selectedGameMode);
  const roleRef = useRef(role);
  const playerIdRef = useRef(playerId);
  const messagesRef = useRef(messages);
  const gameStateRef = useRef(gameState);

  useEffect(() => {
    selectedGameModeRef.current = selectedGameMode;
    roleRef.current = role;
    playerIdRef.current = playerId;
    messagesRef.current = messages;
    gameStateRef.current = gameState;
  }, [role, playerId, messages, gameState]);

  // Quiet Audio References
  const transmitNodeRef = useRef<any>(null);

  const stopAudioTransmission = () => {
    if (transmitNodeRef.current) {
      transmitNodeRef.current.destroy();
      transmitNodeRef.current = null;
    }
  };

  const startAudioTransmission = (payload: string) => {
    stopAudioTransmission();
    if (typeof window !== 'undefined' && (window as any).Quiet) {
      try {
        transmitNodeRef.current = (window as any).Quiet.transmitter({
          profile: 'ultrasonic-experimental',
          onFinish: function () {
            // Keep playing loop for the offer
            if (roleRef.current === 'HOST' && appState === 'SIGNALING_HOST') {
              startAudioTransmission(payload);
            } else if (roleRef.current === 'GUEST' && appState === 'SIGNALING_GUEST') {
              // Answer just broadcast a few times then stop
              startAudioTransmission(payload);
            }
          }
        });
        transmitNodeRef.current.transmit((window as any).Quiet.str2ab(payload));
      } catch (e) {
        console.warn("Quiet JS Transmission Error:", e);
      }
    }
  };

  const startAudioListening = (onReceive: (payload: string) => void) => {
    setAudioListening(true);
    if (typeof window !== 'undefined' && (window as any).Quiet) {
      try {
        (window as any).Quiet.receiver({
          profile: 'ultrasonic-experimental',
          onReceive: (recvPayload: ArrayBuffer) => {
            const str = (window as any).Quiet.ab2str(recvPayload);
            stopAudioListening();
            onReceive(str);
          },
          onCreateFail: (e: any) => console.log("Quiet JS Receiver Create Fail", e),
          onReceiveFail: (numFails: number) => { }
        });
      } catch (e) {
        console.warn("Quiet JS Listening Error:", e);
      }
    }
  };

  const stopAudioListening = () => {
    setAudioListening(false);
    if (typeof window !== 'undefined' && (window as any).Quiet) {
      try {
         (window as any).Quiet.disconnect();
      } catch (e) {}
    }
  };


  const getGameModule = (mode: GameMode) => {
    switch (mode) {
      case 'ZhengShangYou':
        return ZhengShangYouGame;
      case 'UnoLite':
      default:
        return UnoLiteGame;
    }
  };

  const broadcastSync = (state: any, connections: Map<string, WebRTCManager>) => {
    if (!state) return;
    connections.forEach((manager, guestId) => {
      const gameModule = getGameModule(selectedGameModeRef.current);
      const gameDef = gameModule(state.G.players || []);
      let safeState = state;
      if (gameDef.playerView) {
        safeState = {
          ...state,
          G: gameDef.playerView({
            G: state.G,
            ctx: state.ctx,
            playerID: guestId
          })
        };
      }
      manager.sendMessage(JSON.stringify({ type: 'SYNC', state: safeState }));
    });
  };

  // Setup guest handlers
  const setupGuestManager = (manager: WebRTCManager) => {
    manager.onMessageCallback = (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data.type === 'WELCOME') {
          setMessages(data.state?.messages || []);
        } else if (data.type === 'SYNC') {
          if (data.gameMode) {
            setSelectedGameMode(data.gameMode);
          }
          setGameState(data.state);
        }
      } catch (e) {
        setMessages((prev) => [...prev, `Remote: ${msg}`]);
      }
    };

    manager.onConnectionStateChangeCallback = (state) => {
      setConnectionStatus(state);
      if (state === 'connected') {
        stopAudioTransmission();
        stopAudioListening();
        setAppState('CONNECTED');
      }
    };

    manager.onDataChannelOpenCallback = () => {
      manager.sendMessage(JSON.stringify({
        type: 'HELLO',
        playerId: playerIdRef.current
      }));
    };
  };

  // Host setup pending manager handler
  const setupHostManager = (manager: WebRTCManager) => {
    manager.onMessageCallback = (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data.type === 'HELLO') {
          const gId = data.playerId;
          if (gId) {
            hostConnections.current.set(gId, manager);
            manager.sendMessage(JSON.stringify({ type: 'WELCOME', state: { messages: messagesRef.current } }));

            if (hostClientRef.current) {
               const currentState = hostClientRef.current.getState();
               const gameModule = getGameModule(selectedGameModeRef.current);
               const gameDef = gameModule(currentState.G.players || []);
               let safeState = currentState;
               if (gameDef.playerView) {
                 safeState = {
                   ...currentState,
                   G: gameDef.playerView({
                     G: currentState.G,
                     ctx: currentState.ctx,
                     playerID: gId
                   })
                 };
               }
               manager.sendMessage(JSON.stringify({ type: 'SYNC', state: safeState, gameMode: selectedGameModeRef.current }));
            }
          }
        } else if (data.type === 'MOVE') {
          if (hostClientRef.current) {
            const moveName = data.moveName;
            const args = data.args || [];
            const pIndex = gameStateRef.current?.G?.players.indexOf(data.playerId);
            if (pIndex !== undefined && pIndex !== -1) {
              hostClientRef.current.updatePlayerID(pIndex.toString());
              if (hostClientRef.current.moves[moveName]) {
                 hostClientRef.current.moves[moveName](...args);
              }
              const hIndex = gameStateRef.current?.G?.players.indexOf('host');
              if (hIndex !== undefined && hIndex !== -1) {
                hostClientRef.current.updatePlayerID(hIndex.toString());
              }
            }
          }
        }
      } catch (e) { }
    };

    manager.onConnectionStateChangeCallback = (state) => {
      setConnectionStatus(state);
      if (state === 'connected') {
        stopAudioTransmission();
        stopAudioListening();
        setGeneratedPayload('');

        // Prepare next manager automatically if someone joined
        prepareNextHostManager();
      }
    };
  };

  const startBoardGameHost = (playerIds: string[]) => {
    const gameModule = getGameModule(selectedGameModeRef.current);
    const gameDef = gameModule(playerIds);
    const engineGameDef = { ...gameDef };
    delete engineGameDef.playerView;

    const client = Client({
      game: engineGameDef as any,
      numPlayers: playerIds.length,
    });

    client.start();
    hostClientRef.current = client;

    const hIndex = playerIds.indexOf('host');
    if (hIndex !== -1) {
      client.updatePlayerID(hIndex.toString());
    }

    client.subscribe((state) => {
      if (!state) return;
      setGameState(state);
      broadcastSync(state, hostConnections.current);
    });

    const initialState = client.getState();
    setGameState(initialState);
    broadcastSync(initialState, hostConnections.current);
  };

  const handleHost = () => {
    initQuiet(
      () => console.log("Quiet initialized"),
      (err) => console.log("Quiet init failed", err)
    );
    setAppState('SIGNALING_HOST');
    setRole('HOST');
    setPlayerId('host');
    setMessages([]);
    setGeneratedPayload('');

    // Prepare first manager
    prepareNextHostManager();
  };

  const prepareNextHostManager = async () => {
    const manager = new WebRTCManager();
    setupHostManager(manager);
    pendingHostManager.current = manager;

    manager.onGeneratedPayloadCallback = (payload) => {
      setGeneratedPayload(payload);
      startAudioTransmission(payload);
    };

    await manager.generateOffer();
  };

  const handleGuest = () => {
    initQuiet(
      () => console.log("Quiet initialized"),
      (err) => console.log("Quiet init failed", err)
    );
    setAppState('SIGNALING_GUEST');
    setRole('GUEST');
    const newPlayerId = 'guest_' + Math.random().toString(36).substring(2, 9);
    setPlayerId(newPlayerId);
    setGeneratedPayload('');

    // Auto start listening for acoustic offer
    startAudioListening(onGuestReceivedOffer);
  };

  const onGuestReceivedOffer = async (payload: string) => {
    const manager = new WebRTCManager();
    setupGuestManager(manager);
    setGuestWebrtcManager(manager);

    manager.onGeneratedPayloadCallback = (answerPayload) => {
      setGeneratedPayload(answerPayload);
      startAudioTransmission(answerPayload);
    };

    const success = await manager.handleOfferAndGenerateAnswer(payload);
    if (!success) {
      alert("Failed to decode connection data");
      setGuestWebrtcManager(null);
    }
  };

  const onHostReceivedAnswer = async (payload: string) => {
    if (pendingHostManager.current) {
      const success = await pendingHostManager.current.handleAnswer(payload);
      if (success) {
        setScanningMode(false);
        stopAudioListening();
        // The data channel should open now.
        // We leave pendingHostManager to trigger its onConnectionStateChangeCallback
        // to handle state switches.
      } else {
        alert("Failed to set answer.");
      }
    }
  };


  const handleGameAction = (moveName: string, ...args: any[]) => {
    if (appState === 'SANDBOX') {
      if (hostClientRef.current) {
         hostClientRef.current.moves[moveName](...args);
      }
    } else if (appState === 'CONNECTED') {
      if (role === 'HOST') {
         if (hostClientRef.current) {
            const hIndex = gameState?.G?.players.indexOf('host');
            if (hIndex !== undefined && hIndex !== -1) {
              hostClientRef.current.updatePlayerID(hIndex.toString());
            }
            hostClientRef.current.moves[moveName](...args);
         }
      } else if (role === 'GUEST') {
        guestWebrtcManager?.sendMessage(JSON.stringify({
          type: 'MOVE',
          playerId: playerId,
          moveName,
          args
        }));
      }
    }
  };

  const startGameHost = () => {
    stopAudioTransmission();
    stopAudioListening();
    const allPlayers = ['host', ...Array.from(hostConnections.current.keys())];
    startBoardGameHost(allPlayers);
    setAppState('CONNECTED');
  };

  const cancelSignaling = () => {
    stopAudioTransmission();
    stopAudioListening();
    if (appState === 'SIGNALING_HOST') {
        if (pendingHostManager.current) pendingHostManager.current.close();
        hostConnections.current.forEach(m => m.close());
        hostConnections.current.clear();
    }
    if (appState === 'SIGNALING_GUEST') guestWebrtcManager?.close();
    setAppState('HOME');
  };

  const renderLanguageSwitcher = () => (
    <View style={styles.languageSwitcher}>
      <Text style={styles.languageLabel}>{t('lobby.language') || 'Lang'}</Text>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        <Button title="中文" onPress={() => i18n.changeLanguage('zh')} color={i18n.language === 'zh' ? '#007AFF' : '#999'} />
        <Button title="EN" onPress={() => i18n.changeLanguage('en')} color={i18n.language === 'en' ? '#007AFF' : '#999'} />
        <Button title="日本語" onPress={() => i18n.changeLanguage('ja')} color={i18n.language === 'ja' ? '#007AFF' : '#999'} />
      </View>
    </View>
  );

  const renderHome = () => {
    return (
      <View style={styles.content}>
        <View style={styles.topRightControls}>
          {renderLanguageSwitcher()}
        </View>
        <Text style={styles.title}>{t('lobby.title') || 'Offline Cards'}</Text>
        <Text style={styles.subtitle}>Geek Mode: Ultrasonic + QR Offline Sync</Text>
        <View style={styles.buttonContainer}>
          <View style={{ marginBottom: 20 }}>
             <Text style={{ textAlign: 'center', marginBottom: 10, fontWeight: 'bold' }}>{t('lobby.selectGame') || 'Select Game'}</Text>
             <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                <Button
                   title={t('lobby.game_UnoLite') || 'Uno'}
                   onPress={() => setSelectedGameMode('UnoLite')}
                   color={selectedGameMode === 'UnoLite' ? '#007AFF' : '#999'}
                />
                <Button
                   title={t('lobby.game_ZhengShangYou') || 'ZhengShangYou'}
                   onPress={() => setSelectedGameMode('ZhengShangYou')}
                   color={selectedGameMode === 'ZhengShangYou' ? '#007AFF' : '#999'}
                />
             </View>
          </View>
          <Button title={t('lobby.createRoom') || 'Create Room (Host)'} onPress={handleHost} />
          <View style={{ height: 20 }} />
          <Button title={t('lobby.joinRoom') || 'Join Room (Guest)'} onPress={handleGuest} />

          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <Text style={{ textAlign: 'center', marginBottom: 10, color: 'gray' }}>Local Debug Sandbox</Text>
            <Button title="Enter Local Sandbox" color="purple" onPress={() => {
              setAppState('SANDBOX');
              setPlayerId('host');
              const players = ['host', 'guest_1'];
              startBoardGameHost(players);
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
        onExit={() => {
          if(hostClientRef.current) { hostClientRef.current.stop(); hostClientRef.current = null; }
          setGameState(null);
          setAppState('HOME');
        }}
        onReset={() => {
          if(hostClientRef.current) hostClientRef.current.stop();
          startBoardGameHost(['host', 'guest_1']);
        }}
        isSandbox={true}
      />
    );
  };

  const renderSignaling = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>
        {appState === 'SIGNALING_HOST' ? 'Host Mode (Add Player)' : 'Guest Mode (Join Table)'}
      </Text>

      <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>

        {/* HOST STATE */}
        {appState === 'SIGNALING_HOST' && (
          <View style={styles.section}>
            <Text style={{ fontSize: 16, marginBottom: 10, textAlign: 'center' }}>
              Host: Broadcasting Connection Offer
            </Text>
            {generatedPayload ? (
              <View style={{alignItems: 'center', marginBottom: 20}}>
                <QRCode value={generatedPayload} size={250} />
                <Text style={{color: 'green', marginTop: 10}}>🔊 Playing Ultrasonic Offer...</Text>
              </View>
            ) : (
              <Text>Generating SDP Offer...</Text>
            )}

            <View style={{marginVertical: 20, width: '100%', alignItems: 'center'}}>
               <Text>Waiting for Guest Answers...</Text>
               <Text>Connected Guests: {hostConnections.current.size}</Text>
               <View style={{marginTop: 10, gap: 10}}>
                  {!scanningMode && (
                      <View style={{gap: 10}}>
                        <Button title="Listen for Ultrasonic Answer" onPress={() => {setScanningMode(false); startAudioListening(onHostReceivedAnswer); }} />
                        <Button title="Scan Guest Answer QR" onPress={() => {setScanningMode(true); stopAudioListening(); }} />
                      </View>
                  )}
                  {scanningMode && (
                    <QRScanner
                      onScan={(data) => { onHostReceivedAnswer(data); }}
                      onCancel={() => { setScanningMode(false); }}
                    />
                  )}
                  {audioListening && (
                    <Text style={{color: 'green', marginTop: 10}}>🔊 Listening for Ultrasonic Answer...</Text>
                  )}
               </View>
            </View>
          </View>
        )}

        {/* GUEST STATE */}
        {appState === 'SIGNALING_GUEST' && (
          <View style={styles.section}>
             {/* Not received offer yet */}
             {!generatedPayload && (
                <View style={{alignItems: 'center', width: '100%'}}>
                   <Text style={{ fontSize: 16, marginBottom: 10 }}>Step 1: Receive Host Offer</Text>
                   <Text style={{color: audioListening ? 'green' : 'gray', marginBottom: 20}}>
                      {audioListening ? "🔊 Listening for Ultrasonic Offer..." : "Mic inactive"}
                   </Text>

                   {!scanningMode ? (
                      <View style={{gap: 10}}>
                        <Button title="Scan Host QR Offer" onPress={() => {setScanningMode(true); stopAudioListening(); }} />
                        {!audioListening && <Button title="Listen for Ultrasonic Offer" onPress={() => startAudioListening(onGuestReceivedOffer)} />}
                      </View>
                   ) : (
                      <QRScanner
                        onScan={(data) => { setScanningMode(false); onGuestReceivedOffer(data); }}
                        onCancel={() => {setScanningMode(false); startAudioListening(onGuestReceivedOffer);}}
                      />
                   )}
                </View>
             )}

             {/* Received offer, generated answer */}
             {generatedPayload && (
                 <View style={{alignItems: 'center', width: '100%'}}>
                   <Text style={{ fontSize: 16, marginBottom: 10 }}>Step 2: Present Answer to Host</Text>
                   <QRCode value={generatedPayload} size={250} />
                   <Text style={{color: 'green', marginTop: 10}}>🔊 Playing Ultrasonic Answer...</Text>
                   <Text style={{marginTop: 10, color: 'gray'}}>Status: {connectionStatus}</Text>
                 </View>
             )}
          </View>
        )}
      </View>

      <View style={{ marginTop: 20, width: '100%', maxWidth: 300 }}>
        {appState === 'SIGNALING_HOST' && hostConnections.current.size > 0 && (
          <View style={{ marginBottom: 10 }}>
             <Button title={`Start Game (${hostConnections.current.size + 1} players)`} onPress={startGameHost} color="green" />
          </View>
        )}
        <Button title="Cancel" onPress={cancelSignaling} color="red" />
      </View>
    </ScrollView>
  );

  const renderConnected = () => {
    if (!gameState) {
      return (
        <View style={styles.content}>
          <Text style={styles.title}>Waiting for Table State...</Text>
          <Button title="Exit" onPress={cancelSignaling} color="red" />
        </View>
      );
    }

    return (
      <View style={styles.sandboxContainer}>
        <GameBoard
          gameState={gameState}
          myPlayerId={playerId}
          onAction={handleGameAction}
          onExit={() => {
            if (role === 'HOST') {
              if (hostClientRef.current) { hostClientRef.current.stop(); hostClientRef.current = null; }
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
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRightControls: {
    position: 'absolute',
    top: 20,
    right: 20,
    alignItems: 'flex-end',
    zIndex: 10,
  },
  languageSwitcher: {
    alignItems: 'flex-end',
  },
  languageLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
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

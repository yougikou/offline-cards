import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, TextInput, ScrollView, Platform, TouchableOpacity, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import './src/i18n/index'; // Initialize i18n
import { WebRTCManager } from './src/webrtc';
import Scanner from './src/components/Scanner';
import QRCodeDisplay from './src/components/QRCodeDisplay';
import GameBoard from './src/components/GameBoard';
import { UnoLiteGame } from './src/game-modules/unoLite';
import { ZhengShangYouGame } from './src/game-modules/ZhengShangYou';
import { Client } from 'boardgame.io/client';
import { Storage } from './src/storage';

type AppState = 'HOME' | 'SIGNALING_HOST' | 'SIGNALING_GUEST' | 'CONNECTED' | 'SANDBOX';
type GameMode = 'UnoLite' | 'ZhengShangYou';
type Role = 'HOST' | 'GUEST' | null;

// Replace GameAction with the boardgame.io specific action type
export interface BgioAction {
  type: string;
  moveName: string;
  args: any[];
}

export default function App() {
  const { t, i18n } = useTranslation();
  const [appState, setAppState] = useState<AppState>('HOME');
  const [role, setRole] = useState<Role>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>(''); // For guests it's their ID, for host it's 'host'

  const [messages, setMessages] = useState<string[]>([]);

  // Guest uses a single connection manager
  const [guestWebrtcManager, setGuestWebrtcManager] = useState<WebRTCManager | null>(null);

  // Host uses a pool of connection managers mapped by guest ID
  // For signaling we need a "pending" manager that hasn't been assigned an ID yet
  const [pendingHostManager, setPendingHostManager] = useState<WebRTCManager | null>(null);
  const hostConnections = useRef(new Map<string, WebRTCManager>());
  const [connectedGuests, setConnectedGuests] = useState<string[]>([]);

  // boardgame.io Host Client
  const hostClientRef = useRef<any>(null);

  // Signaling state
  const [qrValue, setQrValue] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [showMode, setShowMode] = useState<'qr' | 'scanner'>('qr');

  // Lobby
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode>('UnoLite');

  // Sandbox & Game state is now boardgame.io full state { G, ctx, plugins, ... }
  const [gameState, setGameState] = useState<any>(null);

  // Persistence helpers
  const saveHostState = async (id: string, msgs: string[]) => {
    await Storage.setItem('hostRoomId', id);
    await Storage.setItem('hostState', JSON.stringify({ messages: msgs }));
  };

  const saveGuestState = async (rId: string, pId: string) => {
    await Storage.setItem('guestRoomId', rId);
    await Storage.setItem('guestPlayerId', pId);
  };

  const clearStorage = async () => {
    await Storage.multiRemove(['hostRoomId', 'hostState', 'guestRoomId', 'guestPlayerId']);
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

  // Helper to send game syncs to all connected guests
  const broadcastSync = (state: any, connections: Map<string, WebRTCManager>) => {
    if (!state) return;
    connections.forEach((manager, guestId) => {
      // Delegate state sanitization to the active game module's playerView
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

  const roleRef = useRef(role);
  const roomIdRef = useRef(roomId);
  const playerIdRef = useRef(playerId);
  const messagesRef = useRef(messages);
  const gameStateRef = useRef(gameState);
  const selectedGameModeRef = useRef(selectedGameMode);
  const appStateRef = useRef(appState);

  useEffect(() => {
    selectedGameModeRef.current = selectedGameMode;
    roleRef.current = role;
    roomIdRef.current = roomId;
    playerIdRef.current = playerId;
    messagesRef.current = messages;
    gameStateRef.current = gameState;
    appStateRef.current = appState;
  }, [role, roomId, playerId, messages, gameState, appState]);

  // Handle Guest Connection
  useEffect(() => {
    if (role !== 'GUEST' || !guestWebrtcManager) return;

    const manager = guestWebrtcManager;

    manager.onMessageCallback = (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data.type === 'WELCOME') {
          setMessages(data.state?.messages || []);
          if (data.roomId) {
            setRoomId(data.roomId);
            saveGuestState(data.roomId, playerIdRef.current);
          }
        } else if (data.type === 'SYNC') {
          if (data.gameMode) {
            setSelectedGameMode(data.gameMode);
          }
          setGameState(data.state);
        } else if (data.type === 'HOST_CLOSE') {
          alert('Host closed the game. Returning to lobby.');
          if (guestWebrtcManager) {
            guestWebrtcManager.close();
          }
          setGuestWebrtcManager(null);
          setAppState('HOME');
          setGameState(null);
        }
      } catch (e) {
        setMessages((prev) => [...prev, `Remote: ${msg}`]);
      }
    };

    manager.onConnectionStateChangeCallback = (state) => {
      setConnectionStatus(state);
      if (state === 'connected') {
        setAppState('CONNECTED');
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        if (appStateRef.current === 'CONNECTED' || appStateRef.current === 'SIGNALING_GUEST') {
          alert('Disconnected from host.');
          setAppState('HOME');
          setGameState(null);
          setGuestWebrtcManager(null);
        }
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
            setConnectedGuests(Array.from(hostConnections.current.keys()));
            manager.sendMessage(JSON.stringify({ type: 'WELCOME', roomId: roomIdRef.current, state: { messages: messagesRef.current } }));

            // With boardgame.io, we shouldn't dynamically add players mid-game easily in this simple setup.
            // Ideally, all players join during the HOST signaling phase, then we start the client.
            // If the game is already running, sync it.
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
          // Action from guest
          if (hostClientRef.current) {
            // boardgame.io moves must be called as: client.moves[moveName](...args)
            // But we also need to ensure it's the right player's turn. boardgame.io client exposes a generic `update` or we can just call the move.
            // Wait, hostClient is running as a single local instance. We need to tell it WHICH player is making the move if we use a multiplexed client,
            // or we must update playerID before making the move if we use a single client.

            // To properly execute a move on behalf of a guest using a local client:
            const moveName = data.moveName;
            const args = data.args || [];

            // Temporary set playerID on the client to match the guest making the move
            const pIndex = gameStateRef.current?.G?.players.indexOf(data.playerId);
            if (pIndex !== undefined && pIndex !== -1) {
              hostClientRef.current.updatePlayerID(pIndex.toString());
              if (hostClientRef.current.moves[moveName]) {
                hostClientRef.current.moves[moveName](...args);
              }
              // Switch back to host id
              const hIndex = gameStateRef.current?.G?.players.indexOf('host');
              if (hIndex !== undefined && hIndex !== -1) {
                hostClientRef.current.updatePlayerID(hIndex.toString());
              }
            }
          }
        } else if (data.type === 'PLAYER_LEAVE') {
          const gId = data.playerId;
          alert(`Player ${gId} has explicitly left the game (Forfeit).`);
          if (hostClientRef.current && hostClientRef.current.moves.leaveGame) {
            const state = hostClientRef.current.getState();
            if (state && state.ctx) {
              hostClientRef.current.updatePlayerID(state.ctx.currentPlayer);
              hostClientRef.current.moves.leaveGame(gId);
              const hIndex = state.G.players.indexOf('host');
              if (hIndex !== -1) hostClientRef.current.updatePlayerID(hIndex.toString());
            }
          }
        }
      } catch (e) {
        // Ignored
      }
    };

    manager.onConnectionStateChangeCallback = (state) => {
      setConnectionStatus(state);
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        let leftGuestId = null;
        for (const [id, m] of hostConnections.current.entries()) {
          if (m === manager) {
            leftGuestId = id;
            break;
          }
        }
        if (leftGuestId) {
          hostConnections.current.delete(leftGuestId);
          setConnectedGuests(Array.from(hostConnections.current.keys()));
          alert(`Player ${leftGuestId} disconnected.`);
          if (hostClientRef.current && hostClientRef.current.moves.leaveGame) {
            const state = hostClientRef.current.getState();
            if (state && state.ctx) {
              hostClientRef.current.updatePlayerID(state.ctx.currentPlayer);
              hostClientRef.current.moves.leaveGame(leftGuestId);
              const hIndex = state.G.players.indexOf('host');
              if (hIndex !== -1) hostClientRef.current.updatePlayerID(hIndex.toString());
            }
          }
        }
      }
    };

    manager.onDataChannelOpenCallback = () => {
      // Don't auto-transition to connected here if we want to wait for "Start Game".
      // But we can let them connect and wait in the lobby.
      // We are leaving the Host in SIGNALING_HOST until they manually click "Start Game".
    };
  };

  const startBoardGameHost = (playerIds: string[]) => {
    const gameModule = getGameModule(selectedGameModeRef.current);
    const gameDef = gameModule(playerIds);
    // Remove playerView from the local host engine client so it holds the unstripped authoritative state
    const engineGameDef = { ...gameDef };
    delete engineGameDef.playerView;

    const client = Client({
      game: engineGameDef as any,
      numPlayers: playerIds.length,
      // No multiplayer wrapper - we run purely local and sync state manually!
    });

    client.start();
    hostClientRef.current = client;

    // Set host's string ID as the current playerID to respect boardgame.io's playerView if we were using it
    const hIndex = playerIds.indexOf('host');
    if (hIndex !== -1) {
      client.updatePlayerID(hIndex.toString());
    }

    client.subscribe((state) => {
      if (!state) return;
      setGameState(state);
      broadcastSync(state, hostConnections.current);
    });

    // Initial state set
    const initialState = client.getState();
    setGameState(initialState);
    broadcastSync(initialState, hostConnections.current);
  };

  const handleHost = async (resume: boolean = false) => {
    setAppState('SIGNALING_HOST');
    setRole('HOST');
    setPlayerId('host'); // Fixed ID for the host player

    if (!resume) {
      const newRoomId = Math.random().toString(36).substring(2, 9);
      setRoomId(newRoomId);
      setMessages([]);
      setConnectedGuests([]);
      clearStorage();
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
        // Do not jump to CONNECTED immediately. Let Host gather players, then click Start Game.
        setQrValue('');
      } else if (appState === 'SIGNALING_GUEST' && guestWebrtcManager) {
        const answerStr = await guestWebrtcManager.acceptOfferAndCreateAnswer(scannedText);
        setQrValue(answerStr);
        setShowMode('qr');
      }
    } catch (e) {
      console.error("Signaling Error:", e);
      alert(t('lobby.errorSignaling') + String(e));
      setAppState('HOME');
    }
  };

  const handleGameAction = (moveName: string, ...args: any[]) => {
    if (appState === 'SANDBOX') {
      if (hostClientRef.current) {
        // In sandbox, we just execute the move on the local client without playerID impersonation
        // Actually, if we play as different players in sandbox, we should impersonate:
        // For now, assume we just call the move. boardgame.io will validate it against ctx.currentPlayer
        hostClientRef.current.moves[moveName](...args);
      }
    } else if (appState === 'CONNECTED') {
      if (role === 'HOST') {
        if (hostClientRef.current) {
          // Make sure host playerID is set
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
    const allPlayers = ['host', ...Array.from(hostConnections.current.keys())];
    startBoardGameHost(allPlayers);
    setAppState('CONNECTED');
  };

  const renderLanguageSwitcher = () => (
    <View style={styles.languageSwitcher}>
      <Text style={styles.languageLabel}>{t('lobby.language')}</Text>
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
        <Text style={styles.title}>{t('lobby.title')}</Text>
        <Text style={styles.subtitle}>{t('lobby.subtitle')}</Text>
        <View style={styles.buttonContainer}>
          <View style={{ marginBottom: 20 }}>
            <Text style={{ textAlign: 'center', marginBottom: 10, fontWeight: 'bold' }}>{t('lobby.selectGame')}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
              <Button
                title={t('lobby.game_UnoLite')}
                onPress={() => setSelectedGameMode('UnoLite')}
                color={selectedGameMode === 'UnoLite' ? '#007AFF' : '#999'}
              />
              <Button
                title={t('lobby.game_ZhengShangYou')}
                onPress={() => setSelectedGameMode('ZhengShangYou')}
                color={selectedGameMode === 'ZhengShangYou' ? '#007AFF' : '#999'}
              />
            </View>
          </View>
          <Button title={t('lobby.createRoom')} onPress={() => handleHost(false)} />
          <View style={{ height: 20 }} />
          <Button title={t('lobby.joinRoom')} onPress={() => handleGuest(false)} />

          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <Text style={{ textAlign: 'center', marginBottom: 10, color: 'gray' }}>{t('lobby.localTesting')}</Text>
            <Button title={t('lobby.sandboxTesting')} color="purple" onPress={() => {
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
          const doExit = () => {
            if (hostClientRef.current) { hostClientRef.current.stop(); hostClientRef.current = null; }
            setGameState(null);
            setAppState('HOME');
          };
          const msg = t('game.exitConfirmHost');
          if (Platform.OS === 'web') {
            if (window.confirm(msg)) doExit();
          } else {
            setTimeout(() => {
              Alert.alert(
                t('game.exitConfirmTitle'),
                msg,
                [
                  { text: t('game.cancel'), style: 'cancel' },
                  { text: t('game.confirm'), style: 'destructive', onPress: doExit }
                ]
              );
            }, 300);
          }
        }}
        onReset={() => {
          if (hostClientRef.current) hostClientRef.current.stop();
          startBoardGameHost(['host', 'guest_1']);
        }}
        isSandbox={true}
      />
    );
  };

  const renderSignaling = () => (
    <View style={styles.content}>
      <Text style={styles.title}>
        {appState === 'SIGNALING_HOST' ? t('lobby.hostMode') : t('lobby.guestMode')}
      </Text>

      {qrValue && isScanning && (
        <View style={{ flexDirection: 'row', marginBottom: 10, gap: 10 }}>
          <Button title={t('lobby.showMyQR')} onPress={() => setShowMode('qr')} color={showMode === 'qr' ? '#007AFF' : '#999'} />
          <Button title={t('lobby.scanOtherQR')} onPress={() => setShowMode('scanner')} color={showMode === 'scanner' ? '#007AFF' : '#999'} />
        </View>
      )}

      <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        {appState === 'SIGNALING_HOST' && connectedGuests.length > 0 && (
          <View style={{ marginBottom: 20, width: '100%', alignItems: 'center', backgroundColor: '#e0f7fa', padding: 10, borderRadius: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 5, color: '#006064' }}>
              {t('lobby.connectedPlayers', '已连接玩家 / Connected Players')} ({connectedGuests.length}):
            </Text>
            {connectedGuests.map((guestId) => (
              <Text key={guestId} style={{ fontSize: 14, color: '#004d40', marginVertical: 2 }}>
                👤 {guestId}
              </Text>
            ))}
          </View>
        )}

        {showMode === 'qr' && qrValue ? (
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={{ marginBottom: 10, textAlign: 'center' }}>{t('lobby.showQRToOther')}</Text>
            <QRCodeDisplay value={qrValue} />
          </View>
        ) : null}

        {showMode === 'scanner' && isScanning ? (
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={{ marginBottom: 10, textAlign: 'center' }}>{t('lobby.scanOtherDeviceQR')}</Text>
            <Scanner onScan={handleScanSuccess} />
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: 20, width: '100%', maxWidth: 300 }}>
        {appState === 'SIGNALING_HOST' && (
          <View style={{ marginBottom: 10 }}>
            <Button title={t('lobby.addAnotherPlayer')} onPress={startNewHostPendingConnection} color="blue" />
          </View>
        )}
        {appState === 'SIGNALING_HOST' && (
          <View style={{ marginBottom: 10 }}>
            <Button title={t('lobby.startGame', { count: hostConnections.current.size + 1 })} onPress={startGameHost} color="green" />
          </View>
        )}
        <Button title={t('lobby.cancel')} onPress={() => {
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
          <Text style={styles.title}>{t('lobby.waitingForState')}</Text>
          <Button title={t('lobby.exit')} onPress={() => {
            setAppState('HOME');
          }} color="red" />
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
            const isHost = role === 'HOST';
            const msg = isHost ? t('game.exitConfirmHost') : t('game.exitConfirmGuest');

            const doExit = () => {
              if (isHost) {
                if (hostClientRef.current) { hostClientRef.current.stop(); hostClientRef.current = null; }
                hostConnections.current.forEach(m => {
                  try { m.sendMessage(JSON.stringify({ type: 'HOST_CLOSE' })); } catch (e) { }
                  setTimeout(() => m.close(), 100);
                });
                hostConnections.current.clear();
                setConnectedGuests([]);
                setAppState('HOME');
                setGameState(null);
              } else {
                if (guestWebrtcManager) {
                  try {
                    guestWebrtcManager.sendMessage(JSON.stringify({ type: 'PLAYER_LEAVE', playerId }));
                  } catch (e) { }
                  setTimeout(() => {
                    guestWebrtcManager.close();
                    setGuestWebrtcManager(null);
                    setAppState('HOME');
                    setGameState(null);
                  }, 100);
                }
              }
            };

            if (Platform.OS === 'web') {
              if (window.confirm(msg)) doExit();
            } else {
              setTimeout(() => {
                Alert.alert(
                  t('game.exitConfirmTitle'),
                  msg,
                  [
                    { text: t('game.cancel'), style: 'cancel' },
                    { text: t('game.confirm'), style: 'destructive', onPress: doExit }
                  ]
                );
              }, 300);
            }
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

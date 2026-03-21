import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, TextInput, ScrollView, Platform, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
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
  const [sandboxPlayerCount, setSandboxPlayerCount] = useState<number>(3);

  // Language Dropdown state
  const [languageMenuVisible, setLanguageMenuVisible] = useState<boolean>(false);

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
  }, [selectedGameMode, role, roomId, playerId, messages, gameState, appState]);

  // Broadcast game mode changes from Host to connected Guests during active game (e.g. at Game Over screen)
  useEffect(() => {
    if (appState === 'CONNECTED' && role === 'HOST') {
      hostConnections.current.forEach(manager => {
        try {
          manager.sendMessage(JSON.stringify({ type: 'GAME_MODE_CHANGE', gameMode: selectedGameMode }));
        } catch (e) {
          // ignore error
        }
      });
    }
  }, [selectedGameMode, appState, role]);

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
        } else if (data.type === 'GAME_MODE_CHANGE') {
          if (data.gameMode) {
            setSelectedGameMode(data.gameMode);
          }
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
        // In sandbox hotseat mode, we must impersonate the active player before calling the move
        const currentPlayerIndex = gameStateRef.current?.ctx?.currentPlayer;
        if (currentPlayerIndex !== undefined) {
          hostClientRef.current.updatePlayerID(currentPlayerIndex);
        }
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

  const renderLanguageSwitcher = () => {
    const currentLangLabel = i18n.language === 'zh' ? '中文' : i18n.language === 'ja' ? '日本語' : 'English';
    return (
      <View style={styles.languageSwitcher}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.languageDropdownButton}
          onPress={() => setLanguageMenuVisible(!languageMenuVisible)}
        >
          <Text style={styles.languageDropdownText}>🌐 {currentLangLabel} ▼</Text>
        </TouchableOpacity>

        {languageMenuVisible && (
          <View style={styles.languageDropdownMenu}>
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.languageDropdownItem, i18n.language === 'zh' && styles.languageDropdownItemSelected]}
              onPress={() => { i18n.changeLanguage('zh'); setLanguageMenuVisible(false); }}
            >
              <Text style={[styles.languageDropdownItemText, i18n.language === 'zh' && styles.languageDropdownItemTextSelected]}>中文</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.languageDropdownItem, i18n.language === 'en' && styles.languageDropdownItemSelected]}
              onPress={() => { i18n.changeLanguage('en'); setLanguageMenuVisible(false); }}
            >
              <Text style={[styles.languageDropdownItemText, i18n.language === 'en' && styles.languageDropdownItemTextSelected]}>English</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.languageDropdownItem, i18n.language === 'ja' && styles.languageDropdownItemSelected]}
              onPress={() => { i18n.changeLanguage('ja'); setLanguageMenuVisible(false); }}
            >
              <Text style={[styles.languageDropdownItemText, i18n.language === 'ja' && styles.languageDropdownItemTextSelected]}>日本語</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderHome = () => {
    return (
      <View style={styles.content}>
        <View style={styles.topRightControls}>
          {renderLanguageSwitcher()}
        </View>

        <View style={styles.heroSection}>
          <Text style={styles.title}>{t('lobby.title', 'Offline Cards')}</Text>
          <Text style={styles.subtitle}>{t('lobby.subtitle', 'Serverless peer-to-peer local multiplayer')}</Text>
        </View>

        <View style={styles.homeContainer}>

          {/* Game Library */}
          <View style={styles.librarySection}>
            <Text style={styles.sectionTitle}>{t('lobby.selectGame', 'Game Library')}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gameCarousel}>
              {[
                { id: 'UnoLite', name: t('lobby.game_UnoLite', 'UnoLite'), tags: ['2-8P', 'Family'], available: true, icon: '🃏' },
                { id: 'ZhengShangYou', name: t('lobby.game_ZhengShangYou', 'ZhengShangYou'), tags: ['2-4P', 'Strategy'], available: true, icon: '♠️' },
                { id: 'DouDiZhu', name: '斗地主 / Dou Di Zhu', tags: ['3P', 'Classic'], available: false, icon: '👨‍🌾' },
              ].map(game => (
                <TouchableOpacity
                  key={game.id}
                  accessibilityRole="button"
                  style={[
                    styles.gameCard,
                    selectedGameMode === game.id && styles.gameCardSelected,
                    !game.available && styles.gameCardDisabled
                  ]}
                  onPress={() => game.available && setSelectedGameMode(game.id as GameMode)}
                  disabled={!game.available}
                >
                  <Text style={styles.gameCardIcon}>{game.icon}</Text>
                  <Text style={[styles.gameCardTitle, selectedGameMode === game.id && styles.gameCardTitleSelected]}>{game.name}</Text>
                  <View style={styles.tagContainer}>
                    {game.tags.map(tag => (
                      <View key={tag} style={styles.tagBadge}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                  {!game.available && (
                    <View style={styles.comingSoonBadge}>
                      <Text style={styles.comingSoonText}>Coming Soon</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.sectionDivider} />

          {/* Primary Action: Host Room */}
          <TouchableOpacity accessibilityRole="button" style={styles.joinGlobalButton} onPress={() => handleHost(false)}>
            <View style={styles.joinGlobalIconContainer}>
              <Text style={styles.joinGlobalIcon}>🌐</Text>
            </View>
            <View style={styles.joinGlobalTextContainer}>
              <Text style={styles.joinGlobalButtonText}>
                {t('lobby.createRoom', 'Host Room')} - {selectedGameMode === 'UnoLite' ? t('lobby.game_UnoLite') : t('lobby.game_ZhengShangYou')}
              </Text>
              <Text style={styles.joinGlobalSubText}>{t('lobby.hostDesc', 'Play with friends via Wi-Fi/QR')}</Text>
            </View>
          </TouchableOpacity>

          {/* Secondary Action Modes (Join / Sandbox) */}
          <View style={[styles.actionModesPanel, { marginTop: 15 }]}>
            <View style={styles.actionCardsRow}>
              {/* Join Room Card */}
              <TouchableOpacity accessibilityRole="button" style={[styles.actionModeCard, { borderColor: '#4CAF50' }]} onPress={() => handleGuest(false)}>
                <Text style={styles.actionModeIcon}>📡</Text>
                <Text style={styles.actionModeName}>{t('lobby.joinRoom', 'Join Room')}</Text>
                <Text style={styles.actionModeDesc}>{t('lobby.joinRoomSub', 'Scan QR or enter code')}</Text>
              </TouchableOpacity>

              {/* Practice Locally Card */}
              <View style={[styles.actionModeCard, { borderColor: '#9C27B0' }]}>
                <TouchableOpacity accessibilityRole="button" style={{ alignItems: 'center', flex: 1, width: '100%' }} onPress={() => {
                  setAppState('SANDBOX');
                  setPlayerId('player_1');
                  const players = Array.from({ length: sandboxPlayerCount }, (_, i) => `player_${i + 1}`);
                  startBoardGameHost(players);
                }}>
                  <Text style={styles.actionModeIcon}>🤖</Text>
                  <Text style={styles.actionModeName}>{t('lobby.sandboxTesting', 'Practice Locally')}</Text>
                  <Text style={styles.actionModeDesc}>{t('lobby.sandboxDesc', 'Play against yourself')}</Text>
                </TouchableOpacity>
                <View style={styles.playerCountControl}>
                  <TouchableOpacity onPress={() => setSandboxPlayerCount(Math.max(1, sandboxPlayerCount - 1))} style={styles.countBtn}><Text style={styles.countBtnText}>-</Text></TouchableOpacity>
                  <Text style={styles.countText}>{sandboxPlayerCount}P</Text>
                  <TouchableOpacity onPress={() => setSandboxPlayerCount(Math.min(8, sandboxPlayerCount + 1))} style={styles.countBtn}><Text style={styles.countBtnText}>+</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

        </View>
      </View>
    );
  };

  const renderSandbox = () => {
    if (!gameState) return null;
    const activePlayerId = gameState.G.players[parseInt(gameState.ctx.currentPlayer, 10)];
    return (
      <View style={{ flex: 1, backgroundColor: '#2E7D32' }}>
        <View style={{ backgroundColor: '#FFD700', padding: 5, alignItems: 'center', zIndex: 1000, elevation: 1000 }}>
          <Text style={{ fontWeight: 'bold', color: 'black' }}>
            🛠 沙盒测试模式 | 当前扮演: {activePlayerId}
          </Text>
        </View>
        <GameBoard
          gameState={gameState}
          myPlayerId={activePlayerId}
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
            const players = Array.from({ length: sandboxPlayerCount }, (_, i) => `player_${i + 1}`);
            startBoardGameHost(players);
          }}
          isSandbox={true}
          selectedGameMode={selectedGameMode}
          onGameModeChange={setSelectedGameMode}
        />
      </View>
    );
  };

  const renderSignaling = () => (
    <View style={styles.content}>
      <Text style={styles.title}>
        {appState === 'SIGNALING_HOST' ? t('lobby.hostMode') : t('lobby.guestMode')}
      </Text>

      {qrValue && isScanning && (
        <View style={styles.segmentControl}>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.segmentButton, showMode === 'qr' && styles.segmentButtonActive]}
            onPress={() => setShowMode('qr')}
          >
            <Text style={[styles.segmentButtonText, showMode === 'qr' && styles.segmentButtonTextActive]}>{t('lobby.showMyQR')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.segmentButton, showMode === 'scanner' && styles.segmentButtonActive]}
            onPress={() => setShowMode('scanner')}
          >
            <Text style={[styles.segmentButtonText, showMode === 'scanner' && styles.segmentButtonTextActive]}>{t('lobby.scanOtherQR')}</Text>
          </TouchableOpacity>
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
            <Text style={styles.instructionText}>{t('lobby.showQRToOther')}</Text>
            <QRCodeDisplay value={qrValue} />
          </View>
        ) : null}

        {showMode === 'scanner' && isScanning ? (
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.instructionText}>{t('lobby.scanOtherDeviceQR')}</Text>
            <Scanner onScan={handleScanSuccess} />
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: 20, width: '100%', maxWidth: 300, gap: 12 }}>
        {appState === 'SIGNALING_HOST' && (
          <TouchableOpacity accessibilityRole="button" style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={startNewHostPendingConnection}>
            <Text style={styles.actionBtnSecondaryText}>➕ {t('lobby.addAnotherPlayer')}</Text>
          </TouchableOpacity>
        )}
        {appState === 'SIGNALING_HOST' && (
          <TouchableOpacity accessibilityRole="button" style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={startGameHost}>
            <Text style={styles.actionBtnText}>🚀 {t('lobby.startGame', { count: hostConnections.current.size + 1 })}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity accessibilityRole="button" style={[styles.actionBtn, styles.actionBtnDestructive]} onPress={() => {
          if (appState === 'SIGNALING_HOST') pendingHostManager?.close();
          if (appState === 'SIGNALING_GUEST') guestWebrtcManager?.close();
          setAppState('HOME');
        }}>
          <Text style={styles.actionBtnText}>✕ {t('lobby.cancel')}</Text>
        </TouchableOpacity>
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
          onReset={role === 'HOST' ? () => {
            if (hostClientRef.current) { hostClientRef.current.stop(); hostClientRef.current = null; }
            const allPlayers = ['host', ...Array.from(hostConnections.current.keys())];
            startBoardGameHost(allPlayers);
          } : undefined}
          selectedGameMode={selectedGameMode}
          onGameModeChange={setSelectedGameMode}
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
          isGuest={role === 'GUEST'}
        />
      </View>
    );
  };

  const isGameMode = appState === 'CONNECTED' || appState === 'SANDBOX';
  const bgColor = isGameMode ? '#2E7D32' : '#f5f5f5';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColor }]}>
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <StatusBar hidden={true} />
        {appState === 'HOME' && renderHome()}
        {(appState === 'SIGNALING_HOST' || appState === 'SIGNALING_GUEST') && renderSignaling()}
        {appState === 'CONNECTED' && renderConnected()}
        {appState === 'SANDBOX' && renderSandbox()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 'max(env(safe-area-inset-top), 16px)' as any : 0,
    paddingBottom: Platform.OS === 'web' ? 'max(env(safe-area-inset-bottom), 16px)' as any : 0,
    paddingLeft: Platform.OS === 'web' ? 'env(safe-area-inset-left)' as any : 0,
    paddingRight: Platform.OS === 'web' ? 'env(safe-area-inset-right)' as any : 0,
  },
  container: {
    flex: 1,
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
    position: 'relative',
  },
  languageLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  languageDropdownButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  languageDropdownText: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
  },
  languageDropdownMenu: {
    position: 'absolute',
    top: 45,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    width: 120,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  languageDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  languageDropdownItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  languageDropdownItemText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  languageDropdownItemTextSelected: {
    color: '#007AFF',
    fontWeight: 'bold',
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
    marginBottom: 15,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
  },
  gameConfigSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
  },
  gameListContainer: {
    backgroundColor: 'transparent',
    marginBottom: 10,
    gap: 10,
  },
  gameListItem: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginVertical: 4,
  },
  gameListItemSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#e3f2fd',
  },
  actionButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  gameListItemText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  gameListItemTextSelected: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  joinRoomSection: {
    backgroundColor: '#f1f8e9',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    overflow: 'visible',
    backgroundColor: '#2E7D32',
  },
  homeContainer: {
    width: '100%',
    maxWidth: 600,
    alignItems: 'stretch',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 10,
  },
  joinGlobalButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  joinGlobalIconContainer: {
    backgroundColor: '#E8F5E9',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  joinGlobalIcon: {
    fontSize: 20,
  },
  joinGlobalTextContainer: {
    flex: 1,
  },
  joinGlobalButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  joinGlobalSubText: {
    fontSize: 13,
    color: '#666',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 15,
  },
  librarySection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  gameCarousel: {
    paddingBottom: 10,
    paddingHorizontal: 5,
    gap: 15,
  },
  gameCard: {
    width: 120,
    height: 140,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#eee',
    marginRight: 15,
  },
  gameCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  gameCardDisabled: {
    opacity: 0.6,
    backgroundColor: '#FAFAFA',
  },
  gameCardIcon: {
    fontSize: 30,
    marginBottom: 10,
  },
  gameCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  gameCardTitleSelected: {
    color: '#007AFF',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  tagBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
  },
  comingSoonBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  comingSoonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionModesPanel: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionModeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  actionCardsRow: {
    flexDirection: 'row',
    gap: 15,
  },
  actionModeCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  actionModeIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  actionModeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    textAlign: 'center',
  },
  actionModeDesc: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  playerCountControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eee',
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 'auto',
  },
  countBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  countBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 20,
  },
  countText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginHorizontal: 10,
    color: '#333',
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    padding: 4,
    marginBottom: 15,
    width: '100%',
    maxWidth: 300,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
  },
  segmentButtonTextActive: {
    color: '#007AFF',
  },
  instructionText: {
    fontSize: 16,
    color: '#444',
    marginBottom: 15,
    textAlign: 'center',
  },
  actionBtn: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionBtnPrimary: {
    backgroundColor: '#4CAF50',
  },
  actionBtnSecondary: {
    backgroundColor: '#E3F2FD',
  },
  actionBtnDestructive: {
    backgroundColor: '#F44336',
  },
  actionBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionBtnSecondaryText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

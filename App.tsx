import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, TextInput, ScrollView, Platform, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import './src/i18n/index'; // Initialize i18n
import { WebRTCManager } from './src/webrtc';
import Scanner, { preloadCamera } from './src/components/Scanner';
import QRCodeDisplay from './src/components/QRCodeDisplay';
import GameBoard from './src/components/GameBoard';

import LanguageSwitcher from './src/components/home/LanguageSwitcher';
import UpdateBanner from './src/components/home/UpdateBanner';
import HeroSection from './src/components/home/HeroSection';
import GameLibrary from './src/components/home/GameLibrary';
import HomeActions from './src/components/home/HomeActions';

import { UnoLiteGame } from './src/game-modules/unoLite';
import { ZhengShangYouGame } from './src/game-modules/ZhengShangYou';
import { SanGuoShaGame } from './src/game-modules/sanguosha';
import { JiangsuTaopaiGame } from './src/game-modules/JiangsuTaopai';
import { Client } from 'boardgame.io/client';
import { Storage } from './src/storage';

export type AppState = 'HOME' | 'SIGNALING_HOST' | 'SIGNALING_GUEST' | 'CONNECTED' | 'SANDBOX';
export type GameMode = 'UnoLite' | 'ZhengShangYou' | 'SanGuoSha' | 'JiangsuTaopai';
type Role = 'HOST' | 'GUEST' | null;

// Replace GameAction with the boardgame.io specific action type
export interface BgioAction {
  type: string;
  moveName: string;
  args: any[];
}

export default function App() {
  const { t } = useTranslation();
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

  // Update Available state
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);

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
      case 'SanGuoSha':
        return SanGuoShaGame;
      case 'JiangsuTaopai':
        return JiangsuTaopaiGame;
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

  // Handle PWA update events
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleUpdate = () => {
      setUpdateAvailable(true);
    };

    const handleFocus = () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.update();
        });
      }
    };

    window.addEventListener('pwa-update-available', handleUpdate);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('pwa-update-available', handleUpdate);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleApplyUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
          window.location.reload();
        }
      });
    } else {
      window.location.reload();
    }
  };

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

  const startBoardGameHost = (playerIds: string[], gameMode: GameMode) => {
    const gameModule = getGameModule(gameMode);
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

    // Preload camera for faster scanning later
    preloadCamera();

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

    // Preload camera for faster scanning and to trigger permissions via user gesture on iOS PWA
    preloadCamera();

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
        // In sandbox hotseat mode, we must impersonate the active player before calling the move.
        // If there's an active response window, we impersonate that player.
        let activePlayerIndexStr = gameStateRef.current?.ctx?.currentPlayer;
        if (gameStateRef.current?.ctx?.activePlayers) {
          const activeKeys = Object.keys(gameStateRef.current.ctx.activePlayers);
          if (activeKeys.length > 0) {
            activePlayerIndexStr = activeKeys[0];
          }
        }
        if (activePlayerIndexStr !== undefined) {
          hostClientRef.current.updatePlayerID(activePlayerIndexStr);
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
    startBoardGameHost(allPlayers, selectedGameMode);
    setAppState('CONNECTED');
  };

  const renderHome = () => {
    return (
      <View style={styles.content}>
        <View style={styles.topRightControls}>
          <LanguageSwitcher
            languageMenuVisible={languageMenuVisible}
            setLanguageMenuVisible={setLanguageMenuVisible}
          />
        </View>

        <UpdateBanner
          updateAvailable={updateAvailable}
          handleApplyUpdate={handleApplyUpdate}
        />

        <HeroSection />

        <View style={styles.homeContainer}>
          <GameLibrary
            selectedGameMode={selectedGameMode}
            setSelectedGameMode={setSelectedGameMode}
          />

          <HomeActions
            selectedGameMode={selectedGameMode}
            handleHost={handleHost}
            handleGuest={handleGuest}
            setAppState={setAppState}
            setPlayerId={setPlayerId}
            sandboxPlayerCount={sandboxPlayerCount}
            setSandboxPlayerCount={setSandboxPlayerCount}
            startBoardGameHost={startBoardGameHost}
          />
        </View>
      </View>
    );
  };

  const renderSandbox = () => {
    if (!gameState) return null;

    // In Sandbox, if there's an active response window (e.g. someone needs to play a Dodge),
    // switch the view to that player so the user can interact. Otherwise, show the current turn player.
    let activePlayerId = gameState.G.players[parseInt(gameState.ctx.currentPlayer, 10)];
    if (gameState.ctx.activePlayers) {
      const activePlayerIndices = Object.keys(gameState.ctx.activePlayers);
      if (activePlayerIndices.length > 0) {
        activePlayerId = gameState.G.players[parseInt(activePlayerIndices[0], 10)];
      }
    }

    return (
      <View style={{ flex: 1 }}>
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
            startBoardGameHost(players, selectedGameMode);
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
            startBoardGameHost(allPlayers, selectedGameMode);
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

  const dynamicBgColor = (appState === 'CONNECTED' || appState === 'SANDBOX') ? '#2E7D32' : '#f5f5f5';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: dynamicBgColor }]}>
      <View style={[styles.container, { backgroundColor: dynamicBgColor }]}>
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
    paddingTop: Platform.OS === 'web' ? 'env(safe-area-inset-top, 0px)' as any : 0,
    paddingBottom: Platform.OS === 'web' ? 'env(safe-area-inset-bottom, 0px)' as any : 0,
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
  },
  homeContainer: {
    width: '100%',
    maxWidth: 600,
    alignItems: 'stretch',
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  }
});

import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, TextInput, Platform, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import './src/i18n/index';
import { WebRTCManager } from './src/webrtc';
import Scanner from './src/components/Scanner';
import QRCodeDisplay from './src/components/QRCodeDisplay';
import GameBoard from './src/components/GameBoard';
import { UnoLiteGame } from './src/game-modules/unoLite';
import { ZhengShangYouGame } from './src/game-modules/ZhengShangYou';
import { Client } from 'boardgame.io/client';
import {
  createSignalPayload,
  encodeSignalPayload,
  decodeSignalPayload,
  buildSignalShareLink,
  parseSignalFromCurrentUrl,
  clearSignalHashFromUrl,
  type SignalPayloadV1,
  type SignalType,
} from './src/signaling';

type AppState = 'HOME' | 'SIGNALING_HOST' | 'SIGNALING_GUEST' | 'CONNECTED' | 'SANDBOX';
type GameMode = 'UnoLite' | 'ZhengShangYou';
type Role = 'HOST' | 'GUEST' | null;
type SignalingTab = 'qr' | 'scan' | 'text' | 'share';

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
  const [playerId, setPlayerId] = useState<string>('');
  const [messages, setMessages] = useState<string[]>([]);
  const [guestWebrtcManager, setGuestWebrtcManager] = useState<WebRTCManager | null>(null);
  const [pendingHostManager, setPendingHostManager] = useState<WebRTCManager | null>(null);
  const hostConnections = useRef(new Map<string, WebRTCManager>());
  const hostClientRef = useRef<any>(null);

  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [signalingTab, setSignalingTab] = useState<SignalingTab>('qr');
  const [signalOutputText, setSignalOutputText] = useState<string>('');
  const [signalInputText, setSignalInputText] = useState<string>('');
  const [signalMessage, setSignalMessage] = useState<string>('');
  const [signalError, setSignalError] = useState<string>('');
  const [latestSignalType, setLatestSignalType] = useState<SignalType | null>(null);
  const [importFingerprint, setImportFingerprint] = useState<string>('');
  const [pendingUrlSignal, setPendingUrlSignal] = useState<SignalPayloadV1 | null>(null);

  const [selectedGameMode, setSelectedGameMode] = useState<GameMode>('UnoLite');
  const [gameState, setGameState] = useState<any>(null);

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
            playerID: guestId,
          }),
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

  useEffect(() => {
    selectedGameModeRef.current = selectedGameMode;
    roleRef.current = role;
    roomIdRef.current = roomId;
    playerIdRef.current = playerId;
    messagesRef.current = messages;
    gameStateRef.current = gameState;
  }, [role, roomId, playerId, messages, gameState, selectedGameMode]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const parsed = parseSignalFromCurrentUrl();
    if (!parsed) return;
    if (parsed.ok === false) {
      setSignalError(parsed.message);
      clearSignalHashFromUrl();
      return;
    }
    setPendingUrlSignal(parsed.payload);
    setSignalInputText(parsed.rawText);
    setSignalingTab('text');
    setSignalMessage(t('lobby.linkImportedReady'));
    clearSignalHashFromUrl();
  }, [t]);

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
        }
      } catch {
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
        playerId: playerIdRef.current,
      }));
    };
  }, [guestWebrtcManager, role]);

  const setupHostManager = (manager: WebRTCManager) => {
    manager.onMessageCallback = (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data.type === 'HELLO') {
          const gId = data.playerId;
          if (gId) {
            hostConnections.current.set(gId, manager);
            manager.sendMessage(JSON.stringify({ type: 'WELCOME', roomId: roomIdRef.current, state: { messages: messagesRef.current } }));

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
                    playerID: gId,
                  }),
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
      } catch {
        // ignore malformed game message
      }
    };

    manager.onConnectionStateChangeCallback = (state) => {
      setConnectionStatus(state);
    };

    manager.onDataChannelOpenCallback = () => {
      setSignalMessage(t('lobby.guestConnected'));
      setSignalError('');
    };
  };

  const toOutputPayloadText = (signalType: SignalType, compressed: string, includePlayerId: boolean) => {
    const payload = createSignalPayload({
      signalType,
      payload: compressed,
      roomId: roomIdRef.current,
      playerId: includePlayerId ? playerIdRef.current : undefined,
    });
    return encodeSignalPayload(payload);
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

  const handleHost = async () => {
    setAppState('SIGNALING_HOST');
    setRole('HOST');
    setPlayerId('host');
    const newRoomId = Math.random().toString(36).substring(2, 9);
    setRoomId(newRoomId);
    setMessages([]);
    clearStorage();
    await startNewHostPendingConnection(newRoomId);
  };

  const resetSignalingUi = () => {
    setSignalOutputText('');
    setSignalInputText('');
    setSignalError('');
    setSignalMessage('');
    setLatestSignalType(null);
    setSignalingTab('qr');
    setImportFingerprint('');
  };

  const startNewHostPendingConnection = async (forcedRoomId?: string) => {
    const manager = new WebRTCManager();
    setupHostManager(manager);
    setPendingHostManager(manager);
    setSignalError('');
    setSignalMessage('');
    setSignalingTab('qr');

    try {
      const offerStr = await manager.createOffer();
      if (forcedRoomId) {
        roomIdRef.current = forcedRoomId;
      }
      const payloadText = toOutputPayloadText('offer', offerStr, true);
      setSignalOutputText(payloadText);
      setLatestSignalType('offer');
    } catch (e) {
      setSignalError(`${t('lobby.errorSignaling')}${String(e)}`);
    }
  };

  const handleGuest = () => {
    setAppState('SIGNALING_GUEST');
    setRole('GUEST');
    const newPlayerId = `guest_${Math.random().toString(36).substring(2, 9)}`;
    setPlayerId(newPlayerId);
    clearStorage();
    const manager = new WebRTCManager();
    setGuestWebrtcManager(manager);
    resetSignalingUi();
    setSignalingTab('scan');
  };

  const applySignalPayload = async (payload: SignalPayloadV1, source: 'scan' | 'text' | 'url') => {
    setSignalError('');

    if (appState === 'CONNECTED') {
      setSignalError(t('lobby.signalConnectedAlready'));
      return;
    }

    const fingerprint = `${payload.signalType}:${payload.payload.slice(0, 48)}`;
    if (fingerprint === importFingerprint) {
      setSignalError(t('lobby.signalDuplicate'));
      return;
    }

    if (appState === 'SIGNALING_HOST') {
      if (!pendingHostManager) {
        setSignalError(t('lobby.signalHostNotReady'));
        return;
      }
      if (payload.signalType !== 'answer') {
        setSignalError(t('lobby.signalNeedAnswer'));
        return;
      }

      await pendingHostManager.acceptAnswer(payload.payload);
      setImportFingerprint(fingerprint);
      setSignalMessage(t('lobby.signalImportedSource', { source }));
      setSignalOutputText('');
      setLatestSignalType(null);
      return;
    }

    if (appState === 'SIGNALING_GUEST') {
      if (!guestWebrtcManager) {
        setSignalError(t('lobby.signalGuestNotReady'));
        return;
      }
      if (payload.signalType !== 'offer') {
        setSignalError(t('lobby.signalNeedOffer'));
        return;
      }

      const answerStr = await guestWebrtcManager.acceptOfferAndCreateAnswer(payload.payload);
      const answerPayload = createSignalPayload({
        signalType: 'answer',
        payload: answerStr,
        roomId: payload.roomId || roomIdRef.current,
        playerId: playerIdRef.current,
      });

      if (payload.roomId) {
        setRoomId(payload.roomId);
      }

      setSignalOutputText(encodeSignalPayload(answerPayload));
      setLatestSignalType('answer');
      setSignalingTab('qr');
      setImportFingerprint(fingerprint);
      setSignalMessage(t('lobby.signalImportedSource', { source }));
      return;
    }

    setSignalError(t('lobby.signalPickModeFirst'));
  };

  const expectedSignalForCurrentState = (): SignalType | undefined => {
    if (appState === 'SIGNALING_HOST') return 'answer';
    if (appState === 'SIGNALING_GUEST') return 'offer';
    return undefined;
  };

  const importSignalText = async (rawText: string, source: 'text' | 'url' | 'scan') => {
    const decoded = decodeSignalPayload(rawText, expectedSignalForCurrentState());
    if (decoded.ok === false) {
      setSignalError(decoded.message);
      return;
    }

    setSignalInputText(decoded.rawText);
    await applySignalPayload(decoded.payload, source);
  };

  const handleScanSuccess = async (scannedText: string) => {
    try {
      await importSignalText(scannedText, 'scan');
    } catch (e) {
      setSignalError(`${t('lobby.errorSignaling')}${String(e)}`);
    }
  };

  useEffect(() => {
    if (!pendingUrlSignal) return;
    if (appState !== 'SIGNALING_HOST' && appState !== 'SIGNALING_GUEST') return;

    const shouldApply =
      (appState === 'SIGNALING_HOST' && pendingUrlSignal.signalType === 'answer') ||
      (appState === 'SIGNALING_GUEST' && pendingUrlSignal.signalType === 'offer');

    if (shouldApply) {
      importSignalText(encodeSignalPayload(pendingUrlSignal), 'url');
      setPendingUrlSignal(null);
      return;
    }

    setSignalInputText(encodeSignalPayload(pendingUrlSignal));
    setSignalMessage(t('lobby.linkImportedReady'));
  }, [pendingUrlSignal, appState]);

  const copySignal = async (text: string) => {
    if (!text) {
      setSignalError(t('lobby.signalNothingToCopy'));
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      setSignalMessage(t('lobby.signalCopied'));
      return;
    }

    setSignalError(t('lobby.signalClipboardUnavailable'));
  };

  const shareSignal = async () => {
    if (!signalOutputText) {
      setSignalError(t('lobby.signalNoShareData'));
      return;
    }

    const decoded = decodeSignalPayload(signalOutputText, latestSignalType || undefined);
    if (decoded.ok === false) {
      setSignalError(decoded.message);
      return;
    }

    const link = buildSignalShareLink(decoded.payload);
    if (!link) {
      setSignalError(t('lobby.signalNoShareData'));
      return;
    }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ url: link, title: 'Offline Cards Signal' });
        setSignalMessage(t('lobby.signalShared'));
        return;
      } catch {
        // Continue with clipboard fallback.
      }
    }

    await copySignal(link);
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
          playerId,
          moveName,
          args,
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

  const renderHome = () => (
    <View style={styles.content}>
      <View style={styles.topRightControls}>{renderLanguageSwitcher()}</View>
      <Text style={styles.title}>{t('lobby.title')}</Text>
      <Text style={styles.subtitle}>{t('lobby.subtitle')}</Text>
      <View style={styles.buttonContainer}>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ textAlign: 'center', marginBottom: 10, fontWeight: 'bold' }}>{t('lobby.selectGame')}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
            <Button title={t('lobby.game_UnoLite')} onPress={() => setSelectedGameMode('UnoLite')} color={selectedGameMode === 'UnoLite' ? '#007AFF' : '#999'} />
            <Button title={t('lobby.game_ZhengShangYou')} onPress={() => setSelectedGameMode('ZhengShangYou')} color={selectedGameMode === 'ZhengShangYou' ? '#007AFF' : '#999'} />
          </View>
        </View>

        <Button title={t('lobby.createRoom')} onPress={handleHost} />
        <View style={{ height: 20 }} />
        <Button title={t('lobby.joinRoom')} onPress={handleGuest} />

        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <Text style={{ textAlign: 'center', marginBottom: 10, color: 'gray' }}>{t('lobby.localTesting')}</Text>
          <Button
            title={t('lobby.sandboxTesting')}
            color="purple"
            onPress={() => {
              setAppState('SANDBOX');
              setPlayerId('host');
              const players = ['host', 'guest_1'];
              startBoardGameHost(players);
            }}
          />
        </View>
      </View>
    </View>
  );

  const renderSandbox = () => {
    if (!gameState) return null;
    return (
      <GameBoard
        gameState={gameState}
        myPlayerId="host"
        onAction={handleGameAction}
        onExit={() => {
          if (hostClientRef.current) {
            hostClientRef.current.stop();
            hostClientRef.current = null;
          }
          setGameState(null);
          setAppState('HOME');
        }}
        onReset={() => {
          if (hostClientRef.current) hostClientRef.current.stop();
          startBoardGameHost(['host', 'guest_1']);
        }}
        isSandbox={true}
      />
    );
  };

  const getShareLinkText = () => {
    const decoded = decodeSignalPayload(signalOutputText, latestSignalType || undefined);
    if (!decoded.ok) return '';
    return buildSignalShareLink(decoded.payload);
  };

  const renderSignaling = () => {
    const shareLink = getShareLinkText();

    return (
      <View style={styles.content}>
        <Text style={styles.title}>{appState === 'SIGNALING_HOST' ? t('lobby.hostMode') : t('lobby.guestMode')}</Text>
        <Text style={styles.subtitleSmall}>{t('lobby.connectionState')}: {connectionStatus}</Text>

        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabButton, signalingTab === 'qr' && styles.tabButtonActive]} onPress={() => setSignalingTab('qr')}><Text>{t('lobby.tabQR')}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, signalingTab === 'scan' && styles.tabButtonActive]} onPress={() => setSignalingTab('scan')}><Text>{t('lobby.tabScan')}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, signalingTab === 'text' && styles.tabButtonActive]} onPress={() => setSignalingTab('text')}><Text>{t('lobby.tabCopyPaste')}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, signalingTab === 'share' && styles.tabButtonActive]} onPress={() => setSignalingTab('share')}><Text>{t('lobby.tabShare')}</Text></TouchableOpacity>
        </View>

        {signalError ? <Text style={styles.errorText}>{signalError}</Text> : null}
        {signalMessage ? <Text style={styles.infoText}>{signalMessage}</Text> : null}

        <View style={{ flex: 1, width: '100%', alignItems: 'center' }}>
          {signalingTab === 'qr' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('lobby.showQRToOther')}</Text>
              {signalOutputText ? <QRCodeDisplay value={signalOutputText} /> : <Text>{t('lobby.waitingForSignalData')}</Text>}
            </View>
          )}

          {signalingTab === 'scan' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('lobby.scanOtherDeviceQR')}</Text>
              {Platform.OS === 'web' ? (
                <Scanner
                  onScan={handleScanSuccess}
                  onError={(error) => setSignalMessage(error)}
                  labels={{
                    startCamera: t('lobby.startCamera'),
                    idleHint: t('lobby.cameraIdle'),
                    requesting: t('lobby.cameraRequesting'),
                    activeHint: t('lobby.cameraActive'),
                    permissionDenied: t('lobby.cameraDenied'),
                    unsupported: t('lobby.cameraUnsupported'),
                    fallback: t('lobby.cameraFallback'),
                  }}
                />
              ) : (
                <Text>{t('lobby.scanningRequiresWeb')}</Text>
              )}
            </View>
          )}

          {signalingTab === 'text' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('lobby.copyPasteInstructions')}</Text>
              <TextInput
                style={styles.textArea}
                multiline
                value={signalInputText}
                onChangeText={setSignalInputText}
                placeholder={t('lobby.pastePlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.inlineButtons}>
                <Button title={t('lobby.importSignal')} onPress={() => importSignalText(signalInputText, 'text')} />
                <Button title={t('lobby.copySignal')} onPress={() => copySignal(signalOutputText)} />
              </View>
              {signalOutputText ? (
                <Text selectable style={styles.selectable}>{signalOutputText}</Text>
              ) : null}
            </View>
          )}

          {signalingTab === 'share' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('lobby.shareInstructions')}</Text>
              {shareLink ? <Text selectable style={styles.selectable}>{shareLink}</Text> : <Text>{t('lobby.waitingForSignalData')}</Text>}
              <View style={styles.inlineButtons}>
                <Button title={t('lobby.shareLink')} onPress={shareSignal} />
                <Button title={t('lobby.copyLink')} onPress={() => copySignal(shareLink)} />
              </View>
            </View>
          )}
        </View>

        <View style={{ marginTop: 16, width: '100%', maxWidth: 320 }}>
          {appState === 'SIGNALING_HOST' && (
            <View style={{ marginBottom: 10 }}>
              <Button title={t('lobby.addAnotherPlayer')} onPress={() => { void startNewHostPendingConnection(); }} color="blue" />
            </View>
          )}
          {appState === 'SIGNALING_HOST' && (
            <View style={{ marginBottom: 10 }}>
              <Button title={t('lobby.startGame', { count: hostConnections.current.size + 1 })} onPress={startGameHost} color="green" />
            </View>
          )}
          <Button
            title={t('lobby.cancel')}
            onPress={() => {
              if (appState === 'SIGNALING_HOST') pendingHostManager?.close();
              if (appState === 'SIGNALING_GUEST') guestWebrtcManager?.close();
              setAppState('HOME');
            }}
            color="red"
          />
        </View>
      </View>
    );
  };

  const renderConnected = () => {
    if (!gameState) {
      return (
        <View style={styles.content}>
          <Text style={styles.title}>{t('lobby.waitingForState')}</Text>
          <Button title={t('lobby.exit')} onPress={() => setAppState('HOME')} color="red" />
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
              if (hostClientRef.current) {
                hostClientRef.current.stop();
                hostClientRef.current = null;
              }
              hostConnections.current.forEach((m) => m.close());
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
  subtitleSmall: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
  },
  section: {
    alignItems: 'center',
    marginVertical: 12,
    width: '100%',
    flex: 1,
  },
  sectionTitle: {
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  sandboxContainer: {
    flex: 1,
    width: '100%',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  tabButton: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  tabButtonActive: {
    backgroundColor: '#d9ebff',
    borderColor: '#007AFF',
  },
  textArea: {
    width: '100%',
    maxWidth: 520,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  inlineButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  selectable: {
    width: '100%',
    maxWidth: 520,
    color: '#1f1f1f',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
  },
  errorText: {
    color: '#b91c1c',
    marginBottom: 8,
    textAlign: 'center',
  },
  infoText: {
    color: '#1d4ed8',
    marginBottom: 8,
    textAlign: 'center',
  },
});

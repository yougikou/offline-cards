import React, { memo, useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, Button, TouchableOpacity, Modal, Animated, Dimensions, PanResponder } from 'react-native';
import { useTranslation } from 'react-i18next';
import DraggableCard from './DraggableCard';
import { Storage } from '../storage';

interface GameBoardProps {
  // gameState now contains the boardgame.io state object structure { G, ctx, plugins }
  gameState: any;
  myPlayerId: string;
  onAction: (moveName: string, ...args: any[]) => void;
  onExit?: () => void;
  onReset?: () => void;
  isSandbox?: boolean;
}

const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  myPlayerId,
  onAction,
  onExit,
  onReset,
  isSandbox = false
}) => {
  const { t } = useTranslation();
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isMultiDragging, setIsMultiDragging] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const checkTutorial = async () => {
      const dismissed = await Storage.getItem('sandboxTutorialDismissed');
      if (!dismissed && isSandbox) {
        setShowTutorial(true);
      }
    };
    checkTutorial();
  }, [isSandbox]);

  const dismissTutorial = async () => {
    setShowTutorial(false);
    await Storage.setItem('sandboxTutorialDismissed', 'true');
  };

  const containerWidthRef = useRef(0);
  const contentWidthRef = useRef(0);

  const handPanX = useRef(new Animated.Value(0)).current;
  const lastHandPanX = useRef(0);

  const handPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only trigger hand sliding if we're swiping horizontally significantly.
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: () => {
        handPanX.setOffset(lastHandPanX.current);
        handPanX.setValue(0);
      },
      onPanResponderMove: Animated.event([null, { dx: handPanX }], { useNativeDriver: false }),
      onPanResponderRelease: (evt, gestureState) => {
        handPanX.flattenOffset();
        let newX = lastHandPanX.current + gestureState.dx;

        const cWidth = containerWidthRef.current;
        const ctWidth = contentWidthRef.current;

        // Left bound: content should not go further right than 0.
        // Right bound: content should not go further left than -(contentWidth - containerWidth).
        const minX = cWidth < ctWidth ? -(ctWidth - cWidth + 40) : 0;
        const maxX = 0;

        if (newX > maxX) {
          newX = maxX;
        } else if (newX < minX) {
          newX = minX;
        }

        Animated.spring(handPanX, {
          toValue: newX,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        }).start(() => {
          lastHandPanX.current = newX;
        });
      },
      onPanResponderTerminate: (evt, gestureState) => {
        handPanX.flattenOffset();
        let newX = lastHandPanX.current + gestureState.dx;

        const cWidth = containerWidthRef.current;
        const ctWidth = contentWidthRef.current;

        const minX = cWidth < ctWidth ? -(ctWidth - cWidth + 40) : 0;
        const maxX = 0;

        if (newX > maxX) {
          newX = maxX;
        } else if (newX < minX) {
          newX = minX;
        }

        Animated.spring(handPanX, {
          toValue: newX,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        }).start(() => {
          lastHandPanX.current = newX;
        });
      }
    })
  ).current;

  const multiPan = useRef(new Animated.ValueXY()).current;
  const multiScale = useRef(new Animated.Value(1)).current;

  if (!gameState || !gameState.G) return null;

  const { G, ctx } = gameState;
  const gameName = G.gameName || 'UnoLite';
  const opponents = (G.players || []).filter((p: string) => p !== myPlayerId);

  const myHand = G.hands && G.hands[myPlayerId] ? G.hands[myPlayerId] : [];

  // UnoLite props
  const discardPile = G.discardPile || [];
  const deckCount = G.deckCount ?? (G.deck ? G.deck.length : 0);

  // ZhengShangYou props
  const currentTrick = G.currentTrick || [];

  // Determine if it's the current player's turn
  const currentPlayerIdString = G.players ? G.players[parseInt(ctx.currentPlayer, 10)] : null;
  const isMyTurn = currentPlayerIdString === myPlayerId;
  const gameOver = ctx.gameover;

  useEffect(() => {
    // Reset scroll if hand becomes small again
    if (myHand.length <= 1) {
       handPanX.setValue(0);
       lastHandPanX.current = 0;
    }
  }, [myHand.length]);

  const handleCardPress = (cardIndex: number) => {
    if (!isMyTurn || gameOver) return;

    if (gameName === 'ZhengShangYou') {
      setSelectedCards(prev => {
        if (prev.includes(cardIndex)) {
          return prev.filter(idx => idx !== cardIndex);
        } else {
          return [...prev, cardIndex];
        }
      });
    } else {
      setSelectedCards(prev => {
        if (prev.includes(cardIndex)) {
          return [];
        } else {
          return [cardIndex];
        }
      });
    }
  };

  const handleDragUp = (cardIndex: number) => {
    if (!isMyTurn || gameOver) return;

    if (gameName === 'UnoLite') {
      onAction('playCard', cardIndex);
      setSelectedCards([]);
    } else {
      if (selectedCards.includes(cardIndex)) {
        onAction('playCard', selectedCards);
        setSelectedCards([]);
      } else {
        onAction('playCard', [cardIndex]);
        setSelectedCards([]);
      }
    }
  };

  const renderCard = (card: any, player: string, cardIndex: number, isOpponent: boolean = false, customMarginLeft?: number) => {
    const isSelected = selectedCards.includes(cardIndex);
    return (
      <DraggableCard
        key={card.id || `${player}-${cardIndex}-${Math.random()}`}
        card={card}
        index={cardIndex}
        totalCards={G.hands && G.hands[player] ? G.hands[player].length : 0}
        isMyTurn={isMyTurn && !gameOver}
        gameName={gameName}
        isSelected={isSelected}
        onPress={handleCardPress}
        onDragUp={handleDragUp}
        isOpponent={isOpponent}
        multiPan={multiPan}
        multiScale={multiScale}
        isMultiDragging={isMultiDragging && isSelected}
        onDragStart={() => {
          if (isSelected && selectedCards.length > 1) {
            setIsMultiDragging(true);
          }
        }}
        onDragEnd={() => {
          setIsMultiDragging(false);
        }}
        customMarginLeft={customMarginLeft}
      />
    );
  };

  return (
    <View style={styles.sandboxContainer}>
      <TouchableOpacity style={{ position: 'absolute', top: 20, right: 20, zIndex: 100 }} onPress={() => setModalVisible(true)}>
        <Text style={{ fontSize: 24, color: 'white' }}>⚙️</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: 'white', padding: 20, borderRadius: 10, gap: 10 }}>
            {onExit && <Button title={t('game.exit')} onPress={() => { setModalVisible(false); onExit(); }} color="#F44336" />}
            {onReset && isSandbox && <Button title={t('game.resetGame')} onPress={() => { setModalVisible(false); onReset(); }} color="#FF9800" />}
            <Button title={t('lobby.cancel')} onPress={() => setModalVisible(false)} />
          </View>
        </View>
      </Modal>

      {gameOver && (
        <View style={styles.gameOverOverlay}>
          <Text style={styles.gameOverText}>
            {t('game.gameOver')}
          </Text>
          <Text style={styles.gameOverText}>
            {t('game.winner', { winner: gameOver.winner })}
          </Text>
          <View style={styles.gameOverButtons}>
            {onReset && (
              <Button
                title={t('game.resetGame', '再开一局')}
                onPress={() => onReset()}
                color="#4CAF50"
              />
            )}
            {onExit && (
              <Button
                title={t('game.exit', '返回主界面')}
                onPress={() => onExit()}
                color="#F44336"
              />
            )}
          </View>
        </View>
      )}

      {opponents.map((opponentId: string, index: number) => {
        const opponentHand = G.hands && G.hands[opponentId] ? G.hands[opponentId] : [];
        const isOpponentTurn = currentPlayerIdString === opponentId;
        const pIndex = (G.players || []).indexOf(opponentId) + 1;
        const shortName = `P${pIndex}`;

        // 左边2人，左上角1人，上边3人，右上角1人，右边2人 共9个位置
        const positions: any[] = [
          { top: 50, alignSelf: 'center' as const }, // Top middle
          { top: '35%', left: 10 },                  // Left 1
          { top: '35%', right: 10 },                 // Right 1
          { top: 50, left: '25%' },                  // Top left-ish
          { top: 50, right: '25%' },                 // Top right-ish
          { top: '55%', left: 10 },                  // Left 2
          { top: '55%', right: 10 },                 // Right 2
          { top: 50, left: 10 },                     // Top-Left corner
          { top: 50, right: 10 },                    // Top-Right corner
        ];
        const layoutStyle = positions[index % positions.length];

        return (
          <View key={opponentId} style={[styles.opponentCard, layoutStyle, { borderColor: isOpponentTurn ? '#FFD700' : 'transparent' }]}>
            <Text style={[styles.opponentName, { color: isOpponentTurn ? '#FFD700' : 'white' }]}>
              {shortName} {isOpponentTurn ? '(Turn)' : ''}
            </Text>
            <View style={styles.opponentCardCount}>
              <Text style={styles.opponentCardCountText}>{opponentHand.length} 张</Text>
            </View>
          </View>
        );
      })}

      {/* Table Area (Absolute Full Screen, zIndex 1) */}
      <View style={styles.tableArea}>
        {gameName === 'UnoLite' ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 400, marginBottom: 10 }}>
              <Text style={styles.sandboxTitle}>{t('game.discardPileTop')}</Text>
              <Text style={styles.sandboxTitle}>{t('game.deckCount', { count: deckCount })}</Text>
            </View>
            <View style={styles.tableContainer}>
              {discardPile.length > 0 && (
                (() => {
                  const topCard = discardPile[discardPile.length - 1];
                  const cardColor = topCard.color ? topCard.color.toLowerCase() : 'gray';
                  return (
                    <View style={[styles.card, { backgroundColor: cardColor, width: 60, height: 90 }]}>
                      <Text style={[styles.cardText, { color: 'white', fontSize: 24, userSelect: 'none' as any }]}>
                        {topCard.value}
                      </Text>
                    </View>
                  );
                })()
              )}
            </View>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%', maxWidth: 400, marginBottom: 10 }}>
              <Text style={styles.sandboxTitle}>{t('game.currentTrick')}</Text>
            </View>
            <View style={[styles.tableContainer, { flexWrap: 'nowrap' }]}>
              {currentTrick.map((c: any, index: number) => {
                const textColor = c.suit === 'Hearts' || c.suit === 'Diamonds' || c.rank === 'Red Joker' ? 'red' : 'black';
                const suitIcon = c.suit === 'Hearts' ? '♥' : c.suit === 'Diamonds' ? '♦' : c.suit === 'Clubs' ? '♣' : c.suit === 'Spades' ? '♠' : '';
                return (
                  <View key={`trick-${index}`} style={[styles.card, { backgroundColor: 'white', width: 60, height: 90, marginLeft: index > 0 ? -40 : 0 }]}>
                    <View style={{ position: 'absolute', top: 4, left: 4, alignItems: 'center' }}>
                      <Text style={{ color: textColor, fontSize: 16, fontWeight: 'bold', userSelect: 'none' as any }}>{c.rank}</Text>
                      {suitIcon ? <Text style={{ color: textColor, fontSize: 14, userSelect: 'none' as any }}>{suitIcon}</Text> : null}
                    </View>
                    <View style={{ position: 'absolute', bottom: 4, right: 4, alignItems: 'center', transform: [{ rotate: '180deg' }] }}>
                      <Text style={{ color: textColor, fontSize: 16, fontWeight: 'bold', userSelect: 'none' as any }}>{c.rank}</Text>
                      {suitIcon ? <Text style={{ color: textColor, fontSize: 14, userSelect: 'none' as any }}>{suitIcon}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                      <Text style={[styles.cardText, { color: textColor, fontSize: 20, userSelect: 'none' as any }]}>
                        {c.rank}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>

      {/* Controls Area (Absolutely Positioned above hand) */}
      <View style={styles.controlsArea}>
        {showTutorial && isMyTurn && !gameOver && (
          <View style={styles.tutorialBanner}>
            <Text style={styles.tutorialText}>{t('game.tutorialHint')}</Text>
            <TouchableOpacity style={styles.tutorialDismissBtn} onPress={dismissTutorial}>
              <Text style={styles.tutorialDismissText}>{t('game.dismiss')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedCards.length > 0 && (
          <View style={styles.selectedSummaryContainer}>
            {[...selectedCards].sort((a, b) => a - b).map(idx => {
              const c = myHand[idx];
              if (!c) return null;
              if (gameName === 'UnoLite') {
                 const cardColor = c.color ? c.color.toLowerCase() : 'gray';
                 return (
                   <View key={`sel-${idx}`} style={[styles.miniCard, { backgroundColor: cardColor }]}>
                     <Text style={[styles.miniCardText, { color: 'white' }]}>{c.value}</Text>
                   </View>
                 );
              } else {
                 const textColor = c.suit === 'Hearts' || c.suit === 'Diamonds' || c.rank === 'Red Joker' ? 'red' : 'black';
                 const suitIcon = c.suit === 'Hearts' ? '♥' : c.suit === 'Diamonds' ? '♦' : c.suit === 'Clubs' ? '♣' : c.suit === 'Spades' ? '♠' : '';
                 return (
                   <View key={`sel-${idx}`} style={[styles.miniCard, { backgroundColor: 'white' }]}>
                     <Text style={[styles.miniCardText, { color: textColor }]}>{c.rank}</Text>
                     {suitIcon ? <Text style={[styles.miniCardSuit, { color: textColor }]}>{suitIcon}</Text> : null}
                   </View>
                 );
              }
            })}
          </View>
        )}

        <View style={styles.controlRow}>
          {gameName === 'UnoLite' ? (
            <>
              <TouchableOpacity
                style={[styles.fab, (!isMyTurn || gameOver) ? styles.fabDisabled : { backgroundColor: '#2196F3' }]}
                onPress={() => onAction('drawAndPass')}
                disabled={!isMyTurn || gameOver}
              >
                <Text style={styles.fabText}>{isMyTurn ? t('game.drawCard') : t('game.waitingForOpponent')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fab, (!isMyTurn || gameOver || selectedCards.length === 0) ? styles.fabDisabled : { backgroundColor: '#4CAF50', marginLeft: 10 }]}
                onPress={() => {
                  if (selectedCards.length > 0) {
                    onAction('playCard', selectedCards[0]);
                    setSelectedCards([]);
                  }
                }}
                disabled={!isMyTurn || gameOver || selectedCards.length === 0}
              >
                <Text style={styles.fabText}>{t('game.playSelected')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.fab, (!isMyTurn || gameOver || currentTrick.length === 0) ? styles.fabDisabled : { backgroundColor: '#9E9E9E' }]}
                onPress={() => {
                  onAction('pass');
                  setSelectedCards([]);
                }}
                disabled={!isMyTurn || gameOver || currentTrick.length === 0}
              >
                <Text style={styles.fabText}>{t('game.pass')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.fab, (!isMyTurn || gameOver || selectedCards.length === 0) ? styles.fabDisabled : { backgroundColor: '#4CAF50', marginLeft: 10 }]}
                onPress={() => {
                  if (selectedCards.length > 0) {
                    onAction('playCard', selectedCards);
                    setSelectedCards([]);
                  }
                }}
                disabled={!isMyTurn || gameOver || selectedCards.length === 0}
              >
                <Text style={styles.fabText}>{t('game.playSelected')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        <Text style={[styles.sandboxTitle, { marginBottom: 10, textAlign: 'center' }]}>
          P{(G.players || []).indexOf(myPlayerId) + 1} {t('game.me')} {isMyTurn ? t('game.yourTurn') : ''}
        </Text>
      </View>

      {/* My Hand Area (Absolutely Positioned at Bottom, Fixed Height, High Z-Index) */}
      <View style={styles.myHandArea} pointerEvents="box-none">
        {(() => {
          const paddingHorizontal = 20;

          return (
            <View
              style={{ width: '100%', height: '100%', overflow: 'visible', justifyContent: 'flex-end' }}
              pointerEvents="box-none"
            >
              {/* All Cards (Lower Area, flush with bottom) */}
              <View
                style={[styles.unselectedHandContainer, { height: '100%', paddingBottom: 20 }]}
                onLayout={(e) => { containerWidthRef.current = e.nativeEvent.layout.width; }}
                pointerEvents="box-none"
              >
                <Animated.View
                  {...handPanResponder.panHandlers}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    paddingBottom: 5,
                    paddingHorizontal: paddingHorizontal,
                    transform: [{ translateX: handPanX }],
                    alignSelf: 'flex-start'
                  }}
                  onLayout={(e) => { contentWidthRef.current = e.nativeEvent.layout.width; }}
                >
                  {myHand.map((card: any, index: number) => renderCard(card, myPlayerId, index, false, index > 0 ? -35 : 0))}
                  <View style={{ width: 40 }} />
                </Animated.View>
              </View>
            </View>
          );
        })()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sandboxContainer: {
    flex: 1,
    width: '100%',
    flexDirection: 'column',
    overflow: 'visible',
    backgroundColor: '#2E7D32',
  },
  opponentCard: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    minWidth: 60,
  },
  opponentName: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
    userSelect: 'none' as any,
  },
  opponentCardCount: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  opponentCardCountText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 12,
    userSelect: 'none' as any,
  },
  tableArea: {
    position: 'absolute',
    top: 0,
    bottom: 220,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    zIndex: 1,
  },
  controlsArea: {
    position: 'absolute',
    bottom: 200,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  myHandArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
    zIndex: 100,
    elevation: 100,
    overflow: 'visible',
  },
  unselectedHandContainer: {
    overflow: 'visible',
    justifyContent: 'flex-end',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 10,
  },
  fab: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  fabDisabled: {
    backgroundColor: 'gray', // Faded color for disabled
    opacity: 0.5,
    elevation: 0,
    shadowOpacity: 0,
  },
  fabText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
    userSelect: 'none' as any,
  },
  sandboxTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#fff',
    userSelect: 'none' as any,
  },
  activePlayerText: {
    color: '#FFD700', // Gold for active player
    userSelect: 'none' as any,
  },
  handContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 5,
  },
  scrollHandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20, // Give some vertical room for the pop-up and shadow
  },
  tableContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    gap: 5,
  },
  card: {
    width: 45,
    height: 70,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
    userSelect: 'none' as any,
  },
  cardBack: {
    backgroundColor: '#111',
    borderColor: '#444',
  },
  cardText: {
    fontSize: 18,
    fontWeight: 'bold',
    userSelect: 'none' as any,
  },
  cardBackText: {
    fontSize: 14,
    color: '#D32F2F',
    fontWeight: 'bold',
    userSelect: 'none' as any,
  },
  gameOverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameOverText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  gameOverButtons: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 20,
  },
  tutorialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEB3B',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  tutorialText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
    marginRight: 10,
  },
  tutorialDismissBtn: {
    backgroundColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tutorialDismissText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  selectedSummaryContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    flexWrap: 'wrap',
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 5,
  },
  miniCard: {
    width: 32,
    height: 48,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
    marginVertical: 3,
  },
  miniCardText: {
    fontSize: 14,
    fontWeight: 'bold',
    userSelect: 'none' as any,
  },
  miniCardSuit: {
    fontSize: 12,
    userSelect: 'none' as any,
  }
});

export default memo(GameBoard);

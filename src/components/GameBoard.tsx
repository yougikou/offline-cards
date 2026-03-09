import React, { memo, useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, Button, ScrollView, TouchableOpacity, Modal, Animated, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import DraggableCard from './DraggableCard';

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
            {isSandbox && (
              <TouchableOpacity style={{ marginTop: 5, backgroundColor: '#2196F3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }} onPress={() => onAction('drawAndPass')} disabled={!isOpponentTurn || gameOver}>
                <Text style={{ color: 'white', fontSize: 10 }}>Draw</Text>
              </TouchableOpacity>
            )}
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
                      <Text style={[styles.cardText, { color: 'white', fontSize: 24 }]}>
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
            <View style={styles.tableContainer}>
              {currentTrick.map((c: any, index: number) => {
                const textColor = c.suit === 'Hearts' || c.suit === 'Diamonds' || c.rank === 'Red Joker' ? 'red' : 'black';
                return (
                  <View key={`trick-${index}`} style={[styles.card, { backgroundColor: 'white', width: 60, height: 90 }]}>
                    <Text style={[styles.cardText, { color: textColor, fontSize: 20 }]}>
                      {c.rank}
                    </Text>
                    {c.suit && (
                      <Text style={{ color: textColor, fontSize: 16 }}>
                        {c.suit === 'Hearts' ? '♥' : c.suit === 'Diamonds' ? '♦' : c.suit === 'Clubs' ? '♣' : '♠'}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>

      {/* Controls Area (Absolutely Positioned above hand) */}
      <View style={styles.controlsArea}>
        <View style={styles.controlRow}>
          {gameName === 'UnoLite' ? (
            <TouchableOpacity
              style={[styles.fab, (!isMyTurn || gameOver) ? styles.fabDisabled : { backgroundColor: '#2196F3' }]}
              onPress={() => onAction('drawAndPass')}
              disabled={!isMyTurn || gameOver}
            >
              <Text style={styles.fabText}>{isMyTurn ? t('game.drawCard') : t('game.waitingForOpponent')}</Text>
            </TouchableOpacity>
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
            </>
          )}
        </View>
        <Text style={[styles.sandboxTitle, { marginBottom: 10, textAlign: 'center' }]}>
          P{(G.players || []).indexOf(myPlayerId) + 1} {t('game.me')} {isMyTurn ? t('game.yourTurn') : ''}
        </Text>
      </View>

      {/* My Hand Area (Absolutely Positioned at Bottom, Fixed Height, High Z-Index) */}
      <View style={styles.myHandArea}>
        {(() => {
          const paddingHorizontal = 20;

          // Always use a fixed overlap to ensure hand looks consistent,
          // allowing the ScrollView to handle horizontal overflow naturally.
          const customMarginLeft = myHand.length > 1 ? -35 : 0;

          return (
            <View style={{ width: '100%', height: '100%' }}>
              <ScrollView
                horizontal={true}
                showsHorizontalScrollIndicator={false}
                // Removing justifyContent: 'center' so it scrolls properly from left to right when content is wide
                contentContainerStyle={{ flexGrow: 1, paddingHorizontal, paddingRight: 40, alignItems: 'flex-end', paddingBottom: 20 }}
                style={{ width: '100%', height: '100%', overflow: 'visible' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 20 }}>
                  {myHand.map((c: any, index: number) => renderCard(c, myPlayerId, index, false, index > 0 ? customMarginLeft : 0))}
                  {/* 给最后一张牌选择时往上腾出空间，以及往右的拖动缓冲 */}
                  <View style={{ width: 20 }} />
                </View>
              </ScrollView>
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
  },
  tableArea: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    zIndex: 1,
  },
  controlsArea: {
    position: 'absolute',
    bottom: 230,
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
    height: 220,
    zIndex: 100,
    elevation: 100,
    overflow: 'visible',
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
  },
  sandboxTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#fff',
  },
  activePlayerText: {
    color: '#FFD700', // Gold for active player
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
  },
  cardBack: {
    backgroundColor: '#111',
    borderColor: '#444',
  },
  cardText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardBackText: {
    fontSize: 14,
    color: '#D32F2F',
    fontWeight: 'bold',
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
  }
});

export default memo(GameBoard);

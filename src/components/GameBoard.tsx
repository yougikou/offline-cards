import React, { memo, useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, Button, ScrollView, Animated } from 'react-native';
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

  // Breathing light animation for the active turn border
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isMyTurn) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: false, // backgroundColor doesn't support native driver
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: false,
          })
        ])
      ).start();
    } else {
      glowAnim.setValue(0);
      glowAnim.stopAnimation();
    }
  }, [isMyTurn, glowAnim]);

  const animatedBorderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#64B5F6', '#1E88E5'] // From lighter to darker blue
  });
  const animatedBackgroundColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E3F2FD', '#BBDEFB'] // From lighter to darker light blue
  });

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
      onAction('playCard', cardIndex);
    }
  };

  const handleDragUp = (cardIndex: number) => {
    if (!isMyTurn || gameOver) return;

    if (gameName === 'UnoLite') {
      onAction('playCard', cardIndex);
    } else {
      // For ZhengShangYou, if dragging a card that is selected, play all selected.
      // If dragging a card that isn't selected, maybe select it and play it?
      if (selectedCards.includes(cardIndex)) {
        onAction('playCard', selectedCards);
        setSelectedCards([]);
      } else {
        // If they drag up an unselected card, just play that single card
        onAction('playCard', [cardIndex]);
        // Also remove it from selected if anything was selected to avoid state mismatches
        setSelectedCards([]);
      }
    }
  };

  const renderCard = (card: any, player: string, cardIndex: number, isOpponent: boolean = false) => {
    return (
      <DraggableCard
        key={card.id || `${player}-${cardIndex}-${Math.random()}`}
        card={card}
        index={cardIndex}
        totalCards={G.hands && G.hands[player] ? G.hands[player].length : 0}
        isMyTurn={isMyTurn && !gameOver}
        gameName={gameName}
        isSelected={selectedCards.includes(cardIndex)}
        onPress={handleCardPress}
        onDragUp={handleDragUp}
        isOpponent={isOpponent}
      />
    );
  };

  return (
    <View style={styles.sandboxContainer}>
      {gameOver && (
        <View style={styles.gameOverOverlay}>
          <Text style={styles.gameOverText}>
            {t('game.gameOver')}
          </Text>
          <Text style={styles.gameOverText}>
            {t('game.winner', { winner: gameOver.winner })}
          </Text>
        </View>
      )}

      {/* Upper 2/3: Interaction Area (Round Table) */}
      <View style={styles.interactionArea}>

        {/* Top Edge: Opponents Area */}
        <View style={styles.opponentsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.opponentsScroll}>
            {opponents.map((opponentId: string) => {
              const opponentHand = G.hands && G.hands[opponentId] ? G.hands[opponentId] : [];
              const isOpponentTurn = currentPlayerIdString === opponentId;

              return (
                <View key={opponentId} style={[styles.opponentArea, isSandbox && { transform: [{ rotate: '180deg' }] }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 }}>
                    <Text style={[styles.sandboxTitle, isOpponentTurn && styles.activePlayerText]}>
                      {opponentId} {isOpponentTurn ? t('game.turn') : ''}
                    </Text>
                    {isSandbox && (
                      <Button title={t('game.draw')} onPress={() => onAction('drawAndPass')} disabled={!isOpponentTurn || gameOver} />
                    )}
                    {!isSandbox && (
                      <Text style={{color: 'white'}}>{t('game.cardsCount', { count: opponentHand.length })}</Text>
                    )}
                  </View>
                  <View style={styles.handContainer}>
                    {opponentHand.map((c: any, index: number) => renderCard(c, opponentId, index, !isSandbox))}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Center: Table Area */}
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

      </View>

      {/* Lower 1/3: My Hand & Controls */}
      <Animated.View
        style={[
          styles.myHandArea,
          isMyTurn
            ? {
                borderColor: animatedBorderColor,
                backgroundColor: animatedBackgroundColor,
                borderTopWidth: 6,
              }
            : null
        ]}
      >

        <View style={styles.controlRow}>
          {onExit && (
            <Button title={t('game.exit')} color="red" onPress={onExit} />
          )}
          {onReset && isSandbox && (
            <Button title={t('game.resetGame')} color="orange" onPress={onReset} />
          )}
          {gameName === 'UnoLite' ? (
            <Button
              title={isMyTurn ? t('game.drawCard') : t('game.waitingForOpponent')}
              onPress={() => onAction('drawAndPass')}
              disabled={!isMyTurn || gameOver}
            />
          ) : (
            <>
              <Button
                title={isMyTurn ? t('game.playSelected') : t('game.waitingForOpponent')}
                onPress={() => {
                  onAction('playCard', selectedCards);
                  setSelectedCards([]);
                }}
                disabled={!isMyTurn || gameOver || selectedCards.length === 0}
              />
              <Button
                title={t('game.pass')}
                color="gray"
                onPress={() => {
                  onAction('pass');
                  setSelectedCards([]);
                }}
                disabled={!isMyTurn || gameOver || currentTrick.length === 0}
              />
            </>
          )}
        </View>

        <Text style={[styles.sandboxTitle, { color: isMyTurn ? 'blue' : '#333' }]}>
          {myPlayerId} {t('game.me')} {isMyTurn ? t('game.yourTurn') : ''}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={styles.scrollHandContainer}>
          <View style={{ width: 20 }} /> {/* Padding to prevent cut-off on scroll edge */}
          {myHand.map((c: any, index: number) => renderCard(c, myPlayerId, index, false))}
          <View style={{ width: 40 }} /> {/* Extra padding at end for overlapping cards */}
        </ScrollView>

      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  sandboxContainer: {
    flex: 1,
    width: '100%',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  interactionArea: {
    flex: 2,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#2E7D32', // Darker green for Uno table
  },
  opponentsContainer: {
    width: '100%',
    height: 180, // Fixed height or flexible
  },
  opponentsScroll: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    gap: 10,
  },
  opponentArea: {
    width: 250,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 10,
    borderRadius: 8,
  },
  tableArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 10,
  },
  myHandArea: {
    flex: 1,
    backgroundColor: '#fff3e0',
    borderTopWidth: 4,
    borderColor: '#ccc',
    padding: 10,
    alignItems: 'center',
  },
  myTurnArea: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 10,
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
  }
});

export default memo(GameBoard);

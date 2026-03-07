import React, { memo } from 'react';
import { StyleSheet, Text, View, Button, ScrollView, TouchableOpacity } from 'react-native';

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
  if (!gameState || !gameState.G) return null;

  const { G, ctx } = gameState;
  const opponents = (G.players || []).filter((p: string) => p !== myPlayerId);

  const myHand = G.hands && G.hands[myPlayerId] ? G.hands[myPlayerId] : [];
  const discardPile = G.discardPile || [];
  const deckCount = G.deckCount ?? (G.deck ? G.deck.length : 0);

  // Determine if it's the current player's turn
  const currentPlayerIdString = G.players ? G.players[parseInt(ctx.currentPlayer, 10)] : null;
  const isMyTurn = currentPlayerIdString === myPlayerId;
  const gameOver = ctx.gameover;

  const renderCard = (card: any, player: string, cardIndex: number, isOpponent: boolean = false) => {
    if (isOpponent || card.hidden) {
      // Render card back
      return (
        <View key={card.id || Math.random().toString()} style={[styles.card, styles.cardBack]}>
          <Text style={styles.cardBackText}>UNO</Text>
        </View>
      );
    }

    const cardColor = card.color ? card.color.toLowerCase() : 'gray';

    return (
      <TouchableOpacity
        key={card.id}
        style={[styles.card, { backgroundColor: cardColor, borderColor: '#333' }]}
        onPress={() => {
          if (isMyTurn && !gameOver) {
            onAction('playCard', cardIndex);
          }
        }}
        disabled={!isMyTurn || gameOver}
      >
        <Text style={[styles.cardText, { color: 'white' }]}>
          {card.value}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.sandboxContainer}>
      {gameOver && (
        <View style={styles.gameOverOverlay}>
          <Text style={styles.gameOverText}>
            Game Over! Winner: {gameOver.winner}
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
                      {opponentId} {isOpponentTurn ? '(Turn)' : ''}
                    </Text>
                    {isSandbox && (
                      <Button title="Draw" onPress={() => onAction('drawAndPass')} disabled={!isOpponentTurn || gameOver} />
                    )}
                    {!isSandbox && (
                      <Text style={{color: 'white'}}>Cards: {opponentHand.length}</Text>
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 400, marginBottom: 10 }}>
            <Text style={styles.sandboxTitle}>Discard Pile (Top)</Text>
            <Text style={styles.sandboxTitle}>Deck: {deckCount}</Text>
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
        </View>

      </View>

      {/* Lower 1/3: My Hand & Controls */}
      <View style={[styles.myHandArea, isMyTurn ? styles.myTurnArea : null]}>

        <View style={styles.controlRow}>
          {onExit && (
            <Button title="Exit" color="red" onPress={onExit} />
          )}
          {onReset && isSandbox && (
            <Button title="Reset Game" color="orange" onPress={onReset} />
          )}
          <Button
            title={isMyTurn ? "Draw Card" : "Wait for turn..."}
            onPress={() => onAction('drawAndPass')}
            disabled={!isMyTurn || gameOver}
          />
        </View>

        <Text style={[styles.sandboxTitle, { color: isMyTurn ? 'blue' : '#333' }]}>
          {myPlayerId} (Me) {isMyTurn ? '- YOUR TURN!' : ''}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={styles.scrollHandContainer}>
          {myHand.map((c: any, index: number) => renderCard(c, myPlayerId, index, false))}
        </ScrollView>

      </View>
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
    paddingHorizontal: 10,
    gap: 10,
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

import React, { memo } from 'react';
import { StyleSheet, Text, View, Button, ScrollView, TouchableOpacity } from 'react-native';
import { GameState, GameAction } from '../game-modules/types';

interface GameBoardProps {
  gameState: GameState;
  myPlayerId: string;
  onAction: (action: GameAction) => void;
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
  const opponents = (gameState.players || []).filter(p => p !== myPlayerId);

  const myHand = gameState.hands && gameState.hands[myPlayerId] ? gameState.hands[myPlayerId] : [];
  const tableCards = gameState.table || [];
  const deckCount = gameState.deckCount ?? (gameState.deck ? gameState.deck.length : 0);

  const renderCard = (card: any, player: string, isOpponent: boolean = false) => {
    if (isOpponent || card.hidden) {
      // Render card back
      return (
        <View key={card.id || Math.random().toString()} style={[styles.card, styles.cardBack]}>
          <Text style={styles.cardBackText}>?</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        key={card.id}
        style={styles.card}
        onPress={() => onAction({ type: 'PLAY_CARD', player, cardId: card.id })}
      >
        <Text style={[styles.cardText, (card.suit === 'Hearts' || card.suit === 'Diamonds') ? {color: 'red'} : {color: 'black'}]}>
          {card.rank}
          {card.suit === 'Hearts' ? '♥' : card.suit === 'Diamonds' ? '♦' : card.suit === 'Clubs' ? '♣' : '♠'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.sandboxContainer}>
      {/* Upper 2/3: Interaction Area (Round Table) */}
      <View style={styles.interactionArea}>

        {/* Top Edge: Opponents Area */}
        <View style={styles.opponentsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.opponentsScroll}>
            {opponents.map(opponentId => {
              const opponentHand = gameState.hands && gameState.hands[opponentId] ? gameState.hands[opponentId] : [];
              return (
                <View key={opponentId} style={[styles.opponentArea, isSandbox && { transform: [{ rotate: '180deg' }] }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 }}>
                    <Text style={styles.sandboxTitle}>
                      {opponentId}
                    </Text>
                    {isSandbox && (
                      <Button title="Draw" onPress={() => onAction({ type: 'DRAW_CARD', player: opponentId })} />
                    )}
                    {!isSandbox && (
                      <Text>Cards: {opponentHand.length}</Text>
                    )}
                  </View>
                  <View style={styles.handContainer}>
                    {opponentHand.map((c: any) => renderCard(c, opponentId, !isSandbox))}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Center: Table Area */}
        <View style={styles.tableArea}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 400, marginBottom: 10 }}>
            <Text style={styles.sandboxTitle}>Table</Text>
            <Text style={styles.sandboxTitle}>Deck: {deckCount}</Text>
          </View>
          <View style={styles.tableContainer}>
            {tableCards.map((c: any) => (
              <View key={c.id} style={styles.card}>
                <Text style={[styles.cardText, (c.suit === 'Hearts' || c.suit === 'Diamonds') ? {color: 'red'} : {color: 'black'}]}>
                  {c.rank}
                  {c.suit === 'Hearts' ? '♥' : c.suit === 'Diamonds' ? '♦' : c.suit === 'Clubs' ? '♣' : '♠'}
                </Text>
              </View>
            ))}
          </View>
        </View>

      </View>

      {/* Lower 1/3: My Hand & Controls */}
      <View style={styles.myHandArea}>

        <View style={styles.controlRow}>
          {onExit && (
            <Button title="Exit" color="red" onPress={onExit} />
          )}
          {onReset && isSandbox && (
            <Button title="Reset Game" color="orange" onPress={onReset} />
          )}
          <Button title="Draw Card" onPress={() => onAction({ type: 'DRAW_CARD', player: myPlayerId })} />
        </View>

        <Text style={styles.sandboxTitle}>
          {myPlayerId} (Me)
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={styles.scrollHandContainer}>
          {myHand.map((c: any) => renderCard(c, myPlayerId, false))}
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
    backgroundColor: '#e8f5e9', // Light green for the "table"
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
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
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
    borderTopWidth: 2,
    borderColor: '#ccc',
    padding: 10,
    alignItems: 'center',
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
    color: '#333',
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
    width: 40,
    height: 60,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  cardBack: {
    backgroundColor: '#3f51b5',
    borderColor: '#303f9f',
  },
  cardText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardBackText: {
    fontSize: 18,
    color: 'white',
    fontWeight: 'bold',
  }
});

export default memo(GameBoard);

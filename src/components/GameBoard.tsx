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
  const opponentId = myPlayerId === 'host' ? 'guest' : 'host';

  const myHand = gameState.players[myPlayerId]?.hand || [];
  const opponentHand = gameState.players[opponentId]?.hand || [];
  const tableCards = gameState.table || [];

  const renderCard = (card: any, player: string, isOpponent: boolean = false) => {
    if (isOpponent) {
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

        {/* Top Edge: Opponent Area */}
        <View style={[styles.opponentArea, isSandbox && { transform: [{ rotate: '180deg' }] }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 }}>
            <Text style={styles.sandboxTitle}>
              {opponentId.charAt(0).toUpperCase() + opponentId.slice(1)} (Opponent)
            </Text>
            {isSandbox && (
              <Button title="Opponent Draw" onPress={() => onAction({ type: 'DRAW_CARD', player: opponentId })} />
            )}
            {!isSandbox && (
              <Text>Cards: {opponentHand.length}</Text>
            )}
          </View>
          <View style={styles.handContainer}>
            {opponentHand.map((c: any) => renderCard(c, opponentId, !isSandbox))}
          </View>
        </View>

        {/* Center: Table Area */}
        <View style={styles.tableArea}>
          <Text style={styles.sandboxTitle}>Table</Text>
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
          {myPlayerId.charAt(0).toUpperCase() + myPlayerId.slice(1)} (Me)
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
    paddingVertical: 20,
    paddingHorizontal: 10,
    backgroundColor: '#e8f5e9', // Light green for the "table"
  },
  opponentArea: {
    width: '100%',
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
    marginTop: 20,
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
    fontSize: 18,
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

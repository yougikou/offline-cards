import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { canPlay, Card, JiangsuTaopaiState } from '../../game-modules/JiangsuTaopai';

interface JiangsuTaopaiControlsProps {
  G: JiangsuTaopaiState;
  ctx: any;
  myPlayerId: string;
  isMyTurn: boolean;
  gameOver: any;
  selectedCards: number[];
  myHand: Card[];
  onAction: (moveName: string, ...args: any[]) => void;
  setSelectedCards: React.Dispatch<React.SetStateAction<number[]>>;
}

export const JiangsuTaopaiControls: React.FC<JiangsuTaopaiControlsProps> = ({
  G,
  ctx,
  myPlayerId,
  isMyTurn,
  gameOver,
  selectedCards,
  myHand,
  onAction,
  setSelectedCards
}) => {
  const { t } = useTranslation();

  const currentTrickTop = G.currentTrick.length > 0 ? G.currentTrick[G.currentTrick.length - 1] : undefined;
  const isFreshLead = !currentTrickTop;

  // Evaluate if the current selection is playable
  const selectedHandCards = selectedCards.map(idx => myHand[idx]);
  const isSelectionPlayable = selectedHandCards.length > 0 && canPlay(selectedHandCards, currentTrickTop);

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        style={[
          styles.fab,
          (!isMyTurn || gameOver || isFreshLead) ? styles.fabDisabled : { backgroundColor: '#9E9E9E' }
        ]}
        onPress={() => {
          onAction('pass');
          setSelectedCards([]);
        }}
        disabled={!isMyTurn || gameOver || isFreshLead}
      >
        <Text style={styles.fabText}>{t('game.pass')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        style={[
          styles.fab,
          (!isMyTurn || gameOver || !isSelectionPlayable) ? styles.fabDisabled : { backgroundColor: '#4CAF50', marginLeft: 10 },
          (isMyTurn && !gameOver && isSelectionPlayable) ? styles.fabActiveGlow : null
        ]}
        onPress={() => {
          if (isSelectionPlayable) {
            onAction('playCard', selectedCards);
            setSelectedCards([]);
          }
        }}
        disabled={!isMyTurn || gameOver || !isSelectionPlayable}
      >
        <Text style={styles.fabText}>{t('game.playSelected')}</Text>
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: 'gray',
    opacity: 0.5,
    elevation: 0,
    shadowOpacity: 0,
  },
  fabActiveGlow: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 8,
  },
  fabText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
    userSelect: 'none' as any,
  },
});

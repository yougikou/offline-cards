import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface SanGuoShaControlsProps {
  ctx: any;
  myPlayerId: string;
  isMyTurn: boolean;
  gameOver: boolean;
  selectedCards: number[];
  myHand: any[];
  onAction: (action: string, args?: any) => void;
  setPendingActionCardIndex: (index: number | null) => void;
  setTargetSelectionVisible: (visible: boolean) => void;
  setSelectedCards: (cards: number[]) => void;
}

export const SanGuoShaControls: React.FC<SanGuoShaControlsProps> = ({
  ctx,
  myPlayerId,
  isMyTurn,
  gameOver,
  selectedCards,
  myHand,
  onAction,
  setPendingActionCardIndex,
  setTargetSelectionVisible,
  setSelectedCards
}) => {
  const { t } = useTranslation();

  return (
    <>
      {ctx.activePlayers && ctx.activePlayers[myPlayerId] === 'respond' && (
        <TouchableOpacity accessibilityRole="button"
          style={[styles.fab, { backgroundColor: '#F44336' }]}
          onPress={() => onAction('takeDamage')}
        >
          <Text style={styles.fabText}>{t('game.sgs_action_takeDamage')}</Text>
        </TouchableOpacity>
      )}
      {(!ctx.activePlayers || !ctx.activePlayers[myPlayerId]) && (
        <TouchableOpacity accessibilityRole="button"
          style={[styles.fab, { backgroundColor: '#9E9E9E' }]}
          onPress={() => onAction('endPlayPhase')}
        >
          <Text style={styles.fabText}>{t('game.sgs_action_endPlayPhase')}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity accessibilityRole="button"
        style={[
          styles.fab,
          (!isMyTurn || gameOver || selectedCards.length === 0) ? styles.fabDisabled : { backgroundColor: '#4CAF50', marginLeft: 10 },
          (isMyTurn && !gameOver && selectedCards.length > 0) ? styles.fabActiveGlow : null
        ]}
        onPress={() => {
          if (selectedCards.length > 0) {
            const cardIndex = selectedCards[0];
            const card = myHand[cardIndex];
            if (card) {
              if (ctx.activePlayers && ctx.activePlayers[myPlayerId] === 'respond') {
                 if (card.name === 'Dodge') onAction('playDodge', cardIndex);
              } else {
                 if (card.name === 'Kill') {
                    setPendingActionCardIndex(cardIndex);
                    setTargetSelectionVisible(true);
                    return; // Do not clear selection yet
                 } else if (card.name === 'Peach') {
                    onAction('playPeach', cardIndex);
                 } else if (ctx.activePlayers && ctx.activePlayers[myPlayerId] === 'discard') {
                    onAction('discardCards', [cardIndex]);
                 }
              }
              setSelectedCards([]);
            }
          }
        }}
        disabled={!isMyTurn || gameOver || selectedCards.length === 0}
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
    backgroundColor: 'gray', // Faded color for disabled
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

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
  selectedTargetId: string | null;
  setSelectedTargetId: (id: string | null) => void;
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
  selectedTargetId,
  setSelectedTargetId,
  setSelectedCards
}) => {
  const { t } = useTranslation();

  // Only the active player (the one whose actual turn it is) can end their play phase.
  const isActuallyMyTurn = parseInt(ctx.currentPlayer, 10) === ctx.playOrder.indexOf(myPlayerId);

  // Determine if I'm currently required to respond (e.g. to a Kill)
  const isMyResponseWindow = ctx.activePlayers && ctx.activePlayers[myPlayerId] === 'respond';
  const isMyDiscardWindow = ctx.activePlayers && ctx.activePlayers[myPlayerId] === 'discard';

  const selectedCard = selectedCards.length > 0 ? myHand[selectedCards[0]] : null;
  const requiresTarget = selectedCard && selectedCard.name === 'Kill';
  const canPlay = isMyTurn && !gameOver && selectedCard && (!requiresTarget || selectedTargetId);

  return (
    <>
      {isMyResponseWindow && (
        <TouchableOpacity accessibilityRole="button"
          style={[styles.fab, { backgroundColor: '#F44336' }]}
          onPress={() => onAction('takeDamage')}
        >
          <Text style={styles.fabText}>{t('game.sgs_action_takeDamage')}</Text>
        </TouchableOpacity>
      )}
      {isActuallyMyTurn && !ctx.activePlayers && (
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
          !canPlay ? styles.fabDisabled : { backgroundColor: '#4CAF50', marginLeft: 10 },
          canPlay ? styles.fabActiveGlow : null
        ]}
        onPress={() => {
          if (canPlay && selectedCard) {
            const cardIndex = selectedCards[0];
            if (ctx.activePlayers && ctx.activePlayers[myPlayerId] === 'respond') {
               if (selectedCard.name === 'Dodge') onAction('playDodge', cardIndex);
            } else {
               if (selectedCard.name === 'Kill') {
                  onAction('playKill', { cardIndex, targetId: selectedTargetId });
               } else if (selectedCard.name === 'Peach') {
                  onAction('playPeach', cardIndex);
               } else if (ctx.activePlayers && ctx.activePlayers[myPlayerId] === 'discard') {
                  onAction('discardCards', [cardIndex]);
               }
            }
            setSelectedCards([]);
            setSelectedTargetId(null);
          }
        }}
        disabled={!canPlay}
      >
        <Text style={styles.fabText}>{requiresTarget && !selectedTargetId ? t('game.sgs_selectTarget') : t('game.playSelected')}</Text>
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

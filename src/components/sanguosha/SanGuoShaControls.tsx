import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Button } from 'react-native';
import { useTranslation } from 'react-i18next';

interface SanGuoShaControlsProps {
  G: any;
  ctx: any;
  myPlayerId: string;
  isMyTurn: boolean;
  gameOver: boolean;
  selectedCards: number[];
  myHand: any[];
  opponents: string[];
  onAction: (action: string, args?: any) => void;
  setSelectedCards: (cards: number[]) => void;
}

export const SanGuoShaControls: React.FC<SanGuoShaControlsProps> = ({
  G,
  ctx,
  myPlayerId,
  isMyTurn,
  gameOver,
  selectedCards,
  myHand,
  opponents,
  onAction,
  setSelectedCards
}) => {
  const { t } = useTranslation();
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  // Clear target when selection changes or turn ends
  useEffect(() => {
    setSelectedTargetId(null);
  }, [selectedCards, isMyTurn]);

  // Determine if we are in targeting mode
  let isTargetingMode = false;
  if (selectedCards.length > 0) {
    const cardIndex = selectedCards[0];
    const card = myHand[cardIndex];
    if (card && card.name === 'Kill' && (!ctx.activePlayers || !ctx.activePlayers[myPlayerId])) {
      isTargetingMode = true;
    }
  }

  // If waiting for response
  const isWaitingForResponse = G.activeTarget !== null;

  return (
    <>
      {isTargetingMode && (
        <View style={styles.targetSelectionContainer}>
          <Text style={styles.targetSelectionTitle}>{t('game.sgs_selectTarget')}</Text>
          <View style={styles.targetList}>
            {opponents.map((oppId: string) => {
              const oppState = G.playerStates?.[oppId];
              if (!oppState || oppState.dead) return null;
              const pIndex = (G.players || []).indexOf(oppId) + 1;
              const isSelected = selectedTargetId === oppId;
              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  key={oppId}
                  style={[styles.targetButton, isSelected && styles.targetButtonSelected]}
                  onPress={() => setSelectedTargetId(oppId)}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>P{pIndex}</Text>
                  <Text style={{ color: '#FFEB3B', fontWeight: 'bold', fontSize: 12, marginTop: 4 }}>HP: {oppState.hp}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {isWaitingForResponse && (!ctx.activePlayers || !ctx.activePlayers[myPlayerId]) && (
        <View style={styles.waitingContainer}>
           <Text style={styles.waitingText}>{t('game.waitingForOpponent')}</Text>
        </View>
      )}

      <View style={styles.buttonsContainer}>
        {ctx.activePlayers && ctx.activePlayers[myPlayerId] === 'respond' && (
          <TouchableOpacity accessibilityRole="button"
            style={[styles.fab, { backgroundColor: '#F44336' }]}
            onPress={() => onAction('takeDamage')}
          >
            <Text style={styles.fabText}>{t('game.sgs_action_takeDamage')}</Text>
          </TouchableOpacity>
        )}
        {(!ctx.activePlayers || !ctx.activePlayers[myPlayerId]) && !isWaitingForResponse && (
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
            (!isMyTurn || gameOver || selectedCards.length === 0 || (isTargetingMode && !selectedTargetId)) ? styles.fabDisabled : { backgroundColor: '#4CAF50', marginLeft: 10 },
            (isMyTurn && !gameOver && selectedCards.length > 0 && (!isTargetingMode || selectedTargetId)) ? styles.fabActiveGlow : null
          ]}
          onPress={() => {
            if (selectedCards.length > 0) {
              const cardIndex = selectedCards[0];
              const card = myHand[cardIndex];
              if (card) {
                if (ctx.activePlayers && ctx.activePlayers[myPlayerId] === 'respond') {
                   if (card.name === 'Dodge') onAction('playDodge', cardIndex);
                } else {
                   if (card.name === 'Kill' && selectedTargetId) {
                      onAction('playKill', { cardIndex, targetId: selectedTargetId });
                   } else if (card.name === 'Peach') {
                      onAction('playPeach', cardIndex);
                   } else if (ctx.activePlayers && ctx.activePlayers[myPlayerId] === 'discard') {
                      onAction('discardCards', [cardIndex]);
                   }
                }
                setSelectedCards([]);
                setSelectedTargetId(null);
              }
            }
          }}
          disabled={!isMyTurn || gameOver || selectedCards.length === 0 || (isTargetingMode && !selectedTargetId)}
        >
          <Text style={styles.fabText}>{t('game.playSelected')}</Text>
        </TouchableOpacity>
      </View>
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
  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetSelectionContainer: {
    position: 'absolute',
    bottom: 80,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
    width: '90%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  targetSelectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  targetList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  targetButton: {
    backgroundColor: '#D32F2F',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 70,
    elevation: 4,
  },
  targetButtonSelected: {
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
  },
  waitingContainer: {
    position: 'absolute',
    bottom: 80,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 12,
    alignSelf: 'center',
  },
  waitingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

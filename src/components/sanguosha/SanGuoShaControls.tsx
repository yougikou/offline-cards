import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Button } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getDistance } from '../../game-modules/sanguosha';

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

  const myPlayerIndex = (G.players || []).indexOf(myPlayerId).toString();
  const myActiveStage = ctx.activePlayers ? ctx.activePlayers[myPlayerIndex] : undefined;

  // Determine if we are in targeting mode
  const needsTarget = (cardName: string) => {
    return ['Kill', 'GuoHeChaiQiao', 'ShunShouQianYang', 'JueDou', 'JieDaoShaRen', 'LeBuSiShu', 'ShanDian'].includes(cardName);
  };

  let isTargetingMode = false;
  if (selectedCards.length > 0) {
    const cardIndex = selectedCards[0];
    const card = myHand[cardIndex];
    if (card && needsTarget(card.name) && !myActiveStage) {
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
            {G.players.map((pId: string) => {
              if (pId === myPlayerId && myHand[selectedCards[0]]?.name !== 'ShanDian') {
                // Usually cannot target self for most cards, except ShanDian
                // LeBuSiShu cannot target self
                return null;
              }
              const oppState = G.playerStates?.[pId];
              if (!oppState || oppState.dead) return null;
              const pIndex = (G.players || []).indexOf(pId) + 1;
              const isSelected = selectedTargetId === pId;
              const distance = getDistance(G, myPlayerId, pId);
              const card = myHand[selectedCards[0]];

              let outOfRange = false;
              if (card) {
                // Kill distance limitation
                if (card.name === 'Kill' && distance > 1) {
                   // Check weapon distance
                   let attackRange = 1;
                   const weapon = G.playerStates[myPlayerId]?.equipment?.weapon;
                   if (weapon && weapon.distance) {
                     attackRange = weapon.distance;
                   }
                   if (distance > attackRange) {
                      outOfRange = true;
                   }
                }
                // ShunShouQianYang distance limitation
                if (card.name === 'ShunShouQianYang' && distance > 1) {
                  outOfRange = true;
                }
              }

              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  key={pId}
                  style={[styles.targetButton, isSelected && styles.targetButtonSelected, outOfRange && { opacity: 0.4, backgroundColor: 'gray' }]}
                  onPress={() => {
                    if (!outOfRange) {
                      setSelectedTargetId(pId);
                    }
                  }}
                  disabled={outOfRange}
                >
                  {outOfRange && <Text style={{position: 'absolute', top: -5, right: -5, fontSize: 10, backgroundColor: 'red', color: 'white', padding: 2, borderRadius: 5, zIndex: 10, overflow: 'hidden'}}>Dist &gt; 1</Text>}
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>P{pIndex}</Text>
                  <Text style={{ color: '#FFEB3B', fontWeight: 'bold', fontSize: 12, marginTop: 4 }}>HP: {oppState.hp}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {isWaitingForResponse && !myActiveStage && (
        <View style={styles.waitingContainer}>
           <Text style={styles.waitingText}>{t('game.waitingForOpponent')}</Text>
        </View>
      )}

      <View style={styles.buttonsContainer}>
        {myActiveStage === 'respond' && (
          <TouchableOpacity accessibilityRole="button"
            style={[styles.fab, { backgroundColor: '#F44336', marginRight: 10 }]}
            onPress={() => onAction('takeDamage')}
          >
            <Text style={styles.fabText}>{t('game.sgs_action_takeDamage', 'Take Damage')}</Text>
          </TouchableOpacity>
        )}
        {myActiveStage === 'dying' && (
          <TouchableOpacity accessibilityRole="button"
            style={[styles.fab, { backgroundColor: '#9E9E9E', marginRight: 10 }]}
            onPress={() => onAction('passPeach')}
          >
            <Text style={styles.fabText}>{t('game.sgs_action_passPeach', 'Pass')}</Text>
          </TouchableOpacity>
        )}
        {!myActiveStage && !isWaitingForResponse && (
          <TouchableOpacity accessibilityRole="button"
            style={[styles.fab, { backgroundColor: '#9E9E9E' }]}
            onPress={() => onAction('endPlayPhase')}
          >
            <Text style={styles.fabText}>{t('game.sgs_action_endPlayPhase')}</Text>
          </TouchableOpacity>
        )}
        {myActiveStage === 'respondToNanMan' && (
          <TouchableOpacity accessibilityRole="button"
            style={[styles.fab, { backgroundColor: '#F44336', marginRight: 10 }]}
            onPress={() => onAction('takeDamageForNanMan')}
          >
            <Text style={styles.fabText}>{t('game.sgs_action_takeDamage', 'Take Damage')}</Text>
          </TouchableOpacity>
        )}
        {myActiveStage === 'respondToWanJian' && (
          <TouchableOpacity accessibilityRole="button"
            style={[styles.fab, { backgroundColor: '#F44336', marginRight: 10 }]}
            onPress={() => onAction('takeDamageForWanJian')}
          >
            <Text style={styles.fabText}>{t('game.sgs_action_takeDamage', 'Take Damage')}</Text>
          </TouchableOpacity>
        )}
        {myActiveStage === 'respondToJueDou' && (
          <TouchableOpacity accessibilityRole="button"
            style={[styles.fab, { backgroundColor: '#F44336', marginRight: 10 }]}
            onPress={() => onAction('takeDamageForJueDou')}
          >
            <Text style={styles.fabText}>{t('game.sgs_action_takeDamage', 'Take Damage')}</Text>
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
                if (myActiveStage === 'respond') {
                   if (card.name === 'Dodge') onAction('playDodge', cardIndex);
                } else if (myActiveStage === 'dying') {
                   if (card.name === 'Peach') onAction('playPeachOnDying', cardIndex);
                } else if (myActiveStage === 'respondToNanMan') {
                   if (card.name === 'Kill') onAction('playKillForNanMan', cardIndex);
                } else if (myActiveStage === 'respondToWanJian') {
                   if (card.name === 'Dodge') onAction('playDodgeForWanJian', cardIndex);
                } else if (myActiveStage === 'respondToJueDou') {
                   if (card.name === 'Kill') onAction('playKillForJueDou', cardIndex);
                } else {
                   if (card.cardType === 'Equipment') {
                      onAction('equipCard', cardIndex);
                   } else if (card.name === 'Kill' && selectedTargetId) {
                      onAction('playKill', { cardIndex, targetId: selectedTargetId });
                   } else if (card.name === 'Peach') {
                      onAction('playPeach', cardIndex);
                   } else if (card.name === 'WuZhongShengYou') {
                      onAction('playWuZhongShengYou', cardIndex);
                   } else if (card.name === 'GuoHeChaiQiao' && selectedTargetId) {
                      onAction('playGuoHeChaiQiao', { cardIndex, targetId: selectedTargetId, targetZone: 'hand', targetCardIndex: 0 }); // MVP random discard
                   } else if (card.name === 'ShunShouQianYang' && selectedTargetId) {
                      onAction('playShunShouQianYang', { cardIndex, targetId: selectedTargetId });
                   } else if (card.name === 'TaoYuanJieYi') {
                      onAction('playTaoYuanJieYi', cardIndex);
                   } else if (card.name === 'NanManRuQin') {
                      onAction('playNanManRuQin', cardIndex);
                   } else if (card.name === 'WanJianQiFa') {
                      onAction('playWanJianQiFa', cardIndex);
                   } else if (card.name === 'JueDou' && selectedTargetId) {
                      onAction('playJueDou', { cardIndex, targetId: selectedTargetId });
                   } else if (card.name === 'WuGuFengDeng') {
                      onAction('playWuGuFengDeng', cardIndex);
                   } else if (card.name === 'WuXieKeJi') {
                      onAction('playWuXieKeJi', cardIndex);
                   } else if (card.name === 'JieDaoShaRen' && selectedTargetId) {
                      onAction('playJieDaoShaRen', { cardIndex, targetId: selectedTargetId });
                   } else if (card.cardType === 'DelayedStratagem' && selectedTargetId) {
                      onAction('playDelayStratagem', { cardIndex, targetId: selectedTargetId });
                   } else if (myActiveStage === 'discard') {
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

      {/* Dying alert visually */}
      {G.dyingPlayer && (
        <View style={styles.dyingOverlay}>
           <Text style={styles.dyingText}>
             {G.dyingPlayer === myPlayerId ? t('game.sgs_dying_self', 'You are dying!') : t('game.sgs_dying_other', `P${(G.players || []).indexOf(G.dyingPlayer) + 1} is dying!`)}
           </Text>
           <Text style={{color: 'white', marginTop: 5}}>
             {t('game.sgs_dying_prompt', 'Need a Peach to save them.')}
           </Text>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
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
    fontSize: 14,
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
  },
  dyingOverlay: {
    position: 'absolute',
    top: -60,
    backgroundColor: 'rgba(211, 47, 47, 0.9)', // Red alert
    padding: 10,
    borderRadius: 8,
    alignSelf: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  dyingText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  }
});

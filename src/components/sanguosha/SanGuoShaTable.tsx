import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';

interface SanGuoShaTableProps {
  G: any;
  myPlayerId: string;
  tableAnim: Animated.Value;
}

export const SanGuoShaTable: React.FC<SanGuoShaTableProps> = ({ G, myPlayerId, tableAnim }) => {
  const { t } = useTranslation();

  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%', maxWidth: 400, marginBottom: 10 }}>
        <Text style={styles.sandboxTitle}>
          {G.playerStates[myPlayerId]?.hero ? t('game.sgs_hero_' + G.playerStates[myPlayerId].hero) + ' | ' : ''}
          HP: {G.playerStates[myPlayerId]?.hp}/{G.playerStates[myPlayerId]?.maxHp} |
          Role: {G.playerStates[myPlayerId]?.role ? t('game.sgs_role_' + G.playerStates[myPlayerId]?.role) : ''}
        </Text>
      </View>
      {G.pendingCard && (
         <Animated.View style={[styles.tableContainer, {
            transform: [
              { translateY: tableAnim.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) },
              { scale: tableAnim.interpolate({ inputRange: [0, 1], outputRange: [1.5, 1] }) }
            ]
          }]}>
            <View style={[styles.card, { backgroundColor: 'white', width: 60, height: 90 }]}>
              <Text style={{ color: 'black', fontSize: 16, fontWeight: 'bold' }}>{t('game.sgs_card_' + G.pendingCard.name)}</Text>
            </View>
         </Animated.View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  sandboxTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#fff',
    userSelect: 'none' as any,
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
    userSelect: 'none' as any,
  },
});

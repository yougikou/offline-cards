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
  const playerState = G.playerStates[myPlayerId];

  if (!playerState) return null;

  return (
    <View style={styles.container}>
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

      <View style={styles.dashboardContainer}>
        {/* Judgment Area */}
        <View style={styles.judgmentsArea}>
           <Text style={styles.areaLabel}>{t('game.sgs_judgments')}</Text>
           <View style={styles.slotsRow}>
             {playerState.judgments?.map((card: any, idx: number) => (
                <View key={idx} style={styles.smallCard}>
                  <Text style={styles.smallCardText}>{t('game.sgs_card_' + card.name)}</Text>
                </View>
             ))}
             {(!playerState.judgments || playerState.judgments.length === 0) && (
                <View style={styles.emptySlot} />
             )}
           </View>
        </View>

        {/* Hero Info */}
        <View style={styles.heroCard}>
           <Text style={styles.heroName}>
             {playerState.hero ? t('game.sgs_hero_' + playerState.hero) : '---'}
           </Text>
           <View style={styles.hpContainer}>
             {Array.from({ length: playerState.maxHp || 0 }).map((_, i) => (
                <Text key={i} style={{ color: i < playerState.hp ? '#D32F2F' : '#757575', fontSize: 18, userSelect: 'none' as any }}>
                  ♥
                </Text>
             ))}
           </View>
           <Text style={styles.roleText}>
             {playerState.role ? t('game.sgs_role_' + playerState.role) : ''}
           </Text>
        </View>

        {/* Equipment Area */}
        <View style={styles.equipmentArea}>
           <View style={styles.equipmentCol}>
              <View style={styles.equipmentSlot}>
                <Text style={styles.slotLabel}>{t('game.sgs_equipment_weapon')}</Text>
                <Text style={styles.slotValue}>{playerState.equipment?.weapon ? t('game.sgs_card_' + playerState.equipment.weapon.name) : '---'}</Text>
              </View>
              <View style={styles.equipmentSlot}>
                <Text style={styles.slotLabel}>{t('game.sgs_equipment_armor')}</Text>
                <Text style={styles.slotValue}>{playerState.equipment?.armor ? t('game.sgs_card_' + playerState.equipment.armor.name) : '---'}</Text>
              </View>
           </View>
           <View style={styles.equipmentCol}>
              <View style={styles.equipmentSlot}>
                <Text style={styles.slotLabel}>{t('game.sgs_equipment_defensiveHorse')}</Text>
                <Text style={styles.slotValue}>{playerState.equipment?.defensiveHorse ? t('game.sgs_card_' + playerState.equipment.defensiveHorse.name) : '---'}</Text>
              </View>
              <View style={styles.equipmentSlot}>
                <Text style={styles.slotLabel}>{t('game.sgs_equipment_offensiveHorse')}</Text>
                <Text style={styles.slotValue}>{playerState.equipment?.offensiveHorse ? t('game.sgs_card_' + playerState.equipment.offensiveHorse.name) : '---'}</Text>
              </View>
           </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  tableContainer: {
    marginBottom: 40,
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
  dashboardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    width: '100%',
    maxWidth: 600,
    gap: 15,
  },
  heroCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    padding: 10,
    minWidth: 100,
    borderWidth: 2,
    borderColor: '#D32F2F',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 4,
  },
  heroName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    userSelect: 'none' as any,
    marginBottom: 4,
  },
  hpContainer: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
  },
  roleText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
    userSelect: 'none' as any,
  },
  equipmentArea: {
    flexDirection: 'row',
    gap: 10,
  },
  equipmentCol: {
    gap: 5,
  },
  equipmentSlot: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#555',
    minWidth: 80,
  },
  slotLabel: {
    fontSize: 10,
    color: '#AAA',
    userSelect: 'none' as any,
  },
  slotValue: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: 'bold',
    userSelect: 'none' as any,
  },
  judgmentsArea: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
    minWidth: 70,
    minHeight: 80,
  },
  areaLabel: {
    fontSize: 10,
    color: '#AAA',
    marginBottom: 4,
    userSelect: 'none' as any,
  },
  slotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  smallCard: {
    width: 30,
    height: 45,
    backgroundColor: 'white',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#999',
  },
  smallCardText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'black',
    userSelect: 'none' as any,
  },
  emptySlot: {
    width: 30,
    height: 45,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#555',
    borderStyle: 'dashed',
  }
});

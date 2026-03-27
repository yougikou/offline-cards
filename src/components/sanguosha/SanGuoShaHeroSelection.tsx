import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { STANDARD_HEROES } from '../../game-modules/sanguosha';

interface SanGuoShaHeroSelectionProps {
  G: any;
  ctx: any;
  myPlayerId: string;
  onAction: (moveName: string, ...args: any[]) => void;
}

export const SanGuoShaHeroSelection: React.FC<SanGuoShaHeroSelectionProps> = ({ G, ctx, myPlayerId, onAction }) => {
  const { t } = useTranslation();

  const isMyTurn = G.players && G.players[parseInt(ctx.currentPlayer, 10)] === myPlayerId;
  const myHero = G.playerStates?.[myPlayerId]?.hero;
  const choices = G.heroChoices?.[myPlayerId] || [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {myHero ? t('game.sgs_hero_selected', 'Hero Selected') : (isMyTurn ? t('game.sgs_select_hero', 'Select Your Hero') : t('game.sgs_waiting_hero_select', 'Waiting for others to select hero...'))}
      </Text>

      {/* Show role if available */}
      {G.playerStates?.[myPlayerId]?.role && (
        <Text style={styles.roleText}>
          {t('game.sgs_role', 'Your Role:')} <Text style={{fontWeight: 'bold', color: '#FFEB3B'}}>{t('game.sgs_role_' + G.playerStates[myPlayerId].role)}</Text>
        </Text>
      )}

      {!myHero && isMyTurn && (
        <View style={styles.heroList}>
          {choices.map((heroId: string) => {
            const heroData = STANDARD_HEROES.find(h => h.id === heroId);
            if (!heroData) return null;

            // Optional bonus hp logic for display
            const isLord = G.playerStates?.[myPlayerId]?.role === 'Lord';
            const bonusHp = (isLord && G.players.length > 2) ? 1 : 0;

            return (
              <TouchableOpacity
                accessibilityRole="button"
                key={heroId}
                style={styles.heroButton}
                onPress={() => onAction('selectHero', heroId)}
              >
                <Text style={styles.heroName}>{t('game.sgs_hero_' + heroId)}</Text>
                <Text style={styles.heroHp}>
                  HP: {heroData.hp + bonusHp} {bonusHp > 0 && <Text style={{color: '#4CAF50'}}>(+{bonusHp})</Text>}
                </Text>
                <Text style={styles.heroKingdom}>{heroData.kingdom}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {(!isMyTurn && !myHero) && (
        <Text style={{color: 'white', marginTop: 20}}>
          {t('game.sgs_waiting_turn', 'Please wait for your turn to select...')}
        </Text>
      )}

      {myHero && (
        <View style={styles.selectedHeroContainer}>
          <Text style={styles.selectedHeroName}>{t('game.sgs_hero_' + myHero)}</Text>
          <Text style={{color: 'white', marginTop: 10}}>{t('game.sgs_waiting_others', 'Waiting for other players...')}</Text>
        </View>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  roleText: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 30,
  },
  heroList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    maxWidth: 600,
  },
  heroButton: {
    backgroundColor: '#333333',
    borderWidth: 2,
    borderColor: '#555555',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    width: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
  },
  heroName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  heroHp: {
    fontSize: 16,
    color: '#D32F2F',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  heroKingdom: {
    fontSize: 14,
    color: '#888888',
  },
  selectedHeroContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  selectedHeroName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
  }
});

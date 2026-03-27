import React, { useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GameMode } from '../../../App';

interface GameLibraryProps {
  selectedGameMode: GameMode;
  setSelectedGameMode: (mode: GameMode) => void;
}

const GameLibrary: React.FC<GameLibraryProps> = ({
  selectedGameMode,
  setSelectedGameMode,
}) => {
  const { t } = useTranslation();

  const games = useMemo(() => [
    {
      id: 'UnoLite',
      name: t('lobby.game_UnoLite', 'UnoLite'),
      tags: ['2-8P', 'Family'],
      available: true,
      icon: (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, width: 40, height: 40, backgroundColor: '#000', borderRadius: 8, transform: [{ rotate: '-10deg' }] }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>UNO</Text>
          <View style={{ position: 'absolute', top: 2, left: 2, width: 8, height: 8, backgroundColor: '#FF3B30', borderRadius: 4 }} />
          <View style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, backgroundColor: '#FFCC00', borderRadius: 4 }} />
          <View style={{ position: 'absolute', bottom: 2, left: 2, width: 8, height: 8, backgroundColor: '#4CD964', borderRadius: 4 }} />
          <View style={{ position: 'absolute', bottom: 2, right: 2, width: 8, height: 8, backgroundColor: '#007AFF', borderRadius: 4 }} />
        </View>
      )
    },
    { id: 'ZhengShangYou', name: t('lobby.game_ZhengShangYou', 'ZhengShangYou'), tags: ['2-4P', 'Strategy'], available: true, icon: '♠️' },
    { id: 'JiangsuTaopai', name: t('lobby.game_JiangsuTaopai', 'JiangsuTaopai'), tags: ['2-3P', 'Classic'], available: true, icon: '🃏' },
    { id: 'SanGuoSha', name: t('lobby.game_SanGuoSha', 'SanGuoSha'), tags: ['2-8P', 'Roleplay'], available: true, icon: '⚔️' },
    { id: 'DouDiZhu', name: '斗地主 / Dou Di Zhu', tags: ['3P', 'Classic'], available: false, icon: '👨‍🌾' },
  ], [t]);

  return (
    <View style={styles.librarySection}>
      <Text style={styles.sectionTitle}>{t('lobby.selectGame', 'Game Library')}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={styles.gameCarousel}>
        {games.map(game => (
          <TouchableOpacity
            key={game.id}
            accessibilityRole="button"
            style={[
              styles.gameCard,
              selectedGameMode === game.id && styles.gameCardSelected,
              !game.available && styles.gameCardDisabled
            ]}
            onPress={() => game.available && setSelectedGameMode(game.id as any)}
            disabled={!game.available}
          >
            {typeof game.icon === 'string' ? (
              <Text style={styles.gameCardIcon}>{game.icon}</Text>
            ) : (
              game.icon
            )}
            <Text style={[styles.gameCardTitle, selectedGameMode === game.id && styles.gameCardTitleSelected]}>{game.name}</Text>
            <View style={styles.tagContainer}>
              {game.tags.map(tag => (
                <View key={tag} style={styles.tagBadge}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
            {!game.available && (
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>Coming Soon</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  librarySection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  gameCarousel: {
    paddingBottom: 10,
    paddingHorizontal: 20,
    gap: 15,
  },
  gameCard: {
    width: 120,
    height: 140,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#eee',
    marginRight: 15,
  },
  gameCardSelected: {
    borderColor: '#333',
    backgroundColor: '#fafafa',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  gameCardDisabled: {
    opacity: 0.6,
    backgroundColor: '#FAFAFA',
  },
  gameCardIcon: {
    fontSize: 30,
    marginBottom: 10,
  },
  gameCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  gameCardTitleSelected: {
    color: '#333',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  tagBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
  },
  comingSoonBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  comingSoonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default GameLibrary;

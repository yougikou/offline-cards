import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppState, GameMode } from '../../../App';

interface HomeActionsProps {
  selectedGameMode: GameMode;
  handleHost: (resume: boolean) => void;
  handleGuest: (resume: boolean) => void;
  setAppState: (state: AppState) => void;
  setPlayerId: (id: string) => void;
  sandboxPlayerCount: number;
  setSandboxPlayerCount: (count: React.SetStateAction<number>) => void;
  startBoardGameHost: (playerIds: string[]) => void;
}

const HomeActions: React.FC<HomeActionsProps> = ({
  selectedGameMode,
  handleHost,
  handleGuest,
  setAppState,
  setPlayerId,
  sandboxPlayerCount,
  setSandboxPlayerCount,
  startBoardGameHost,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <View style={styles.sectionDivider} />

      {/* Primary Action: Host Room */}
      <TouchableOpacity accessibilityRole="button" style={styles.joinGlobalButton} onPress={() => handleHost(false)}>
        <View style={styles.joinGlobalIconContainer}>
          <Text style={styles.joinGlobalIcon}>🌐</Text>
        </View>
        <View style={styles.joinGlobalTextContainer}>
          <Text style={styles.joinGlobalButtonText}>
            {t('lobby.createRoom', 'Host Room')} - {selectedGameMode === 'UnoLite' ? t('lobby.game_UnoLite') : selectedGameMode === 'ZhengShangYou' ? t('lobby.game_ZhengShangYou') : selectedGameMode === 'JiangsuTaopai' ? t('lobby.game_JiangsuTaopai') : t('lobby.game_SanGuoSha')}
          </Text>
          <Text style={styles.joinGlobalSubText}>{t('lobby.hostDesc', 'Play with friends via Wi-Fi/QR')}</Text>
        </View>
      </TouchableOpacity>

      {/* Secondary Action Modes (Join / Sandbox) */}
      <View style={{ marginTop: 15, gap: 10 }}>
        {/* Secondary Action: Join Room */}
        <TouchableOpacity accessibilityRole="button" style={styles.joinSecondaryButton} onPress={() => handleGuest(false)}>
          <View style={styles.joinSecondaryIconContainer}>
            <Text style={styles.joinSecondaryIcon}>📡</Text>
          </View>
          <View style={styles.joinGlobalTextContainer}>
            <Text style={styles.joinSecondaryButtonText}>{t('lobby.joinRoom', 'Join Room')}</Text>
            <Text style={styles.joinGlobalSubText}>{t('lobby.joinRoomSub', 'Scan QR or enter code')}</Text>
          </View>
        </TouchableOpacity>

        {/* Tertiary Action: Sandbox */}
        <View style={styles.sandboxUtilityRow}>
          <TouchableOpacity accessibilityRole="button" style={styles.sandboxUtilityButton} onPress={() => {
            setAppState('SANDBOX');
            setPlayerId('player_1');
            const players = Array.from({ length: sandboxPlayerCount }, (_, i) => `player_${i + 1}`);
            startBoardGameHost(players);
          }}>
            <Text style={styles.sandboxUtilityIcon}>🤖</Text>
            <Text style={styles.sandboxUtilityText}>{t('lobby.sandboxTesting', 'Practice Locally')}</Text>
          </TouchableOpacity>
          <View style={styles.compactPlayerCount}>
            <TouchableOpacity onPress={() => setSandboxPlayerCount(Math.max(1, sandboxPlayerCount - 1))} style={styles.compactCountBtn}><Text style={styles.compactCountBtnText}>-</Text></TouchableOpacity>
            <Text style={styles.compactCountText}>{sandboxPlayerCount}P</Text>
            <TouchableOpacity onPress={() => setSandboxPlayerCount(Math.min(8, sandboxPlayerCount + 1))} style={styles.compactCountBtn}><Text style={styles.compactCountBtnText}>+</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  sectionDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 15,
  },
  joinGlobalButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  joinGlobalIconContainer: {
    backgroundColor: '#E8F5E9',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  joinGlobalIcon: {
    fontSize: 20,
  },
  joinGlobalTextContainer: {
    flex: 1,
  },
  joinGlobalButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  joinGlobalSubText: {
    fontSize: 13,
    color: '#666',
  },
  joinSecondaryButton: {
    flexDirection: 'row',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  joinSecondaryIconContainer: {
    backgroundColor: '#F5F5F5',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  joinSecondaryIcon: {
    fontSize: 18,
  },
  joinSecondaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  sandboxUtilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 8,
    paddingHorizontal: 12,
  },
  sandboxUtilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sandboxUtilityIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  sandboxUtilityText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },
  compactPlayerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  compactCountBtn: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
  },
  compactCountBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 18,
  },
  compactCountText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginHorizontal: 8,
    color: '#333',
  },
});

export default HomeActions;

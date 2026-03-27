import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

interface UpdateBannerProps {
  updateAvailable: boolean;
  handleApplyUpdate: () => void;
}

const UpdateBanner: React.FC<UpdateBannerProps> = ({
  updateAvailable,
  handleApplyUpdate,
}) => {
  const { t } = useTranslation();

  if (!updateAvailable) return null;

  return (
    <View style={styles.updateBanner}>
      <Text style={styles.updateText}>{t('lobby.updateAvailable', 'New version available!')}</Text>
      <TouchableOpacity accessibilityRole="button" style={styles.updateButton} onPress={handleApplyUpdate}>
        <Text style={styles.updateButtonText}>{t('lobby.refreshToUpdate', 'Refresh')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    marginTop: 15,
    width: '100%',
    maxWidth: 600,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  updateText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 10,
  },
  updateButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'white',
  },
  updateButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default UpdateBanner;

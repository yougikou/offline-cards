import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

const HeroSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <View style={styles.heroSection}>
      <Text style={styles.title}>{t('lobby.title', 'Offline Cards')}</Text>
      <Text style={styles.subtitle}>{t('lobby.subtitle', 'Serverless peer-to-peer local multiplayer')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  heroSection: {
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
});

export default HeroSection;

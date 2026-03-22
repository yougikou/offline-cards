import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface SanGuoShaCardProps {
  card: any;
}

export const SanGuoShaCardContent: React.FC<SanGuoShaCardProps> = ({ card }) => {
  const { t } = useTranslation();
  const sgTextColor = card.suit === 'Hearts' || card.suit === 'Diamonds' ? '#D32F2F' : '#212121';
  const suitIcon = card.suit === 'Hearts' ? '♥' : card.suit === 'Diamonds' ? '♦' : card.suit === 'Clubs' ? '♣' : card.suit === 'Spades' ? '♠' : '';

  return (
    <View style={{ flex: 1, width: '100%' }}>
      <View style={{ position: 'absolute', top: 4, left: 4, alignItems: 'center' }}>
        <Text style={{ color: sgTextColor, fontSize: 14, fontWeight: 'bold', userSelect: 'none' as any }}>{card.rank}</Text>
        <Text style={{ color: sgTextColor, fontSize: 12, userSelect: 'none' as any }}>{suitIcon}</Text>
      </View>
      <View style={{ position: 'absolute', bottom: 4, right: 4, alignItems: 'center', transform: [{ rotate: '180deg' }] }}>
        <Text style={{ color: sgTextColor, fontSize: 14, fontWeight: 'bold', userSelect: 'none' as any }}>{card.rank}</Text>
        <Text style={{ color: sgTextColor, fontSize: 12, userSelect: 'none' as any }}>{suitIcon}</Text>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
         <Text style={{ color: sgTextColor, fontSize: 20, fontWeight: 'bold', userSelect: 'none' as any }}>
           {t('game.sgs_card_' + card.name, { defaultValue: card.name })}
         </Text>
         <Text style={{ color: '#757575', fontSize: 10, userSelect: 'none' as any, marginTop: 4 }}>
           {t('game.sgs_card_' + card.name, { defaultValue: card.name })}
         </Text>
      </View>
    </View>
  );
};

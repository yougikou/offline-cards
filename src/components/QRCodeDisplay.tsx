import React from 'react';
import QRCode from 'react-native-qrcode-svg';
import { View, StyleSheet, Text } from 'react-native';

interface QRCodeDisplayProps {
  value: string;
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ value }) => {
  return (
    <View style={styles.container}>
      {value ? (
        <View style={styles.qrWrapper}>
          <QRCode value={value} size={256} />
        </View>
      ) : (
        <Text>No data for QR Code</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  qrWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 400,
    maxHeight: 400,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default QRCodeDisplay;

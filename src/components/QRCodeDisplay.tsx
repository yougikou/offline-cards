import React from 'react';
import QRCode from 'react-qr-code';
import { View, StyleSheet, Text } from 'react-native';

interface QRCodeDisplayProps {
  value: string;
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ value }) => {
  return (
    <View style={styles.container}>
      {value ? (
        <QRCode value={value} size={250} />
      ) : (
        <Text>No data for QR Code</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
  }
});

export default QRCodeDisplay;

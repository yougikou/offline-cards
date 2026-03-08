import React from 'react';
import { View, StyleSheet, Text, Image } from 'react-native';

interface QRCodeDisplayProps {
  value: string;
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ value }) => {
  const encodedValue = encodeURIComponent(value);
  const qrCodeUri = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodedValue}`;

  return (
    <View style={styles.container}>
      {value ? (
        <View style={styles.qrWrapper}>
          <Image
            source={{ uri: qrCodeUri }}
            style={styles.qrImage}
            resizeMode="contain"
            accessibilityLabel="Share room QR code"
          />
          <Text style={styles.hintText}>If QR image does not load, copy and share this link:</Text>
          <Text selectable style={styles.valueText}>
            {value}
          </Text>
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
    gap: 12,
  },
  qrImage: {
    width: 256,
    height: 256,
  },
  hintText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 12,
  },
  valueText: {
    color: '#111',
    textAlign: 'center',
    fontSize: 13,
  },
});

export default QRCodeDisplay;

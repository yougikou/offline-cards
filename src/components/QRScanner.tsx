import React, { useState } from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function QRScanner({ onScan, onCancel }: { onScan: (data: string) => void, onCancel: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return <View style={styles.container}><Text style={{color: 'white'}}>Requesting permissions...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 10, color: 'white' }}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
        <Button onPress={onCancel} title="Cancel" color="red" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : (res) => {
          setScanned(true);
          onScan(res.data);
        }}
      />
      <View style={{position:'absolute', bottom: 50, left: 0, right: 0, alignItems:'center'}}>
          <Button title="Cancel Scan" onPress={onCancel} color="red" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 400,
    backgroundColor: '#000',
    justifyContent: 'center',
    borderRadius: 10,
    overflow: 'hidden'
  }
});

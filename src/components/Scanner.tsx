import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';

interface ScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}

// Web-only scanner component using html5-qrcode
const WebScanner: React.FC<ScannerProps> = ({ onScan, onError }) => {
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const initScanner = async () => {
        try {
          const { Html5Qrcode } = await import('html5-qrcode');
          const html5Qrcode = new Html5Qrcode("reader");
          scannerRef.current = html5Qrcode;

          await html5Qrcode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: (videoWidth: number, videoHeight: number) => {
                const minEdgePercentage = 0.7;
                const minEdgeSize = Math.min(videoWidth, videoHeight);
                return {
                  width: Math.floor(minEdgeSize * minEdgePercentage),
                  height: Math.floor(minEdgeSize * minEdgePercentage)
                };
              }
            },
            (decodedText: string) => {
              if (scannerRef.current?.isScanning) {
                scannerRef.current.stop().then(() => {
                  onScan(decodedText);
                }).catch((err: any) => {
                  console.error("Failed to stop scanner after scan", err);
                  onScan(decodedText);
                });
              }
            },
            () => {
              // Ignore frequent scan errors when no QR is found
            }
          );
        } catch (err) {
          console.error("Error starting scanner", err);
          if (err instanceof Error) {
            onError?.(err.message);
          } else {
            onError?.(String(err));
          }
        }
      };

      initScanner();

      return () => {
        if (scannerRef.current?.isScanning) {
          scannerRef.current.stop().catch((err: any) => console.error("Error stopping scanner on unmount", err));
        }
      };
    }
  }, [onScan, onError]);

  if (typeof window === 'undefined') {
    return <Text>Scanner requires web environment</Text>;
  }

  return (
    <View style={styles.container}>
      <div id="reader" style={{ flex: 1, width: '100%', maxWidth: '400px', maxHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}></div>
    </View>
  );
};

// Native scanner component using expo-camera
const NativeScanner: React.FC<ScannerProps> = ({ onScan, onError }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const requestPermission = async () => {
      try {
        const { Camera } = await import('expo-camera');
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      } catch (err) {
        console.error("Error requesting camera permission", err);
        onError?.("Failed to request camera permission");
        setHasPermission(false);
      }
    };
    requestPermission();
  }, []);

  const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    onScan(data);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text>Camera permission denied. Please grant camera access in settings.</Text>
      </View>
    );
  }

  // Dynamic import to avoid bundling issue on web
  const CameraViewComponent = require('expo-camera').CameraView;

  return (
    <View style={styles.container}>
      <CameraViewComponent
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />
    </View>
  );
};

const Scanner: React.FC<ScannerProps> = (props) => {
  if (Platform.OS === 'web') {
    return <WebScanner {...props} />;
  }
  return <NativeScanner {...props} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    width: '100%',
    overflow: 'hidden'
  }
});

export default Scanner;

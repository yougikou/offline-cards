import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { View, StyleSheet, Text } from 'react-native';

interface ScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onError }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    // Only run in web environment
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const initScanner = async () => {
        try {
          const html5Qrcode = new Html5Qrcode("reader");
          scannerRef.current = html5Qrcode;

          await html5Qrcode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 }
            },
            (decodedText, decodedResult) => {
              if (scannerRef.current?.isScanning) {
                scannerRef.current.stop().then(() => {
                  onScan(decodedText);
                }).catch((err) => {
                  console.error("Failed to stop scanner after scan", err);
                  onScan(decodedText);
                });
              }
            },
            (errorMessage) => {
              // Ignore frequent scan errors when no QR is found
              // onError?.(errorMessage);
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
          scannerRef.current.stop().catch(err => console.error("Error stopping scanner on unmount", err));
        }
      };
    }
  }, [onScan, onError]);

  if (typeof window === 'undefined') {
    return <Text>Scanner requires web environment</Text>;
  }

  return (
    <View style={styles.container}>
      <div id="reader" style={{ width: '100%', maxWidth: '400px' }}></div>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    width: '100%',
  }
});

export default Scanner;

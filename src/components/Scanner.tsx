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
              // Calculate a dynamic qrbox size based on viewport width to fit better
              qrbox: (videoWidth, videoHeight) => {
                const minEdgePercentage = 0.7; // 70% of the smallest edge
                const minEdgeSize = Math.min(videoWidth, videoHeight);
                return {
                  width: Math.floor(minEdgeSize * minEdgePercentage),
                  height: Math.floor(minEdgeSize * minEdgePercentage)
                };
              }
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
      <div id="reader" style={{ flex: 1, width: '100%', maxWidth: '400px', maxHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}></div>
    </View>
  );
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

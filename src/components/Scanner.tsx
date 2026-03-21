import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, Platform, TextInput, TouchableOpacity, Vibration } from 'react-native';

export const preloadCamera = async () => {
  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    stream.getTracks().forEach(track => track.stop());
  } catch (err) {
    console.log('Preload camera failed or denied', err);
  }
};

interface ScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}

// Web-only scanner component using native BarcodeDetector API with html5-qrcode fallback
const WebScanner: React.FC<ScannerProps> = ({ onScan, onError }) => {
  const scannerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasError, setHasError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // 1. Native BarcodeDetector API approach
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // Check if the native API is available
    if (!('BarcodeDetector' in window)) {
      console.log('BarcodeDetector API not supported, using fallback.');
      setUseFallback(true);
      return;
    }

    let isScanning = true;

    const startNativeScanner = async () => {
      try {
        // @ts-ignore - BarcodeDetector is not fully typed in standard lib yet
        const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          const detectFrame = async () => {
            if (!isScanning || !videoRef.current) return;

            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                // Haptic feedback as soon as ANY barcode shape is detected
                try { Vibration.vibrate(50); } catch (v) { }
                isScanning = false;
                onScan(barcodes[0].rawValue);
                return;
              }
            } catch (e) {
              // Ignore detection errors (e.g., if video isn't ready)
            }

            requestRef.current = requestAnimationFrame(detectFrame);
          };

          requestRef.current = requestAnimationFrame(detectFrame);
        }
      } catch (err) {
        console.error("Native scanner failed, using fallback", err);
        setUseFallback(true);
      }
    };

    startNativeScanner();

    return () => {
      isScanning = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [onScan, useFallback]);

  // 2. Fallback approach using html5-qrcode
  useEffect(() => {
    if (!useFallback || typeof window === 'undefined' || typeof document === 'undefined') return;

    const initFallbackScanner = async () => {
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
            // Ignore frequent scan errors
          }
        );
      } catch (err) {
        console.error("Fallback scanner also failed", err);
        setHasError(true);
        const msg = err instanceof Error ? err.message : String(err);
        onError?.(msg);
      }
    };

    initFallbackScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch((err: any) => console.error("Error stopping scanner on unmount", err));
      }
    };
  }, [useFallback, onScan, onError]);

  if (typeof window === 'undefined') {
    return <Text>Scanner requires web environment</Text>;
  }

  if (hasError) {
    return (
      <View style={styles.fallbackContainer}>
        <Text style={styles.errorIcon}>📷🚫</Text>
        <Text style={styles.errorTitle}>Camera Unavailable</Text>
        <Text style={styles.errorText}>Please enter the room code manually to join.</Text>

        <TextInput
          style={styles.manualInput}
          value={manualCode}
          onChangeText={setManualCode}
          placeholder="Enter room code"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.submitBtn, !manualCode.trim() && styles.submitBtnDisabled]}
          onPress={() => onScan(manualCode.trim())}
          disabled={!manualCode.trim()}
        >
          <Text style={styles.submitBtnText}>Join Room</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (useFallback) {
    return (
      <View style={styles.container}>
        <div id="reader" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden' }}></div>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <video
        ref={videoRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16 }}
        playsInline
        muted
      />
    </View>
  );
};

// Native scanner component using expo-camera
const NativeScanner: React.FC<ScannerProps> = ({ onScan, onError }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');

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
      <View style={styles.fallbackContainer}>
        <Text style={styles.errorIcon}>📷🚫</Text>
        <Text style={styles.errorTitle}>Camera Permission Denied</Text>
        <Text style={styles.errorText}>Please grant camera access or enter the code manually.</Text>

        <TextInput
          style={styles.manualInput}
          value={manualCode}
          onChangeText={setManualCode}
          placeholder="Enter room code"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.submitBtn, !manualCode.trim() && styles.submitBtnDisabled]}
          onPress={() => onScan(manualCode.trim())}
          disabled={!manualCode.trim()}
        >
          <Text style={styles.submitBtnText}>Join Room</Text>
        </TouchableOpacity>
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
    width: '100%',
    maxWidth: 320,
    aspectRatio: 1,
    height: Platform.OS === 'web' ? 'auto' : undefined,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#eee',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  fallbackContainer: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  manualInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fafafa',
    marginBottom: 16,
    color: '#333',
  },
  submitBtn: {
    backgroundColor: '#4CAF50',
    width: '100%',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#A5D6A7',
    opacity: 0.7,
  },
  submitBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default Scanner;

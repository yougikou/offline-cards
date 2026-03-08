import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, Button } from 'react-native';

interface ScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
  labels?: {
    startCamera: string;
    idleHint: string;
    requesting: string;
    activeHint: string;
    permissionDenied: string;
    unsupported: string;
    fallback: string;
  };
}

type ScannerState = 'idle' | 'requesting_permission' | 'camera_active' | 'permission_denied' | 'unsupported' | 'fallback';

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onError, labels }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<InstanceType<BarcodeDetectorConstructor> | null>(null);
  const scannedRef = useRef(false);
  const [state, setState] = useState<ScannerState>('idle');

  const stopScanner = () => {
    if (typeof window !== 'undefined' && rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    detectorRef.current = null;
    scannedRef.current = false;
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startCamera = async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      setState('unsupported');
      onError?.('Scanner requires browser environment.');
      return;
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setState('unsupported');
      onError?.('Browser does not support camera access (getUserMedia).');
      return;
    }

    if (!window.BarcodeDetector) {
      setState('fallback');
      onError?.('BarcodeDetector is not available in this browser.');
      return;
    }

    try {
      setState('requesting_permission');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error('Video element is not available.');
      }

      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute('playsinline', 'true');
      await videoRef.current.play();

      detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
      setState('camera_active');

      const scanLoop = async () => {
        if (!videoRef.current || !detectorRef.current || scannedRef.current) {
          return;
        }

        try {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          const firstQr = barcodes.find((item) => typeof item.rawValue === 'string' && item.rawValue.length > 0);
          if (firstQr?.rawValue) {
            scannedRef.current = true;
            onScan(firstQr.rawValue);
            stopScanner();
            return;
          }
        } catch (scanError) {
          const message = scanError instanceof Error ? scanError.message : String(scanError);
          onError?.(message);
        }

        rafRef.current = window.requestAnimationFrame(scanLoop);
      };

      rafRef.current = window.requestAnimationFrame(scanLoop);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes('denied') || message.toLowerCase().includes('notallowed')) {
        setState('permission_denied');
        onError?.('Camera permission denied. Please enable it in browser site settings and try again.');
      } else {
        setState('fallback');
        onError?.(message);
      }
      stopScanner();
    }
  };

  if (typeof window === 'undefined') {
    return <Text>Scanner requires web environment.</Text>;
  }

  const text = labels || {
    startCamera: 'Start Camera',
    idleHint: 'Tap the button to enable camera scanning.',
    requesting: 'Requesting camera permission...',
    activeHint: 'Align the QR code in the camera view.',
    permissionDenied: 'Camera permission denied. Re-enable it in browser settings.',
    unsupported: 'This browser does not support live camera scanning.',
    fallback: 'Live scanning is unavailable on this browser. Use paste/import instead.',
  };

  return (
    <View style={styles.container}>
      {(state === 'idle' || state === 'permission_denied') && (
        <Button title={text.startCamera} onPress={startCamera} />
      )}

      <Text style={styles.stateText}>
        {state === 'idle' && text.idleHint}
        {state === 'requesting_permission' && text.requesting}
        {state === 'camera_active' && text.activeHint}
        {state === 'permission_denied' && text.permissionDenied}
        {state === 'unsupported' && text.unsupported}
        {state === 'fallback' && text.fallback}
      </Text>

      <video
        ref={videoRef}
        playsInline
        muted
        style={styles.video as unknown as React.CSSProperties}
      />
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
    overflow: 'hidden',
    gap: 12,
  },
  stateText: {
    color: '#444',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 420,
  },
  video: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    aspectRatio: 1,
    objectFit: 'cover',
    backgroundColor: '#111',
  },
});

export default Scanner;

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text } from 'react-native';

interface ScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onError }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<InstanceType<BarcodeDetectorConstructor> | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const startScanner = async () => {
      try {
        if (!window.BarcodeDetector) {
          throw new Error('当前浏览器不支持 BarcodeDetector，请使用 Chrome 或 Edge。');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        streamRef.current = stream;
        if (!videoRef.current) {
          throw new Error('未找到视频预览容器。');
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });

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
        onError?.(message);
      }
    };

    startScanner();

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [onScan, onError]);

  if (typeof window === 'undefined') {
    return <Text>Scanner requires web environment</Text>;
  }

  return (
    <View style={styles.container}>
      <video
        ref={videoRef}
        playsInline
        muted
        style={styles.video as unknown as React.CSSProperties}
      />
      <Text style={styles.hint}>请将二维码放在镜头中央</Text>
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
  video: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    aspectRatio: 1,
    objectFit: 'cover',
    backgroundColor: '#111',
  },
  hint: {
    color: '#666',
    fontSize: 14,
  },
});

export default Scanner;

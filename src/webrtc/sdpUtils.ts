import LZString from 'lz-string';

// Extremely aggressive SDP minification for acoustic/QR transmission
// We strip all unnecessary headers, video/audio formats (since we only use data channel),
// and only keep essential ICE candidates and crypto/fingerprint details.
export function minifySDP(sdp: string): string {
  const lines = sdp.split('\r\n');
  const keptLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Always keep essential structural lines
    if (
      line.startsWith('v=') ||
      line.startsWith('o=') ||
      line.startsWith('s=') ||
      line.startsWith('t=') ||
      line.startsWith('m=application') || // Data channel only!
      line.startsWith('c=IN')
    ) {
      keptLines.push(line);
      continue;
    }

    // Keep data channel specific attributes
    if (
      line.startsWith('a=mid:') ||
      line.startsWith('a=sctpmap:') ||
      line.startsWith('a=sctp-port:') ||
      line.startsWith('a=max-message-size:') ||
      line.startsWith('a=setup:') ||
      line.startsWith('a=connection:') ||
      line.startsWith('a=ice-ufrag:') ||
      line.startsWith('a=ice-pwd:') ||
      line.startsWith('a=fingerprint:') ||
      line.startsWith('a=group:BUNDLE') // Important for muxing
    ) {
      keptLines.push(line);
      continue;
    }

    // ICE candidates: keep only udp candidates (host or srflx usually enough for LAN/P2P)
    if (line.startsWith('a=candidate:')) {
      // Very basic filtering: keep UDP candidates. Discard TCP to save space.
      if (line.toLowerCase().includes(' udp ')) {
        keptLines.push(line);
      }
      continue;
    }
  }

  // Combine and remove any empty lines
  return keptLines.join('\r\n') + '\r\n';
}

export function compressSDPPayload(type: 'offer' | 'answer', sdp: string): string {
  const minified = minifySDP(sdp);
  const payload = JSON.stringify({ type, sdp: minified });
  return LZString.compressToEncodedURIComponent(payload);
}

export function decompressSDPPayload(encoded: string): { type: 'offer' | 'answer', sdp: string } | null {
  try {
    const jsonStr = LZString.decompressFromEncodedURIComponent(encoded);
    if (!jsonStr) return null;
    const parsed = JSON.parse(jsonStr);
    if ((parsed.type === 'offer' || parsed.type === 'answer') && typeof parsed.sdp === 'string') {
      return parsed;
    }
    return null;
  } catch (e) {
    console.warn("Failed to decompress SDP payload", e);
    return null;
  }
}

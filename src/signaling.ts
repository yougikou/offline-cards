import { WebRTCManager } from './webrtc';

export type SignalType = 'offer' | 'answer';

export interface SignalPayloadV1 {
  version: 1;
  signalType: SignalType;
  roomId?: string;
  playerId?: string;
  payload: string;
}

export type DecodedSignalResult = {
  ok: true;
  payload: SignalPayloadV1;
  source: 'json' | 'url' | 'legacy';
  rawText: string;
} | {
  ok: false;
  message: string;
};

const SIGNAL_VERSION = 1;
const SIGNAL_HASH_KEY = 'signal';

const isSignalType = (value: unknown): value is SignalType => value === 'offer' || value === 'answer';

const asString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const createSignalPayload = (params: {
  signalType: SignalType;
  payload: string;
  roomId?: string;
  playerId?: string;
}): SignalPayloadV1 => ({
  version: SIGNAL_VERSION,
  signalType: params.signalType,
  roomId: asString(params.roomId),
  playerId: asString(params.playerId),
  payload: params.payload,
});

export const encodeSignalPayload = (payload: SignalPayloadV1): string => JSON.stringify(payload);

const parseSignalObject = (raw: unknown): SignalPayloadV1 | null => {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  if (candidate.version !== SIGNAL_VERSION) return null;
  if (!isSignalType(candidate.signalType)) return null;
  const compressed = asString(candidate.payload);
  if (!compressed) return null;
  if (!WebRTCManager.isCompressedDescription(compressed)) return null;

  return {
    version: SIGNAL_VERSION,
    signalType: candidate.signalType,
    roomId: asString(candidate.roomId),
    playerId: asString(candidate.playerId),
    payload: compressed,
  };
};

const decodeFromUrl = (value: string): SignalPayloadV1 | null => {
  try {
    const url = new URL(value);
    const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
    const params = new URLSearchParams(hash);
    const signalValue = params.get(SIGNAL_HASH_KEY);
    if (!signalValue) return null;
    const decoded = decodeURIComponent(signalValue);
    const parsed = JSON.parse(decoded);
    return parseSignalObject(parsed);
  } catch {
    return null;
  }
};

export const decodeSignalPayload = (input: string, fallbackSignalType?: SignalType): DecodedSignalResult => {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, message: 'Signal text is empty.' };
  }

  const fromUrl = decodeFromUrl(trimmed);
  if (fromUrl) {
    return { ok: true, payload: fromUrl, source: 'url', rawText: encodeSignalPayload(fromUrl) };
  }

  try {
    const parsed = JSON.parse(trimmed);
    const payload = parseSignalObject(parsed);
    if (payload) {
      return { ok: true, payload, source: 'json', rawText: encodeSignalPayload(payload) };
    }
  } catch {
    // Continue and try legacy format.
  }

  if (WebRTCManager.isCompressedDescription(trimmed)) {
    if (!fallbackSignalType) {
      return {
        ok: false,
        message: 'Legacy signal text detected. Please choose host or guest mode first before importing.',
      };
    }

    const legacyPayload = createSignalPayload({
      signalType: fallbackSignalType,
      payload: trimmed,
    });

    return {
      ok: true,
      payload: legacyPayload,
      source: 'legacy',
      rawText: encodeSignalPayload(legacyPayload),
    };
  }

  return {
    ok: false,
    message: 'Invalid signaling data. Use a valid offer/answer text, QR payload, or share link.',
  };
};

export const buildSignalShareLink = (payload: SignalPayloadV1): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  const base = `${window.location.origin}${window.location.pathname}`;
  const encoded = encodeURIComponent(encodeSignalPayload(payload));
  return `${base}#${SIGNAL_HASH_KEY}=${encoded}`;
};

export const parseSignalFromCurrentUrl = (): DecodedSignalResult | null => {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const signalValue = params.get(SIGNAL_HASH_KEY);
  if (!signalValue) return null;

  const decoded = decodeSignalPayload(`${window.location.origin}${window.location.pathname}#${hash}`);
  if (!decoded.ok) return decoded;

  return decoded;
};

export const clearSignalHashFromUrl = () => {
  if (typeof window === 'undefined') return;
  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState({}, document.title, cleanUrl);
};

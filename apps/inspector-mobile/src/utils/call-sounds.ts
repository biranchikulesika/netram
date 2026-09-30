import { Platform } from "react-native";
import { Audio } from "expo-av";

import * as FileSystem from "expo-file-system";

function encodeWav(sampleRate: number, numSamples: number, sampleFn: (t: number) => number): string {
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // 16-bit
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const val = Math.max(-32767, Math.min(32767, Math.floor(sampleFn(i / sampleRate) * 32767)));
    view.setInt16(44 + i * 2, val, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0);
  return typeof btoa !== "undefined" ? `data:audio/wav;base64,${btoa(binary)}` : "";
}

function getRingtoneUri(): string {
  return encodeWav(8000, 16000, (t) => {
    if (t >= 0.85) return 0;
    const tone = (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 480 * t)) / 2;
    const env = Math.min(1, Math.min(t / 0.02, (0.85 - t) / 0.02));
    return tone * 0.45 * env;
  });
}

function getPickupUri(): string {
  const tones = [
    { freq: 523, start: 0, end: 0.09 },
    { freq: 659, start: 0.09, end: 0.18 },
    { freq: 784, start: 0.18, end: 0.40 },
  ];
  return encodeWav(8000, 3360, (t) => {
    for (const { freq, start, end } of tones) {
      if (t >= start && t < end) {
        const lt = t - start;
        return Math.sin(2 * Math.PI * freq * lt) * Math.min(1, lt / 0.01) * Math.exp(-lt * 6) * 0.65;
      }
    }
    return 0;
  });
}

let nativeRingtoneSound: Audio.Sound | null = null;
let webRingtoneAudio: HTMLAudioElement | null = null;
let webPickupAudio: HTMLAudioElement | null = null;

async function getNativeFileUri(fileName: string, getUri: () => string): Promise<string> {
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) {
      const b64 = getUri().split(",")[1] ?? "";
      await FileSystem.writeAsStringAsync(fileUri, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
  } catch {}
  return fileUri;
}

/**
 * Starts playing the outgoing calling ringtone.
 */
export async function startCallingSound(): Promise<void> {
  stopAllCallSounds();

  if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.Audio !== "undefined") {
    try {
      const uri = getRingtoneUri();
      if (uri) {
        const audio = new window.Audio(uri);
        audio.loop = true;
        webRingtoneAudio = audio;
        audio.play().catch(() => {});
      }
    } catch (e) {
      console.warn("Failed to play web calling sound:", e);
    }
    return;
  }

  // Native (Android / iOS)
  try {
    const fileUri = await getNativeFileUri("netram_ringtone.wav", getRingtoneUri);
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
      shouldDuckAndroid: true,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: fileUri },
      { isLooping: true, shouldPlay: true, volume: 0.9 },
    );
    nativeRingtoneSound = sound;
  } catch (err) {
    console.warn("Failed to play native calling sound:", err);
  }
}

/**
 * Stops the outgoing calling ringtone.
 */
export function stopCallingSound(): void {
  if (webRingtoneAudio) {
    try {
      webRingtoneAudio.pause();
      webRingtoneAudio.currentTime = 0;
    } catch {
      // ignore
    }
    webRingtoneAudio = null;
  }

  if (nativeRingtoneSound) {
    const sound = nativeRingtoneSound;
    nativeRingtoneSound = null;
    sound.stopAsync().catch(() => {});
    sound.unloadAsync().catch(() => {});
  }
}

/**
 * Plays the crisp call pickup / connect chime.
 */
export async function playCallPickupSound(): Promise<void> {
  // Always stop the calling sound first!
  stopCallingSound();

  if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.Audio !== "undefined") {
    try {
      const uri = getPickupUri();
      if (uri) {
        const audio = new window.Audio(uri);
        webPickupAudio = audio;
        audio.onended = () => {
          webPickupAudio = null;
        };
        audio.play().catch(() => {});
      }
    } catch (e) {
      console.warn("Failed to play web pickup sound:", e);
    }
    return;
  }

  // Native (Android / iOS)
  try {
    const fileUri = await getNativeFileUri("netram_pickup.wav", getPickupUri);
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
      shouldDuckAndroid: true,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: fileUri },
      { shouldPlay: true, volume: 1.0 },
    );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
  } catch (err) {
    console.warn("Failed to play native pickup sound:", err);
  }
}

/**
 * Stops all call sounds immediately (called when call ends or cancels).
 */
export function stopAllCallSounds(): void {
  stopCallingSound();

  if (webPickupAudio) {
    try {
      webPickupAudio.pause();
      webPickupAudio.currentTime = 0;
    } catch {
      // ignore
    }
    webPickupAudio = null;
  }
}

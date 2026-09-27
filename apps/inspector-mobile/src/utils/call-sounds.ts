import { Platform } from "react-native";
import { Audio } from "expo-av";

/**
 * Generates an in-memory base64 WAV Data URI for an outgoing telephone ringtone.
 * Dual-tone (440Hz + 480Hz) with 0.85s tone + 1.15s silence in a 2.0s loop.
 */
function generateRingtoneWavUri(): string {
  const sampleRate = 8000;
  const toneDuration = 0.85;
  const totalDuration = 2.0;
  const numSamples = Math.floor(sampleRate * totalDuration);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sampleVal = 0;
    if (t < toneDuration) {
      const tone1 = Math.sin(2 * Math.PI * 440 * t);
      const tone2 = Math.sin(2 * Math.PI * 480 * t);
      const envelope = Math.min(1, Math.min(t / 0.02, (toneDuration - t) / 0.02));
      sampleVal = ((tone1 + tone2) / 2) * 0.45 * envelope;
    }
    const intSample = Math.max(-32767, Math.min(32767, Math.floor(sampleVal * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  if (typeof btoa !== "undefined") {
    return "data:audio/wav;base64," + btoa(binary);
  }
  return "";
}

/**
 * Generates an in-memory base64 WAV Data URI for a call pickup / connect chime.
 * Ascending pleasant 3-tone chime (523Hz C5 -> 659Hz E5 -> 784Hz G5).
 */
function generatePickupWavUri(): string {
  const sampleRate = 8000;
  const tones = [
    { freq: 523, start: 0, end: 0.09 },
    { freq: 659, start: 0.09, end: 0.18 },
    { freq: 784, start: 0.18, end: 0.40 },
  ];
  const totalDuration = 0.42;
  const numSamples = Math.floor(sampleRate * totalDuration);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sampleVal = 0;
    for (const tone of tones) {
      if (t >= tone.start && t < tone.end) {
        const localT = t - tone.start;
        const decay = Math.exp(-localT * 6);
        const attack = Math.min(1, localT / 0.01);
        sampleVal = Math.sin(2 * Math.PI * tone.freq * localT) * attack * decay * 0.65;
      }
    }
    const intSample = Math.max(-32767, Math.min(32767, Math.floor(sampleVal * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  if (typeof btoa !== "undefined") {
    return "data:audio/wav;base64," + btoa(binary);
  }
  return "";
}

// Cached Data URIs
let cachedRingtoneUri: string | null = null;
let cachedPickupUri: string | null = null;

function getRingtoneUri(): string {
  if (!cachedRingtoneUri) {
    cachedRingtoneUri = generateRingtoneWavUri();
  }
  return cachedRingtoneUri;
}

function getPickupUri(): string {
  if (!cachedPickupUri) {
    cachedPickupUri = generatePickupWavUri();
  }
  return cachedPickupUri;
}

// Active sound instances
let nativeRingtoneSound: Audio.Sound | null = null;
let webRingtoneAudio: HTMLAudioElement | null = null;
let webPickupAudio: HTMLAudioElement | null = null;

import * as FileSystem from "expo-file-system";

async function getNativeRingtoneFileUri(): Promise<string> {
  const fileUri = `${FileSystem.cacheDirectory}netram_ringtone.wav`;
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) {
      const dataUri = getRingtoneUri();
      const base64 = dataUri.split(",")[1] ?? "";
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    return fileUri;
  } catch {
    return fileUri;
  }
}

async function getNativePickupFileUri(): Promise<string> {
  const fileUri = `${FileSystem.cacheDirectory}netram_pickup.wav`;
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) {
      const dataUri = getPickupUri();
      const base64 = dataUri.split(",")[1] ?? "";
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    return fileUri;
  } catch {
    return fileUri;
  }
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
    const fileUri = await getNativeRingtoneFileUri();
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
    const fileUri = await getNativePickupFileUri();
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

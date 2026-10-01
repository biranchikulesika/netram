import { Platform, PermissionsAndroid, type Permission } from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "expo-camera";

export interface InspectionPermissionsResult {
  camera: boolean;
  audio: boolean;
  location: boolean;
}

/**
 * Requests required runtime permissions for inspection operations:
 * Camera, Microphone (Audio/Video notes), and GPS Location.
 */
export async function requestInspectionPermissions(): Promise<InspectionPermissionsResult> {
  let cameraGranted = false;
  let audioGranted = false;
  let locationGranted = false;

  if (Platform.OS === "android") {
    try {
      const camKey = PermissionsAndroid.PERMISSIONS.CAMERA;
      const audioKey = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
      const locFineKey = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
      const locCoarseKey = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

      const perms: Permission[] = [camKey, audioKey, locFineKey, locCoarseKey].filter(
        (p): p is Permission => Boolean(p),
      );

      if (perms.length > 0) {
        const statuses = await PermissionsAndroid.requestMultiple(perms);

        cameraGranted = camKey ? statuses[camKey] === PermissionsAndroid.RESULTS.GRANTED : false;
        audioGranted = audioKey ? statuses[audioKey] === PermissionsAndroid.RESULTS.GRANTED : false;
        locationGranted =
          (locFineKey ? statuses[locFineKey] === PermissionsAndroid.RESULTS.GRANTED : false) ||
          (locCoarseKey ? statuses[locCoarseKey] === PermissionsAndroid.RESULTS.GRANTED : false);

        return {
          camera: cameraGranted,
          audio: audioGranted,
          location: locationGranted,
        };
      }
    } catch {
      // Fallback to Expo module permission checks
    }
  }

  // Cross-platform Expo fallback
  try {
    const [camPerm, micPerm, locPerm] = await Promise.all([
      ImagePicker.requestCameraPermissionsAsync().catch(() => ({ granted: false })),
      Camera.requestMicrophonePermissionsAsync().catch(() => ({ granted: false })),
      Location.requestForegroundPermissionsAsync().catch(() => ({ granted: false })),
    ]);

    cameraGranted = camPerm.granted;
    audioGranted = micPerm.granted;
    locationGranted = locPerm.granted;
  } catch {
    // ignore errors
  }

  return {
    camera: cameraGranted,
    audio: audioGranted,
    location: locationGranted,
  };
}

/**
 * Checks if all inspection permissions are currently granted.
 */
export async function checkInspectionPermissions(): Promise<InspectionPermissionsResult> {
  if (Platform.OS === "android") {
    try {
      const camKey = PermissionsAndroid.PERMISSIONS.CAMERA;
      const audioKey = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
      const locFineKey = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;

      if (camKey && audioKey && locFineKey) {
        const [cam, audio, locFine] = await Promise.all([
          PermissionsAndroid.check(camKey),
          PermissionsAndroid.check(audioKey),
          PermissionsAndroid.check(locFineKey),
        ]);
        return { camera: cam, audio, location: locFine };
      }
    } catch {
      // Fallback
    }
  }

  try {
    const [camPerm, micPerm, locPerm] = await Promise.all([
      Camera.getCameraPermissionsAsync().catch(() => ({ granted: false })),
      Camera.getMicrophonePermissionsAsync().catch(() => ({ granted: false })),
      Location.getForegroundPermissionsAsync().catch(() => ({ granted: false })),
    ]);

    return {
      camera: camPerm.granted,
      audio: micPerm.granted,
      location: locPerm.granted,
    };
  } catch {
    return { camera: false, audio: false, location: false };
  }
}

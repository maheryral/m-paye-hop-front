// Métadonnées device + géolocalisation envoyées au backend pour identifier
// précisément l'appareil et le lieu de connexion.
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Location from 'expo-location';

export interface DeviceHeaders {
  'x-platform': string;
  'x-device-name': string;
  'x-device-model': string;
  'x-device-os': string;
  'x-device-os-version': string;
  'x-device-type': string;
}

function mapDeviceType(): string {
  // Device.DeviceType: UNKNOWN=0, PHONE=1, TABLET=2, DESKTOP=3, TV=4
  switch (Device.deviceType) {
    case Device.DeviceType.PHONE:
      return 'MOBILE';
    case Device.DeviceType.TABLET:
      return 'TABLET';
    case Device.DeviceType.DESKTOP:
      return 'DESKTOP';
    default:
      return Platform.OS === 'web' ? 'WEB' : 'MOBILE';
  }
}

let cachedHeaders: DeviceHeaders | null = null;

/** En-têtes device statiques (calculés une fois). */
export function getDeviceHeaders(): DeviceHeaders {
  if (cachedHeaders) return cachedHeaders;
  cachedHeaders = {
    'x-platform': Platform.OS,
    'x-device-name':
      Device.deviceName || `${Device.brand ?? ''} ${Device.modelName ?? ''}`.trim() || 'Appareil',
    'x-device-model': Device.modelName || '',
    'x-device-os': Device.osName || Platform.OS,
    'x-device-os-version': Device.osVersion || String(Platform.Version ?? ''),
    'x-device-type': mapDeviceType(),
  };
  return cachedHeaders;
}

// Cache de la dernière position connue (mise à jour au login)
let cachedGeo: { lat: number; lng: number } | null = null;

export function getCachedGeo() {
  return cachedGeo;
}

/**
 * Demande la permission de localisation et capture la position.
 * À appeler au moment du login (pas sur chaque requête).
 * Ne lève jamais : en cas de refus/erreur, retourne null silencieusement.
 */
export async function captureGeoForLogin(): Promise<{
  lat: number;
  lng: number;
} | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    cachedGeo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    return cachedGeo;
  } catch {
    return null;
  }
}

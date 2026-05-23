// src/components/VoyageMap.tsx
// Map taxi-brousse: marker départ (gare), marker arrivée, polyline directe.
// Si pas de coords arrivée → utilise un mini dictionnaire des villes malgaches.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

// Coordonnées des grandes villes de Madagascar (fallback si voyage n'a pas de lat/lng)
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  antananarivo: { lat: -18.9098, lng: 47.5219 },
  tana: { lat: -18.9098, lng: 47.5219 },
  toamasina: { lat: -18.1492, lng: 49.4023 },
  tamatave: { lat: -18.1492, lng: 49.4023 },
  fianarantsoa: { lat: -21.4536, lng: 47.0854 },
  mahajanga: { lat: -15.7167, lng: 46.3167 },
  majunga: { lat: -15.7167, lng: 46.3167 },
  antsiranana: { lat: -12.2787, lng: 49.2917 },
  'diego suarez': { lat: -12.2787, lng: 49.2917 },
  toliara: { lat: -23.3534, lng: 43.6677 },
  tulear: { lat: -23.3534, lng: 43.6677 },
  antsirabe: { lat: -19.8659, lng: 47.0333 },
  morondava: { lat: -20.2843, lng: 44.2820 },
  'ambositra': { lat: -20.5333, lng: 47.2500 },
  'manakara': { lat: -22.1500, lng: 48.0167 },
};

const lookupCity = (name?: string): { lat: number; lng: number } | null => {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return CITY_COORDS[key] || null;
};

// Calcule la distance Haversine (km) entre 2 points
const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

interface Props {
  // Coords départ : voyage.latitudeDepart > gare.latitude
  departLat?: number;
  departLng?: number;
  departLabel?: string;
  // Coords arrivée : voyage.latitudeArrivee > lookup ville
  arriveeLat?: number;
  arriveeLng?: number;
  arriveeLabel?: string;
  // Fallback noms de villes pour lookup si pas de coords
  villeDepart?: string;
  villeArrivee?: string;
  // Distance manuelle si stockée
  distanceKm?: number;
  height?: number;
  showOpenMap?: boolean;
}

export default function VoyageMap({
  departLat,
  departLng,
  departLabel = 'Départ',
  arriveeLat,
  arriveeLng,
  arriveeLabel = 'Arrivée',
  villeDepart,
  villeArrivee,
  distanceKm,
  height = 220,
  showOpenMap = true,
}: Props) {
  // Résolution des coords (avec fallback dictionnaire)
  const depart = useMemo(() => {
    if (departLat != null && departLng != null) {
      return { lat: departLat, lng: departLng };
    }
    return lookupCity(villeDepart);
  }, [departLat, departLng, villeDepart]);

  const arrivee = useMemo(() => {
    if (arriveeLat != null && arriveeLng != null) {
      return { lat: arriveeLat, lng: arriveeLng };
    }
    return lookupCity(villeArrivee);
  }, [arriveeLat, arriveeLng, villeArrivee]);

  const distance = useMemo(() => {
    if (distanceKm) return distanceKm;
    if (depart && arrivee) return Math.round(haversineKm(depart, arrivee));
    return null;
  }, [depart, arrivee, distanceKm]);

  if (!depart || !arrivee) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Ionicons name="map-outline" size={36} color="#94a3b8" />
        <Text style={styles.placeholderText}>
          Carte indisponible (coordonnées manquantes)
        </Text>
      </View>
    );
  }

  // Centre la map entre les 2 points
  const midLat = (depart.lat + arrivee.lat) / 2;
  const midLng = (depart.lng + arrivee.lng) / 2;
  const latDelta = Math.abs(depart.lat - arrivee.lat) * 1.6 + 0.5;
  const lngDelta = Math.abs(depart.lng - arrivee.lng) * 1.6 + 0.5;

  const openExternalMap = () => {
    const dLat = depart.lat;
    const dLng = depart.lng;
    const aLat = arrivee.lat;
    const aLng = arrivee.lng;
    const url = Platform.select({
      ios: `http://maps.apple.com/?saddr=${dLat},${dLng}&daddr=${aLat},${aLng}`,
      android: `https://www.google.com/maps/dir/?api=1&origin=${dLat},${dLng}&destination=${aLat},${aLng}`,
    });
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: midLat,
          longitude: midLng,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        }}
        pointerEvents="auto"
      >
        <Marker
          coordinate={{ latitude: depart.lat, longitude: depart.lng }}
          title={departLabel}
          description={villeDepart}
          pinColor="#1e40af"
        />
        <Marker
          coordinate={{ latitude: arrivee.lat, longitude: arrivee.lng }}
          title={arriveeLabel}
          description={villeArrivee}
          pinColor="#ef4444"
        />
        <Polyline
          coordinates={[
            { latitude: depart.lat, longitude: depart.lng },
            { latitude: arrivee.lat, longitude: arrivee.lng },
          ]}
          strokeColor="#1e40af"
          strokeWidth={3}
        />
      </MapView>

      {/* Badge distance */}
      {distance != null && (
        <View style={styles.distancePill}>
          <Ionicons name="trail-sign-outline" size={14} color="#fff" />
          <Text style={styles.distanceText}>{distance} km</Text>
        </View>
      )}

      {/* Ouvrir dans Google/Apple Maps */}
      {showOpenMap && (
        <TouchableOpacity style={styles.openMapBtn} onPress={openExternalMap} activeOpacity={0.85}>
          <Ionicons name="navigate" size={14} color="#1e40af" />
          <Text style={styles.openMapText}>Itinéraire</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  placeholder: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: { color: '#64748b', fontSize: 12 },

  distancePill: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e40af',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  distanceText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  openMapBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  openMapText: { color: '#1e40af', fontSize: 12, fontWeight: '700' },
});

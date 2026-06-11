// src/components/BiometricLock.tsx
// Écran de verrouillage biométrique au lancement de l'app.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useBiometric } from '../hooks/useBiometric';

const BLUE_GRADIENT: [string, string] = ['#2563eb', '#1e40af'];

interface Props {
  onUnlock: () => void;
  onLogout?: () => void;
}

export default function BiometricLock({ onUnlock, onLogout }: Props) {
  const { authenticate, label, support } = useBiometric();
  const [busy, setBusy] = useState(false);
  const [failedOnce, setFailedOnce] = useState(false);

  const tryAuth = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await authenticate(`Déverrouiller M'Paye avec ${label}`);
    setBusy(false);
    if (ok) {
      onUnlock();
    } else {
      setFailedOnce(true);
    }
  };

  // Lancement automatique au montage (une fois que le support est connu)
  useEffect(() => {
    if (support.available && !failedOnce && !busy) {
      tryAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [support.available]);

  return (
    <LinearGradient
      colors={BLUE_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.iconCircle}>
        <Ionicons
          name={label === 'Face ID' ? 'scan-outline' : 'finger-print'}
          size={80}
          color="#fff"
        />
      </View>

      <Text style={styles.title}>M'Paye verrouillé</Text>
      <Text style={styles.subtitle}>
        Utilisez {label} pour déverrouiller
      </Text>

      <TouchableOpacity
        style={styles.unlockBtn}
        onPress={tryAuth}
        disabled={busy}
        activeOpacity={0.85}
      >
        {busy ? (
          <ActivityIndicator color="#1e40af" />
        ) : (
          <>
            <Ionicons name="lock-open-outline" size={20} color="#1e40af" />
            <Text style={styles.unlockText}>Déverrouiller</Text>
          </>
        )}
      </TouchableOpacity>

      {onLogout && (
        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    marginBottom: 40,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    minWidth: 200,
    justifyContent: 'center',
  },
  unlockText: {
    color: '#1e40af',
    fontSize: 15,
    fontWeight: '700',
  },
  logoutBtn: {
    marginTop: 24,
    padding: 12,
  },
  logoutText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});

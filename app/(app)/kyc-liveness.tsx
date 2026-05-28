// app/(app)/kyc-liveness.tsx — Vérification de visage (liveness guidé)
// Capture front (selfie neutre) + 4 mouvements (droite/gauche/haut/bas), ordre aléatoire.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useTheme } from '../../src/contexts/ThemeContext';
import { kycService } from '../../src/services/api';

type Dir = 'front' | 'right' | 'left' | 'up' | 'down';

const STEP_META: Record<
  Dir,
  { label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  front: { label: 'Regardez droit devant', hint: 'Visage centré, bien éclairé', icon: 'happy-outline' },
  right: { label: 'Tournez la tête à droite', hint: 'Doucement vers la droite', icon: 'arrow-forward' },
  left: { label: 'Tournez la tête à gauche', hint: 'Doucement vers la gauche', icon: 'arrow-back' },
  up: { label: 'Levez la tête', hint: 'Regardez vers le haut', icon: 'arrow-up' },
  down: { label: 'Baissez la tête', hint: 'Regardez vers le bas', icon: 'arrow-down' },
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const COUNTDOWN = 3;

export default function KycLiveness() {
  const router = useRouter();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [sequence] = useState<Dir[]>(() => [
    'front',
    ...shuffle<Dir>(['right', 'left', 'up', 'down']),
  ]);
  const [stepIndex, setStepIndex] = useState(0);
  const [count, setCount] = useState(COUNTDOWN);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const framesRef = useRef<{ direction: Dir; image: string }[]>([]);

  const current = sequence[stepIndex];

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      await kycService.submitLiveness({
        level: 'INTERMEDIATE',
        sequence,
        frames: framesRef.current,
      });
      setDone(true);
    } catch (e: any) {
      Alert.alert(
        'Échec',
        e?.response?.data?.message || 'Envoi de la vérification impossible',
      );
      router.back();
    } finally {
      setSubmitting(false);
    }
  }, [router, sequence]);

  const capture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        skipProcessing: true,
      });
      if (photo?.uri) {
        // Redimensionne (largeur max 720px) + compresse pour alléger le payload
        const ctx = ImageManipulator.manipulate(photo.uri);
        ctx.resize({ width: 720 });
        const rendered = await ctx.renderAsync();
        const out = await rendered.saveAsync({
          compress: 0.5,
          format: SaveFormat.JPEG,
          base64: true,
        });
        if (out?.base64) {
          framesRef.current.push({
            direction: current,
            image: `data:image/jpeg;base64,${out.base64}`,
          });
        }
      }
      if (stepIndex + 1 < sequence.length) {
        setStepIndex((i) => i + 1);
        setCount(COUNTDOWN);
      } else {
        await submit();
      }
    } catch {
      Alert.alert('Erreur', 'Capture impossible, réessayez');
    } finally {
      setCapturing(false);
    }
  }, [capturing, current, stepIndex, sequence.length, submit]);

  // Décompte par étape puis capture auto
  useEffect(() => {
    if (done || submitting || !permission?.granted) return;
    if (count <= 0) {
      capture();
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, done, submitting, permission?.granted, capture]);

  // --- Permission ---
  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.permTitle, { color: colors.text }]}>
            Accès caméra requis
          </Text>
          <Text style={[styles.permText, { color: colors.textSecondary }]}>
            Nous utilisons la caméra avant pour vérifier votre visage.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>Autoriser la caméra</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
            <Text style={{ color: colors.textSecondary }}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- Succès ---
  if (done) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={72} color="#10b981" />
          <Text style={[styles.permTitle, { color: colors.text }]}>
            Vérification envoyée ✅
          </Text>
          <Text style={[styles.permText, { color: colors.textSecondary }]}>
            Votre visage a été capturé. Un agent va vérifier votre dossier sous peu.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace('/profile' as any)}
          >
            <Text style={styles.primaryBtnText}>Terminé</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const meta = STEP_META[current];

  return (
    <View style={styles.fill}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

      {/* Overlay sombre + cadre ovale */}
      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.progress}>
            Étape {stepIndex + 1}/{sequence.length}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.faceFrameWrap}>
          <View style={styles.faceFrame} />
        </View>

        <View style={styles.bottomCard}>
          <View style={styles.instrIcon}>
            <Ionicons name={meta.icon} size={30} color="#fff" />
          </View>
          <Text style={styles.instrLabel}>{meta.label}</Text>
          <Text style={styles.instrHint}>{meta.hint}</Text>

          {submitting ? (
            <View style={styles.countRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.submitText}>Envoi en cours…</Text>
            </View>
          ) : capturing ? (
            <Text style={styles.countText}>📸</Text>
          ) : (
            <Text style={styles.countText}>{count > 0 ? count : '…'}</Text>
          )}

          {/* Progress dots */}
          <View style={styles.dots}>
            {sequence.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < stepIndex && styles.dotDone,
                  i === stepIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  overlay: { flex: 1, justifyContent: 'space-between' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
  },
  progress: { color: '#fff', fontWeight: '700', fontSize: 14 },

  faceFrameWrap: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  faceFrame: {
    width: 240,
    height: 300,
    borderRadius: 150,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
  },

  bottomCard: {
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  instrIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  instrLabel: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  instrHint: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
  countText: { color: '#fff', fontSize: 40, fontWeight: '900', marginTop: 4 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  dots: { flexDirection: 'row', gap: 8, marginTop: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: '#3b82f6', width: 22 },
  dotDone: { backgroundColor: '#10b981' },

  permTitle: { fontSize: 18, fontWeight: '800', marginTop: 8, textAlign: 'center' },
  permText: { fontSize: 13, textAlign: 'center', paddingHorizontal: 16 },
  primaryBtn: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

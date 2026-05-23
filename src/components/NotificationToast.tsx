// src/components/NotificationToast.tsx
// Toast animé qui apparaît en haut de l'écran à chaque notification temps réel.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSocket, RealtimeNotification } from '../contexts/SocketContext';

const TOAST_DURATION = 4500;

export default function NotificationToast() {
  const router = useRouter();
  const { onNotification } = useSocket();
  const [current, setCurrent] = useState<RealtimeNotification | null>(null);
  const translateY = useRef(new Animated.Value(-150)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = onNotification((n) => {
      // Annule un toast précédent encore visible
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setCurrent(n);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 80,
      }).start();
      hideTimer.current = setTimeout(hide, TOAST_DURATION);
    });
    return () => {
      unsubscribe();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hide = () => {
    Animated.timing(translateY, {
      toValue: -150,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setCurrent(null));
  };

  const onPress = () => {
    hide();
    router.push('/(app)/notifications' as any);
  };

  if (!current) return null;

  const bg = current.color || '#1e40af';

  return (
    <Animated.View
      style={[styles.wrapper, { transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      <Pressable onPress={onPress} style={styles.touch}>
        <View style={[styles.card, { borderLeftColor: bg }]}>
          <View style={[styles.iconBubble, { backgroundColor: bg + '20' }]}>
            <Ionicons
              name={(current.icon as any) || 'notifications'}
              size={22}
              color={bg}
            />
          </View>
          <View style={styles.content}>
            <Text style={styles.title} numberOfLines={1}>
              {current.title}
            </Text>
            <Text style={styles.message} numberOfLines={2}>
              {current.message}
            </Text>
          </View>
          <TouchableOpacity onPress={hide} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 9999,
  },
  touch: { width: '100%' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  message: { fontSize: 12, color: '#475569', marginTop: 2 },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

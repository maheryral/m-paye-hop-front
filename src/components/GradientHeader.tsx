// src/components/GradientHeader.tsx
// Header avec dégradé bleu sombre, réutilisable sur toutes les pages.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export const BLUE_GRADIENT: [string, string] = ['#0f172a', '#1e40af'];
export const BLUE_GRADIENT_LIGHT: [string, string] = ['#1e3a8a', '#3b82f6'];

interface GradientHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  rightLabel?: string;
}

export default function GradientHeader({
  title,
  subtitle,
  onBack,
  showBack = true,
  rightIcon,
  onRightPress,
  rightLabel,
}: GradientHeaderProps) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());

  return (
    <LinearGradient
      colors={BLUE_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.wrapper}
    >
      <SafeAreaView edges={['top']}>
        <View style={styles.row}>
          {showBack ? (
            <TouchableOpacity onPress={handleBack} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtn} />
          )}

          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>

          {rightIcon && onRightPress ? (
            <TouchableOpacity onPress={onRightPress} style={styles.iconBtn}>
              <Ionicons name={rightIcon} size={20} color="#fff" />
              {rightLabel && (
                <Text style={styles.rightLabel}>{rightLabel}</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtn} />
          )}
        </View>

        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  iconBtn: {
    minWidth: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 13,
    paddingHorizontal: 20,
    marginTop: 2,
  },
  rightLabel: {
    color: '#fff',
    fontSize: 10,
    marginTop: 2,
  },
});

// src/components/MerchantBack.tsx
// Petite barre de retour in-page (flèche + titre) pour les écrans marchand
// dont l'en-tête natif a été masqué. Gère aussi la safe-area du haut.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';

export default function MerchantBack({ title }: { title?: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        { paddingTop: insets.top + 6, backgroundColor: colors.background, borderBottomColor: colors.border },
      ]}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.btn, { backgroundColor: colors.card, borderColor: colors.border }]}
        hitSlop={8}
        accessibilityLabel="Retour"
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </TouchableOpacity>
      {title ? (
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  btn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', flex: 1, minWidth: 0 },
});

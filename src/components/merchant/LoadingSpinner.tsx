// src/components/merchant/LoadingSpinner.tsx
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export const SkeletonLoader = ({ type, count }: { type: 'card' | 'list' | 'chart'; count?: number }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.skeletonContainer, { backgroundColor: colors.background }]}>
      {Array(count || 3).fill(0).map((_, i) => (
        <View key={i} style={[styles.skeletonCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '60%' }]} />
          <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '40%' }]} />
        </View>
      ))}
    </View>
  );
};

export const LoadingSpinner = ({ text }: { text?: string }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
      {text && <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{text}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  skeletonContainer: { padding: 16, gap: 12 },
  skeletonCard: { padding: 16, borderRadius: 12, borderWidth: 1, gap: 12 },
  skeletonLine: { height: 14, borderRadius: 7 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
});
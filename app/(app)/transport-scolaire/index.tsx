// app/(app)/transport-scolaire/index.tsx
// Hub transport scolaire : entrée principale, 3 actions principales.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';

interface HubItem {
  label: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  route: string;
}

const ITEMS: HubItem[] = [
  {
    label: 'Mes enfants',
    description: 'Gérer les enfants à abonner',
    icon: 'people-outline',
    color: '#3b82f6',
    route: '/transport-scolaire/students',
  },
  {
    label: 'Trouver une école',
    description: 'Voir les routes desservies',
    icon: 'school-outline',
    color: '#10b981',
    route: '/transport-scolaire/schools',
  },
  {
    label: 'Mes abonnements',
    description: 'Voir / payer / annuler',
    icon: 'card-outline',
    color: '#8b5cf6',
    route: '/transport-scolaire/my-subscriptions',
  },
];

export default function TransportScolaireHub() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Transport scolaire
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="bus" size={36} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Bus scolaire</Text>
          <Text style={styles.heroSubtitle}>
            Abonnez vos enfants au ramassage scolaire. Payez en quelques clics depuis votre wallet.
          </Text>
        </View>

        {/* Hub cards */}
        <View style={styles.cardsWrap}>
          {ITEMS.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(item.route as any)}
            >
              <View style={[styles.cardIconBox, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardLabel, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                  {item.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Comment ça marche */}
        <View style={[styles.howTo, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.howToTitle, { color: colors.text }]}>Comment ça marche ?</Text>
          {[
            'Ajoutez vos enfants dans Mes enfants',
            'Trouvez l\'école de vos enfants dans Trouver une école',
            'Choisissez une route et une formule (mensuel, trimestriel, par trajet)',
            'Payez avec votre wallet M\'Paye',
          ].map((step, idx) => (
            <View key={idx} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.stepNumText, { color: colors.primary }]}>{idx + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>{step}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { paddingHorizontal: 16, paddingBottom: 32 },
  hero: {
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginBottom: 24,
  },
  heroIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#ffffff20',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 6 },
  heroSubtitle: { color: '#ffffffcc', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  cardsWrap: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardIconBox: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  cardText: { flex: 1 },
  cardLabel: { fontSize: 16, fontWeight: '600' },
  cardDesc: { fontSize: 12, marginTop: 2 },

  howTo: {
    marginTop: 24,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  howToTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { fontSize: 13, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 18 },
});

// app/(app)/transport-scolaire/schools.tsx
// Liste des écoles desservies + filtre par ville.

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import {
  transportScolaireApi,
  type SchoolPublic,
} from '../../../src/services/transportScolaireApi';

export default function SchoolsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [items, setItems] = useState<SchoolPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await transportScolaireApi.listSchools();
        setItems(res.data ?? []);
      } catch (e: any) {
        Alert.alert('Erreur', e?.response?.data?.message ?? 'Chargement échoué');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (s) =>
        s.nom.toLowerCase().includes(q) ||
        s.ville.toLowerCase().includes(q),
    );
  }, [items, query]);

  // Groupe par ville
  const byCity = useMemo(() => {
    const map = new Map<string, SchoolPublic[]>();
    for (const s of filtered) {
      const arr = map.get(s.ville) ?? [];
      arr.push(s);
      map.set(s.ville, arr);
    }
    return Array.from(map.entries()).map(([ville, list]) => ({ ville, list }));
  }, [filtered]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Écoles</Text>
        <View style={styles.iconBtn} />
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher école ou ville…"
          placeholderTextColor={colors.textTertiary}
          style={[styles.searchInput, { color: colors.text }]}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="school-outline" size={56} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucune école</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            {query ? 'Essayez un autre terme.' : 'Aucune école n\'est encore desservie.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={byCity}
          keyExtractor={(g) => g.ville}
          contentContainerStyle={styles.list}
          renderItem={({ item: group }) => (
            <View style={{ marginBottom: 24 }}>
              <Text style={[styles.cityHeader, { color: colors.textSecondary }]}>
                {group.ville.toUpperCase()}
              </Text>
              {group.list.map((school) => (
                <TouchableOpacity
                  key={school.id}
                  onPress={() =>
                    router.push(
                      `/transport-scolaire/school/${school.id}` as any,
                    )
                  }
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  {school.logoUrl ? (
                    <Image source={{ uri: school.logoUrl }} style={styles.logo} />
                  ) : (
                    <View style={[styles.logo, { backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="school" size={22} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                      {school.nom}
                    </Text>
                    {school.adresse && (
                      <Text style={[styles.cardMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                        {school.adresse}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyDesc: { fontSize: 13, textAlign: 'center', marginTop: 6 },
  list: { padding: 16 },
  cityHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 14, borderWidth: 1,
    marginBottom: 8,
  },
  logo: { width: 44, height: 44, borderRadius: 12 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600' },
  cardMeta: { fontSize: 12, marginTop: 2 },
});

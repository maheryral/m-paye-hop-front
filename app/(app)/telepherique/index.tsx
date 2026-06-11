// app/(app)/telepherique/index.tsx — Liste des lignes de téléphérique
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { telepheriqueApi, TLPLigne } from '../../../src/services/telepheriqueApi';

const BLUE_GRADIENT: [string, string] = ['#2563eb', '#1e40af'];

export default function TelepheriqueHome() {
  const router = useRouter();
  const { colors } = useTheme();

  const [lignes, setLignes] = useState<TLPLigne[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await telepheriqueApi.getLignes();
      setLignes(res.data);
    } catch (e: any) {
      setError(
        e?.response?.data?.message || 'Impossible de charger les lignes',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const renderItem = ({ item }: { item: TLPLigne }) => {
    const isActif = item.statut === 'actif';
    const stationsCount = item.stations?.length ?? 0;
    const minPrice = item.tarifs && item.tarifs.length > 0
      ? Math.min(...item.tarifs.map((t) => Number(t.prix)))
      : null;

    return (
      <TouchableOpacity
        onPress={() =>
          router.push(`/telepherique/ligne/${item.id}` as any)
        }
        activeOpacity={0.9}
        style={{ marginBottom: 12 }}
      >
        <LinearGradient
          colors={BLUE_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
        <View style={styles.cardTopRow}>
          <View style={[styles.colorDot, { backgroundColor: '#60a5fa' }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.ligneCode, { color: '#93c5fd' }]}>
              {item.code}
            </Text>
            <Text style={[styles.ligneName, { color: '#fff' }]}>
              {item.nom}
            </Text>
          </View>
          <View
            style={[
              styles.statutBadge,
              { backgroundColor: isActif ? '#3b82f630' : '#f59e0b30' },
            ]}
          >
            <Text
              style={[
                styles.statutText,
                { color: isActif ? '#6ee7b7' : '#fcd34d' },
              ]}
            >
              {item.statut.toUpperCase()}
            </Text>
          </View>
        </View>

        {item.description && (
          <Text
            style={[styles.desc, { color: '#cbd5e1' }]}
            numberOfLines={2}
          >
            {item.description}
          </Text>
        )}

        <View style={[styles.metaRow, { borderTopColor: 'rgba(255,255,255,0.15)' }]}>
          {item.longueurKm != null && (
            <View style={styles.metaItem}>
              <Ionicons name="trail-sign-outline" size={14} color="#cbd5e1" />
              <Text style={[styles.metaText, { color: '#cbd5e1' }]}>
                {item.longueurKm} km
              </Text>
            </View>
          )}
          {item.dureeMinutes != null && (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color="#cbd5e1" />
              <Text style={[styles.metaText, { color: '#cbd5e1' }]}>
                {item.dureeMinutes} min
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Ionicons name="business-outline" size={14} color="#cbd5e1" />
            <Text style={[styles.metaText, { color: '#cbd5e1' }]}>
              {stationsCount} station{stationsCount > 1 ? 's' : ''}
            </Text>
          </View>
          {minPrice != null && (
            <Text style={[styles.price, { color: '#fff' }]}>
              dès {new Intl.NumberFormat('fr-FR').format(minPrice)} Ar
            </Text>
          )}
        </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <LinearGradient
        colors={BLUE_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.iconBtn}
            >
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: '#fff' }]}>
              Téléphérique
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/telepherique/my-tickets' as any)}
              style={styles.iconBtn}
            >
              <Ionicons name="receipt-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.heroSubtitle}>
            Voyagez rapidement au-dessus de la ville
          </Text>
        </SafeAreaView>
      </LinearGradient>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="warning-outline" size={18} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      ) : (
        <FlatList
          data={lignes}
          keyExtractor={(l) => l.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1e40af"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="git-network-outline"
                size={56}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Aucune ligne disponible
              </Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                Réessayez plus tard
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  headerGradient: {
    paddingHorizontal: 0,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroSubtitle: {
    color: '#cbd5e1',
    fontSize: 13,
    paddingHorizontal: 20,
    marginTop: 4,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ef444415',
    borderWidth: 1,
    borderColor: '#ef4444',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  errorText: { color: '#ef4444', flex: 1, fontSize: 12 },

  card: {
    padding: 16,
    borderRadius: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  colorDot: { width: 12, height: 36, borderRadius: 6 },
  ligneCode: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  ligneName: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  statutBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statutText: { fontSize: 10, fontWeight: '700' },

  desc: { fontSize: 12, marginBottom: 10 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12 },
  price: { fontSize: 14, fontWeight: '800', marginLeft: 'auto' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyHint: { fontSize: 13 },
});

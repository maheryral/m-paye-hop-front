// app/(app)/transport-scolaire/school/[id].tsx
// Affiche les routes (lignes de bus) desservant une école donnée.

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import {
  transportScolaireApi,
  type TransportRoutePublic,
} from '../../../../src/services/transportScolaireApi';

const DAYS_LABEL: Record<string, string> = {
  MON: 'Lun', TUE: 'Mar', WED: 'Mer', THU: 'Jeu', FRI: 'Ven', SAT: 'Sam', SUN: 'Dim',
};

export default function SchoolDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id: schoolIdParam } = useLocalSearchParams<{ id: string }>();
  const schoolId = Array.isArray(schoolIdParam) ? schoolIdParam[0] : schoolIdParam;

  const [routes, setRoutes] = useState<TransportRoutePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      try {
        const res = await transportScolaireApi.listRoutesOfSchool(schoolId);
        setRoutes(res.data ?? []);
        // Récupère le nom de l'école depuis la première route (qui l'embarque)
        // ou on pourrait faire un appel séparé getSchool
        const schoolsRes = await transportScolaireApi.listSchools();
        const s = (schoolsRes.data ?? []).find((x) => x.id === schoolId);
        if (s) setSchoolName(s.nom);
      } catch (e: any) {
        Alert.alert('Erreur', e?.response?.data?.message ?? 'Chargement échoué');
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolId]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {schoolName ?? 'École'}
        </Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : routes.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bus-outline" size={56} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucune route</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Cette école n'a pas encore de bus scolaire configuré.
          </Text>
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={[styles.subhead, { color: colors.textSecondary }]}>
              {routes.length} ligne{routes.length > 1 ? 's' : ''} disponible{routes.length > 1 ? 's' : ''}
            </Text>
          }
          renderItem={({ item }) => (
            <RouteCard
              route={item}
              onPress={() =>
                router.push(`/transport-scolaire/route/${item.id}` as any)
              }
              colors={colors}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function RouteCard({
  route,
  onPress,
  colors,
}: {
  route: TransportRoutePublic;
  onPress: () => void;
  colors: any;
}) {
  const subscribed = route._count?.subscriptions ?? 0;
  const capacityLeft = Math.max(0, route.capaciteMax - subscribed);
  const minPrix =
    route.pricingPlans.length > 0
      ? Math.min(...route.pricingPlans.map((p) => Number(p.prix)))
      : null;

  const jours = (route.joursDesservis ?? [])
    .map((d) => DAYS_LABEL[d] ?? d)
    .join(' · ');

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.routeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.routeHeader}>
        <View style={[styles.routeIcon, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="bus" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.routeName, { color: colors.text }]} numberOfLines={1}>
            {route.nom}
          </Text>
          {jours.length > 0 && (
            <Text style={[styles.routeMeta, { color: colors.textSecondary }]}>{jours}</Text>
          )}
        </View>
        <View
          style={[
            styles.capacityBadge,
            {
              backgroundColor:
                capacityLeft === 0 ? '#ef444420' : capacityLeft < 5 ? '#f59e0b20' : '#10b98120',
            },
          ]}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: capacityLeft === 0 ? '#ef4444' : capacityLeft < 5 ? '#f59e0b' : '#10b981',
            }}
          >
            {capacityLeft === 0 ? 'Complet' : `${capacityLeft} place(s)`}
          </Text>
        </View>
      </View>

      <View style={[styles.routeRow, { borderTopColor: colors.border }]}>
        <View style={styles.routeStat}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.routeStatText, { color: colors.textSecondary }]}>
            {route.heureDepartMatin ?? '—'} → {route.heureRetourSoir ?? '—'}
          </Text>
        </View>
        <View style={styles.routeStat}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.routeStatText, { color: colors.textSecondary }]}>
            {route.stops.length} arrêt{route.stops.length > 1 ? 's' : ''}
          </Text>
        </View>
        {minPrix != null && (
          <Text style={[styles.priceFrom, { color: colors.primary }]}>
            dès {minPrix.toLocaleString('fr-FR')} Ar
          </Text>
        )}
      </View>
    </TouchableOpacity>
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
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyDesc: { fontSize: 13, textAlign: 'center', marginTop: 6, paddingHorizontal: 24 },
  list: { padding: 16 },
  subhead: { fontSize: 12, marginBottom: 12, fontWeight: '500' },

  routeCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  routeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  routeName: { fontSize: 15, fontWeight: '600' },
  routeMeta: { fontSize: 11, marginTop: 2 },
  capacityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },

  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  routeStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeStatText: { fontSize: 11 },
  priceFrom: { fontSize: 13, fontWeight: '700' },
});

// app/(app)/admin-revenue.tsx — Dashboard revenus de la plateforme (admin)
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import GradientHeader from '../../src/components/GradientHeader';
import { monetizationApi, RevenueStats } from '../../src/services/monetizationApi';

const TYPE_LABELS: Record<string, string> = {
  TRANSFER: 'Transferts',
  WITHDRAWAL: 'Retraits',
  MERCHANT_PAYMENT: 'Marchands',
  TAXI_BROUSSE: 'Taxi-brousse',
  TELEPHERIQUE: 'Téléphérique',
  SUBSCRIPTION: 'Abonnements',
};
const TYPE_COLORS: Record<string, string> = {
  TRANSFER: '#3b82f6',
  WITHDRAWAL: '#1e40af',
  MERCHANT_PAYMENT: '#10b981',
  TAXI_BROUSSE: '#f59e0b',
  TELEPHERIQUE: '#0891b2',
  SUBSCRIPTION: '#8b5cf6',
};

export default function AdminRevenue() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === 'ADMIN';
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    try {
      const res = await monetizationApi.adminStats();
      setStats(res.data);
    } catch (e: any) {
      console.error(e?.response?.data || e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GradientHeader title="Accès refusé" />
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={48} color={colors.textSecondary} />
          <Text style={[styles.deniedText, { color: colors.text }]}>
            Réservé aux administrateurs
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GradientHeader title="Revenus plateforme" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      </View>
    );
  }

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));
  const maxByType = stats?.byType.reduce((m, t) => Math.max(m, t.total), 0) || 1;
  const maxByMonth = stats?.byMonth.reduce((m, t) => Math.max(m, t.total), 0) || 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title="Revenus plateforme"
        subtitle="Performance financière de M'Paye"
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor="#1e40af"
          />
        }
      >
        {/* KPI principaux */}
        <View style={styles.kpiRow}>
          <LinearGradient
            colors={['#0f172a', '#1e40af']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.kpiCard}
          >
            <Text style={styles.kpiLabel}>Total cumulé</Text>
            <Text style={styles.kpiValue}>{fmt(stats?.totalAllTime ?? 0)}</Text>
            <Text style={styles.kpiUnit}>Ar</Text>
            <Text style={styles.kpiSub}>{stats?.totalAllTimeCount ?? 0} opérations</Text>
          </LinearGradient>
        </View>

        <View style={[styles.kpiRow, { marginTop: 12 }]}>
          <View style={[styles.kpiCardSmall, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="calendar" size={18} color="#10b981" />
            <Text style={[styles.kpiSmallLabel, { color: colors.textSecondary }]}>Ce mois</Text>
            <Text style={[styles.kpiSmallValue, { color: colors.text }]}>
              {fmt(stats?.totalThisMonth ?? 0)} Ar
            </Text>
            <Text style={[styles.kpiSmallSub, { color: colors.textSecondary }]}>
              {stats?.totalThisMonthCount ?? 0} TX
            </Text>
          </View>
          <View style={[styles.kpiCardSmall, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="trending-up" size={18} color="#3b82f6" />
            <Text style={[styles.kpiSmallLabel, { color: colors.textSecondary }]}>Cette année</Text>
            <Text style={[styles.kpiSmallValue, { color: colors.text }]}>
              {fmt(stats?.totalThisYear ?? 0)} Ar
            </Text>
          </View>
        </View>

        {/* Répartition par type */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Répartition par source (année)
        </Text>
        {stats?.byType.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Aucun revenu enregistré pour l'instant
          </Text>
        ) : (
          <View style={[styles.barCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {stats?.byType.map((t) => {
              const widthPct = (t.total / maxByType) * 100;
              const color = TYPE_COLORS[t.type] || '#1e40af';
              return (
                <View key={t.type} style={styles.barRow}>
                  <View style={styles.barLabelRow}>
                    <View style={[styles.colorDot, { backgroundColor: color }]} />
                    <Text style={[styles.barLabel, { color: colors.text }]}>
                      {TYPE_LABELS[t.type] || t.type}
                    </Text>
                    <Text style={[styles.barValue, { color: colors.text }]}>
                      {fmt(t.total)} Ar
                    </Text>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${widthPct}%`, backgroundColor: color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barCount, { color: colors.textSecondary }]}>
                    {t.count} opération{t.count > 1 ? 's' : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Évolution mensuelle */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Évolution (12 derniers mois)
        </Text>
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.chartContainer}>
            {stats?.byMonth.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary, padding: 20 }]}>
                Pas encore d'historique
              </Text>
            ) : (
              stats?.byMonth.map((m) => {
                const heightPct = (m.total / maxByMonth) * 100;
                return (
                  <View key={m.month} style={styles.chartCol}>
                    <View style={styles.chartBarWrap}>
                      <LinearGradient
                        colors={['#3b82f6', '#1e40af']}
                        style={[styles.chartBar, { height: `${Math.max(heightPct, 3)}%` }]}
                      />
                    </View>
                    <Text style={[styles.chartMonth, { color: colors.textSecondary }]}>
                      {m.month.slice(5)}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Abonnements actifs */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Abonnements actifs
        </Text>
        <View style={[styles.subsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(['PREMIUM', 'BUSINESS'] as const).map((plan) => {
            const found = stats?.subscriptions.find((s) => s.plan === plan);
            const count = found?.count || 0;
            const monthly = plan === 'PREMIUM' ? 10000 : 30000;
            return (
              <View key={plan} style={[styles.subRow, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subPlan, { color: colors.text }]}>{plan}</Text>
                  <Text style={[styles.subCount, { color: colors.textSecondary }]}>
                    {count} abonné{count > 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={[styles.subRevenue, { color: '#1e40af' }]}>
                  {fmt(count * monthly)} Ar/mois
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 },
  deniedText: { textAlign: 'center', fontSize: 14 },
  emptyText: { fontSize: 13, fontStyle: 'italic' },

  kpiRow: { flexDirection: 'row', gap: 12 },
  kpiCard: {
    flex: 1,
    padding: 18,
    borderRadius: 16,
  },
  kpiLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  kpiValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 6 },
  kpiUnit: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  kpiSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4 },

  kpiCardSmall: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  kpiSmallLabel: { fontSize: 11, fontWeight: '600' },
  kpiSmallValue: { fontSize: 16, fontWeight: '800' },
  kpiSmallSub: { fontSize: 11 },

  sectionTitle: { fontSize: 14, fontWeight: '700', marginTop: 20, marginBottom: 10 },

  barCard: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 14 },
  barRow: { gap: 4 },
  barLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  colorDot: { width: 8, height: 8, borderRadius: 4 },
  barLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  barValue: { fontSize: 13, fontWeight: '700' },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barCount: { fontSize: 10 },

  chartCard: { padding: 14, borderRadius: 14, borderWidth: 1 },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 140,
    gap: 4,
  },
  chartCol: { flex: 1, alignItems: 'center' },
  chartBarWrap: { width: '100%', flex: 1, justifyContent: 'flex-end' },
  chartBar: { width: '70%', alignSelf: 'center', borderRadius: 4, minHeight: 4 },
  chartMonth: { fontSize: 9, marginTop: 4 },

  subsCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
  },
  subPlan: { fontSize: 14, fontWeight: '700' },
  subCount: { fontSize: 11, marginTop: 2 },
  subRevenue: { fontSize: 14, fontWeight: '800' },
});

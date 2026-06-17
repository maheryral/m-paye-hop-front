// app/(app)/(tabs)/merchant/dashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NotificationBadge from '../../../../src/components/NotificationBadge';
import { router } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import { merchantApi } from '../../../../src/services/merchantApi';
import { useRole } from '../../../../src/contexts/RoleContext';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import type { MerchantCapability } from '../../../../src/utils/merchantCaps';

const { width } = Dimensions.get('window');

type Stats = {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalTransactions: number;
  pendingRefunds: number;
  activeCustomers: number;
  averageTransactionValue: number;
};

type Tx = {
  id: string;
  transactionId: string;
  amount: number;
  status: string;
  customerName?: string;
  createdAt: string;
  motif?: string;
};

const ACTION_COLORS: Record<string, string> = {
  paid: '#10b981',
  links: '#2563eb',
  payout: '#f59e0b',
  integrations: '#8b5cf6',
  more: '#64748b',
};

export default function MerchantDashboard() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { hasMerchantCapability } = useRole();
  const canViewDashboard = hasMerchantCapability('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [chartData, setChartData] = useState<{ labels: string[]; data: number[] }>({
    labels: [],
    data: [],
  });
  const [merchantName, setMerchantName] = useState<string>('M');
  const [balance, setBalance] = useState<number>(0);
  const [hideBalance, setHideBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Croissance estimée à partir de la tendance du graphe (1er vs dernier point).
  const growth = (() => {
    const d = chartData.data;
    if (d.length < 2) return null;
    const first = d.find((v) => v > 0) ?? 0;
    const last = d[d.length - 1] ?? 0;
    if (first <= 0) return null;
    return Math.round(((last - first) / first) * 100);
  })();

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [txRes, profileRes] = await Promise.all([
        merchantApi.getTransactions(1, 6),
        merchantApi.getProfile(),
      ]);
      setTransactions((txRes.data as any).transactions ?? []);
      const bn = (profileRes.data as any)?.businessName as string | undefined;
      setMerchantName(bn ? bn.charAt(0).toUpperCase() : 'M');

      if (canViewDashboard) {
        const [statsRes, chartRes, balanceRes] = await Promise.all([
          merchantApi.getDashboardStats(),
          merchantApi.getRevenueChart('week'),
          merchantApi.getBalance(),
        ]);
        setStats(statsRes.data);
        setChartData({
          labels: chartRes.data.labels,
          data: chartRes.data.datasets.data,
        });
        setBalance(balanceRes.data.balance ?? 0);
      }
    } catch (e: any) {
      console.error('Merchant dashboard load error:', e?.response?.data || e?.message);
      setError(
        e?.response?.data?.message ||
          'Impossible de charger les données. Vérifiez la connexion au serveur.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canViewDashboard]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, [loadAll]);

  const formatAmount = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

  const actions: {
    id: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    route: string;
    cap: MerchantCapability;
  }[] = [
    { id: 'paid', label: 'Encaisser', icon: 'qr-code-outline', route: './qrcode', cap: 'collect' },
    { id: 'links', label: 'Liens', icon: 'link-outline', route: './payment-links', cap: 'collect' },
    { id: 'payout', label: 'Retirer', icon: 'arrow-down-outline', route: './withdraw', cap: 'withdrawals' },
    { id: 'integrations', label: 'Coupons', icon: 'pricetag-outline', route: './coupons', cap: 'coupons' },
    { id: 'more', label: 'Plus', icon: 'ellipsis-horizontal', route: './analytics', cap: 'dashboard' },
  ];
  const visibleActions = actions.filter((a) => hasMerchantCapability(a.cap));

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Chargement…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <View style={[styles.logoDiamond, { backgroundColor: colors.primary }]} />
            </View>
            <Text style={[styles.logoText, { color: colors.text }]}>M'Paye</Text>
            <View style={[styles.proPill, { backgroundColor: `${colors.primary}18` }]}>
              <Text style={[styles.proPillText, { color: colors.primary }]}>PRO</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.7}
              onPress={() => router.push('./notifications')}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
              <NotificationBadge size={18} borderColor={colors.card} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('./profile')}
            >
              <LinearGradient
                colors={['#3b82f6', '#1e40af']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{merchantName}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Erreur */}
        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={20} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Revenu — carte dégradée bleue (réservé cap 'dashboard') */}
        {canViewDashboard && (
          <View style={styles.section}>
            <LinearGradient
              colors={['#2563eb', '#1e40af', '#1e3a8a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.revenueCard}
            >
              <View style={styles.revenueDecor} />
              <View style={styles.revenueRow}>
                <View style={styles.revenueTitleRow}>
                  <Text style={styles.revenueTitle}>Revenu</Text>
                  <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.9)" />
                </View>
                <View style={styles.rangePill}>
                  <Ionicons name="calendar-outline" size={13} color="#fff" />
                  <Text style={styles.rangePillText}>30 derniers jours</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.balanceLabelRow}
                activeOpacity={0.7}
                onPress={() => setHideBalance((v) => !v)}
              >
                <Text style={styles.balanceLabel}>Solde disponible</Text>
                <Ionicons
                  name={hideBalance ? 'eye-off-outline' : 'eye-outline'}
                  size={16}
                  color="rgba(255,255,255,0.85)"
                />
              </TouchableOpacity>

              <Text style={styles.revenueAmount}>
                {hideBalance ? 'Ar ••••••' : `Ar ${formatAmount(balance)}`}
              </Text>

              {growth !== null && (
                <View style={styles.growthRow}>
                  <View style={styles.growthPill}>
                    <Ionicons
                      name={growth >= 0 ? 'trending-up' : 'trending-down'}
                      size={13}
                      color="#fff"
                    />
                    <Text style={styles.growthPillText}>
                      {growth >= 0 ? '+' : ''}{growth}%
                    </Text>
                  </View>
                  <Text style={styles.growthCaption}>vs 30 derniers jours</Text>
                </View>
              )}

              {/* Mini-courbe dans la carte */}
              {chartData.data.length > 0 && (
                <View style={styles.chartInCard}>
                  <LineChart
                    data={{
                      labels: chartData.labels,
                      datasets: [{ data: chartData.data.length ? chartData.data : [0], color: () => '#ffffff', strokeWidth: 2.5 }],
                    }}
                    width={width - 64}
                    height={70}
                    withDots={false}
                    withInnerLines={false}
                    withOuterLines={false}
                    withVerticalLabels={false}
                    withHorizontalLabels={false}
                    withShadow={false}
                    bezier
                    chartConfig={{
                      backgroundGradientFrom: '#1e40af',
                      backgroundGradientTo: '#1e40af',
                      backgroundGradientFromOpacity: 0,
                      backgroundGradientToOpacity: 0,
                      decimalPlaces: 0,
                      color: () => '#ffffff',
                      propsForBackgroundLines: { stroke: 'transparent' },
                    }}
                    style={styles.chart}
                  />
                </View>
              )}

              <View style={styles.subStatsRow}>
                <View style={styles.subStat}>
                  <Text style={styles.subStatLabel}>Aujourd'hui</Text>
                  <Text style={styles.subStatValue}>Ar {formatAmount(stats?.todayRevenue ?? 0)}</Text>
                  <View style={styles.subStatDot} />
                </View>
                <View style={styles.subStatDivider} />
                <View style={styles.subStat}>
                  <Text style={styles.subStatLabel}>Solde total</Text>
                  <Text style={styles.subStatValue}>
                    {hideBalance ? 'Ar ••••' : `Ar ${formatAmount(balance)}`}
                  </Text>
                  <View style={styles.subStatDot} />
                </View>
                <View style={styles.subStatDivider} />
                <View style={styles.subStat}>
                  <Text style={styles.subStatLabel}>Transactions</Text>
                  <Text style={styles.subStatValue}>{stats?.totalTransactions ?? 0}</Text>
                  <View style={styles.subStatDot} />
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          {visibleActions.map((action) => {
            const c = ACTION_COLORS[action.id] || colors.primary;
            return (
              <TouchableOpacity
                key={action.id}
                style={styles.actionItem}
                onPress={() => router.push(action.route as any)}
                activeOpacity={0.75}
              >
                <View style={[styles.actionCircle, { backgroundColor: `${c}1a` }]}>
                  <Ionicons name={action.icon} size={22} color={c} />
                </View>
                <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Transactions récentes */}
        <View style={styles.txHeader}>
          <Text style={[styles.txHeaderTitle, { color: colors.text }]}>Transactions récentes</Text>
          <TouchableOpacity onPress={() => router.push('./transactions')}>
            <Text style={[styles.txHeaderLink, { color: colors.primary }]}>Voir tout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transactionsList}>
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={40} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Aucune transaction pour le moment
              </Text>
            </View>
          ) : (
            transactions.map((tx) => (
              <TouchableOpacity
                key={tx.id}
                style={[styles.txItem, { borderColor: colors.border, backgroundColor: colors.card }]}
                activeOpacity={0.7}
                onPress={() => router.push(`./transaction/${tx.id}` as any)}
              >
                <View style={[styles.txIcon, { backgroundColor: statusColor(tx.status) }]}>
                  <Ionicons name={statusIcon(tx.status) as any} size={18} color="#fff" />
                </View>
                <View style={styles.txContent}>
                  <Text style={[styles.txTitle, { color: colors.text }]} numberOfLines={1}>
                    {tx.customerName || tx.motif || 'Vente'}
                  </Text>
                  <Text style={[styles.txDate, { color: colors.textSecondary }]} numberOfLines={1}>
                    {formatDate(tx.createdAt)} ·{' '}
                    <Text style={{ color: statusColor(tx.status), fontWeight: '600' }}>
                      {statusLabel(tx.status)}
                    </Text>
                  </Text>
                </View>
                <View style={styles.txAmountPill}>
                  <Text style={styles.txAmountPillText}>Ar {formatAmount(tx.amount)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function statusColor(status: string) {
  switch (status) {
    case 'success':
    case 'completed':
      return '#22c55e';
    case 'pending':
      return '#f59e0b';
    case 'failed':
    case 'cancelled':
      return '#ef4444';
    case 'refunded':
      return '#8b5cf6';
    default:
      return '#64748b';
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'success':
    case 'completed':
      return 'Succès';
    case 'pending':
      return 'En attente';
    case 'failed':
    case 'cancelled':
      return 'Échoué';
    case 'refunded':
      return 'Remboursé';
    default:
      return status;
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'success':
    case 'completed':
      return 'checkmark';
    case 'pending':
      return 'time-outline';
    case 'failed':
    case 'cancelled':
      return 'close';
    case 'refunded':
      return 'arrow-undo';
    default:
      return 'link';
  }
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderColor: 'rgba(239,68,68,0.3)',
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
  },
  errorText: { color: '#ef4444', flex: 1, fontSize: 12 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMark: { width: 26, height: 26, justifyContent: 'center', alignItems: 'center' },
  logoDiamond: { width: 16, height: 16, transform: [{ rotate: '45deg' }], borderRadius: 3 },
  logoText: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  proPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 2 },
  proPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  section: { paddingHorizontal: 16, marginBottom: 8 },
  revenueCard: {
    borderRadius: 22,
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  revenueDecor: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  revenueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  revenueTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  revenueTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  rangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  rangePillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  balanceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },
  revenueAmount: { color: '#fff', fontSize: 38, fontWeight: '800', letterSpacing: -1, marginTop: 4 },
  growthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  growthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  growthPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  growthCaption: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },

  chartInCard: { marginTop: 8, marginHorizontal: -8 },
  chart: { paddingRight: 0 },

  subStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 14,
  },
  subStat: { flex: 1, alignItems: 'center', gap: 4 },
  subStatLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  subStatValue: { color: '#fff', fontSize: 13, fontWeight: '700' },
  subStatDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)', marginTop: 2 },
  subStatDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.18)' },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  actionItem: { alignItems: 'center', gap: 8, flex: 1 },
  actionCircle: { width: 52, height: 52, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '600' },

  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  txHeaderTitle: { fontSize: 16, fontWeight: '700' },
  txHeaderLink: { fontSize: 13, fontWeight: '600' },

  transactionsList: { paddingHorizontal: 16, gap: 10 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 13 },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  txIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  txContent: { flex: 1, minWidth: 0 },
  txTitle: { fontSize: 14, fontWeight: '600' },
  txDate: { fontSize: 11, marginTop: 3 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txAmountPill: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  txAmountPillText: { color: '#059669', fontSize: 14, fontWeight: '700' },
});

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
import { router } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import { merchantApi } from '../../../../src/services/merchantApi';

const { width } = Dimensions.get('window');

const BG = '#0a1230';
const CARD_BG = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.12)';
const ACCENT = '#5fb8ff';
const SUBTLE = 'rgba(255,255,255,0.55)';

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

export default function MerchantDashboard() {
  const insets = useSafeAreaInsets();
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
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [statsRes, chartRes, txRes, balanceRes, profileRes] =
        await Promise.all([
          merchantApi.getDashboardStats(),
          merchantApi.getRevenueChart('week'),
          merchantApi.getTransactions(1, 6),
          merchantApi.getBalance(),
          merchantApi.getProfile(),
        ]);

      setStats(statsRes.data);
      setChartData({
        labels: chartRes.data.labels,
        data: chartRes.data.datasets.data,
      });
      setTransactions((txRes.data as any).transactions ?? []);
      setBalance(balanceRes.data.balance ?? 0);
      const bn = (profileRes.data as any)?.businessName as string | undefined;
      setMerchantName(bn ? bn.charAt(0).toUpperCase() : 'M');
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
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, [loadAll]);

  const formatAmount = (n: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(n));

  const actions = [
    { id: 'paid', label: 'Encaisser', icon: 'arrow-up', route: './qrcode' },
    { id: 'payout', label: 'Retirer', icon: 'arrow-down', route: './withdraw' },
    { id: 'integrations', label: 'Coupons', icon: 'pricetag-outline', route: './coupons' },
    { id: 'more', label: 'Plus', icon: 'ellipsis-horizontal', route: './analytics' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Chargement…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <View style={styles.logoDiamond} />
            </View>
            <Text style={styles.logoText}>M'Paye</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              activeOpacity={0.7}
              onPress={() => router.push('./notifications')}
            >
              <Ionicons name="notifications-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatar}
              activeOpacity={0.8}
              onPress={() => router.push('./profile')}
            >
              <Text style={styles.avatarText}>{merchantName}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Erreur */}
        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={20} color="#f87171" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Revenue */}
        <View style={styles.revenueSection}>
          <View style={styles.revenueRow}>
            <Text style={styles.revenueTitle}>Revenu</Text>
            <Text style={styles.revenueRange}>30 derniers jours</Text>
          </View>
          <View style={styles.revenueAmountRow}>
            <Text style={styles.revenueCurrency}>Ar </Text>
            <Text style={styles.revenueAmount}>
              {formatAmount(stats?.monthRevenue ?? 0)}
            </Text>
          </View>

          {/* Sous-stats compactes */}
          <View style={styles.subStatsRow}>
            <View style={styles.subStat}>
              <Text style={styles.subStatLabel}>Aujourd'hui</Text>
              <Text style={styles.subStatValue}>
                Ar {formatAmount(stats?.todayRevenue ?? 0)}
              </Text>
            </View>
            <View style={styles.subStatDivider} />
            <View style={styles.subStat}>
              <Text style={styles.subStatLabel}>Solde</Text>
              <Text style={styles.subStatValue}>Ar {formatAmount(balance)}</Text>
            </View>
            <View style={styles.subStatDivider} />
            <View style={styles.subStat}>
              <Text style={styles.subStatLabel}>Trans.</Text>
              <Text style={styles.subStatValue}>
                {stats?.totalTransactions ?? 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Chart */}
        {chartData.data.length > 0 && (
          <View style={styles.chartContainer}>
            <LineChart
              data={{
                labels: chartData.labels,
                datasets: [
                  {
                    data: chartData.data.length ? chartData.data : [0],
                    color: () => ACCENT,
                    strokeWidth: 2.5,
                  },
                ],
              }}
              width={width}
              height={140}
              withDots={false}
              withInnerLines={false}
              withOuterLines={false}
              withVerticalLabels={false}
              withHorizontalLabels={false}
              withShadow={false}
              bezier
              chartConfig={{
                backgroundColor: 'transparent',
                backgroundGradientFrom: BG,
                backgroundGradientTo: BG,
                decimalPlaces: 0,
                color: () => ACCENT,
                labelColor: () => SUBTLE,
                strokeWidth: 2.5,
                propsForBackgroundLines: { stroke: 'transparent' },
              }}
              style={styles.chart}
            />
          </View>
        )}

        {/* Actions circulaires */}
        <View style={styles.actionsRow}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionItem}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.75}
            >
              <View style={styles.actionCircle}>
                <Ionicons name={action.icon as any} size={22} color="#fff" />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transactions récentes */}
        <View style={styles.txHeader}>
          <Text style={styles.txHeaderTitle}>Transactions récentes</Text>
          <TouchableOpacity onPress={() => router.push('./transactions')}>
            <Text style={styles.txHeaderLink}>Voir tout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transactionsList}>
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={40} color={SUBTLE} />
              <Text style={styles.emptyText}>Aucune transaction pour le moment</Text>
            </View>
          ) : (
            transactions.map((tx) => (
              <TouchableOpacity
                key={tx.id}
                style={styles.txItem}
                activeOpacity={0.7}
                onPress={() => router.push(`./transaction/${tx.id}` as any)}
              >
                <View style={[styles.txIcon, statusColor(tx.status)]}>
                  <Ionicons
                    name={statusIcon(tx.status) as any}
                    size={18}
                    color="#fff"
                  />
                </View>
                <View style={styles.txContent}>
                  <Text style={styles.txTitle} numberOfLines={1}>
                    {tx.customerName || tx.motif || 'Vente'}
                  </Text>
                  <Text style={styles.txDate}>
                    {formatDate(tx.createdAt)} · {tx.status}
                  </Text>
                </View>
                <Text style={styles.txAmount}>Ar {formatAmount(tx.amount)}</Text>
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
      return { backgroundColor: '#3b82f6' };
    case 'pending':
      return { backgroundColor: '#f59e0b' };
    case 'failed':
    case 'cancelled':
      return { backgroundColor: '#ef4444' };
    case 'refunded':
      return { backgroundColor: '#8b5cf6' };
    default:
      return { backgroundColor: '#6b4ba8' };
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
  safeArea: { flex: 1, backgroundColor: BG },
  container: { flex: 1, backgroundColor: BG },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG,
    gap: 12,
  },
  loadingText: { color: SUBTLE, fontSize: 13 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.3)',
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
  },
  errorText: { color: '#fca5a5', flex: 1, fontSize: 12 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoDiamond: {
    width: 16,
    height: 16,
    backgroundColor: ACCENT,
    transform: [{ rotate: '45deg' }],
    borderRadius: 3,
  },
  logoText: { color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  revenueSection: { paddingHorizontal: 20 },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 10,
  },
  revenueTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  revenueRange: { color: SUBTLE, fontSize: 12 },
  revenueAmountRow: { flexDirection: 'row', alignItems: 'flex-end' },
  revenueCurrency: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    opacity: 0.85,
  },
  revenueAmount: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.5,
  },

  subStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  subStat: { flex: 1, alignItems: 'center', gap: 4 },
  subStatLabel: { color: SUBTLE, fontSize: 11 },
  subStatValue: { color: '#fff', fontSize: 13, fontWeight: '700' },
  subStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: BORDER,
  },

  chartContainer: { marginVertical: 8 },
  chart: { paddingRight: 0, marginLeft: -20 },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 22,
    paddingHorizontal: 12,
  },
  actionItem: { alignItems: 'center', gap: 10, flex: 1 },
  actionCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: { color: '#fff', fontSize: 11, fontWeight: '500' },

  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  txHeaderTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  txHeaderLink: { color: ACCENT, fontSize: 12, fontWeight: '600' },

  transactionsList: { paddingHorizontal: 20 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: { color: SUBTLE, fontSize: 13 },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  txIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txContent: { flex: 1 },
  txTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  txDate: { color: SUBTLE, fontSize: 11, marginTop: 3 },
  txAmount: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

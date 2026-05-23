// app/(app)/(tabs)/merchant/analytics.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { merchantApi } from '../../../../src/services/merchantApi';

type Period = 'day' | 'week' | 'month' | 'year';

interface StatsData {
  revenue: {
    total: number;
    average: number;
    growth: number;
  };
  transactions: {
    count: number;
    average: number;
    growth: number;
  };
  customers: {
    total: number;
    new: number;
    growth: number;
  };
  topProducts: Array<{
    id: string;
    name: string;
    sales: number;
    revenue: number;
  }>;
  salesByDay: Array<{
    day: string;
    amount: number;
    count: number;
  }>;
  paymentMethods: Array<{
    method: string;
    percentage: number;
    amount: number;
  }>;
}

export default function MerchantAnalytics() {
  const { colors } = useTheme();
  const [period, setPeriod] = useState<Period>('week');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await merchantApi.getFullAnalytics(period);
      setStats(response.data as StatsData);
    } catch (e: any) {
      console.error('Analytics load error:', e?.response?.data || e?.message);
      setError(
        e?.response?.data?.message ||
          'Impossible de charger les statistiques',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-MG', {
      style: 'currency',
      currency: 'MGA',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'day': return "aujourd'hui";
      case 'week': return 'cette semaine';
      case 'month': return 'ce mois';
      case 'year': return 'cette année';
    }
  };

  const getMaxBarHeight = (data: { amount: number }[]) => {
    const max = Math.max(...data.map(d => d.amount));
    return max > 0 ? max : 1;
  };

  if (loading || !stats) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Statistiques</Text>
        <View style={{ width: 40 }} />
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: '#ef444415', borderColor: '#ef4444' }]}>
          <Ionicons name="warning-outline" size={18} color="#ef4444" />
          <Text style={[styles.errorText, { color: '#ef4444' }]}>{error}</Text>
        </View>
      )}

      {/* Période selector */}
      <View style={styles.periodSelector}>
        <TouchableOpacity
          style={[styles.periodButton, period === 'day' && { backgroundColor: colors.primary }]}
          onPress={() => setPeriod('day')}
        >
          <Text style={[styles.periodText, period === 'day' && { color: '#fff' }]}>Jour</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, period === 'week' && { backgroundColor: colors.primary }]}
          onPress={() => setPeriod('week')}
        >
          <Text style={[styles.periodText, period === 'week' && { color: '#fff' }]}>Semaine</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, period === 'month' && { backgroundColor: colors.primary }]}
          onPress={() => setPeriod('month')}
        >
          <Text style={[styles.periodText, period === 'month' && { color: '#fff' }]}>Mois</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, period === 'year' && { backgroundColor: colors.primary }]}
          onPress={() => setPeriod('year')}
        >
          <Text style={[styles.periodText, period === 'year' && { color: '#fff' }]}>Année</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.kpiIcon, { backgroundColor: `${colors.primary}20` }]}>
            <Ionicons name="trending-up-outline" size={22} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.kpiValue, { color: colors.text }]}>{formatCurrency(stats.revenue.total)}</Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Chiffre d'affaires</Text>
          </View>
          <View style={[styles.kpiGrowth, { backgroundColor: stats.revenue.growth >= 0 ? '#3b82f620' : '#ef444420' }]}>
            <Ionicons name={stats.revenue.growth >= 0 ? "arrow-up-outline" : "arrow-down-outline"} size={12} color={stats.revenue.growth >= 0 ? '#3b82f6' : '#ef4444'} />
            <Text style={[styles.kpiGrowthText, { color: stats.revenue.growth >= 0 ? '#3b82f6' : '#ef4444' }]}>
              {Math.abs(stats.revenue.growth)}%
            </Text>
          </View>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.kpiIcon, { backgroundColor: `${colors.success}20` }]}>
            <Ionicons name="cart-outline" size={22} color={colors.success} />
          </View>
          <View>
            <Text style={[styles.kpiValue, { color: colors.text }]}>{stats.transactions.count}</Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Transactions</Text>
          </View>
          <View style={[styles.kpiGrowth, { backgroundColor: stats.transactions.growth >= 0 ? '#3b82f620' : '#ef444420' }]}>
            <Ionicons name={stats.transactions.growth >= 0 ? "arrow-up-outline" : "arrow-down-outline"} size={12} color={stats.transactions.growth >= 0 ? '#3b82f6' : '#ef4444'} />
            <Text style={[styles.kpiGrowthText, { color: stats.transactions.growth >= 0 ? '#3b82f6' : '#ef4444' }]}>
              {Math.abs(stats.transactions.growth)}%
            </Text>
          </View>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.kpiIcon, { backgroundColor: `${colors.warning}20` }]}>
            <Ionicons name="people-outline" size={22} color={colors.warning} />
          </View>
          <View>
            <Text style={[styles.kpiValue, { color: colors.text }]}>{stats.customers.total}</Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Clients</Text>
          </View>
          <View style={[styles.kpiGrowth, { backgroundColor: stats.customers.growth >= 0 ? '#3b82f620' : '#ef444420' }]}>
            <Ionicons name={stats.customers.growth >= 0 ? "arrow-up-outline" : "arrow-down-outline"} size={12} color={stats.customers.growth >= 0 ? '#3b82f6' : '#ef4444'} />
            <Text style={[styles.kpiGrowthText, { color: stats.customers.growth >= 0 ? '#3b82f6' : '#ef4444' }]}>
              {Math.abs(stats.customers.growth)}%
            </Text>
          </View>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.kpiIcon, { backgroundColor: `${colors.info}20` }]}>
            <Ionicons name="cash-outline" size={22} color={colors.info} />
          </View>
          <View>
            <Text style={[styles.kpiValue, { color: colors.text }]}>{formatCurrency(stats.transactions.average)}</Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Panier moyen</Text>
          </View>
        </View>
      </View>

      {/* Graphique des ventes */}
      <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.chartTitle, { color: colors.text }]}>Ventes {getPeriodLabel()}</Text>
        <View style={styles.barChart}>
          {stats.salesByDay.map((item, index) => {
            const maxHeight = getMaxBarHeight(stats.salesByDay);
            const barHeight = (item.amount / maxHeight) * 120;
            return (
              <View key={index} style={styles.barContainer}>
                <View style={[styles.bar, { height: barHeight, backgroundColor: colors.primary }]} />
                <Text style={[styles.barLabel, { color: colors.textSecondary }]}>{item.day}</Text>
                <Text style={[styles.barValue, { color: colors.textSecondary }]}>{formatCurrency(item.amount)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Top produits */}
      <View style={[styles.topProductsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Top produits</Text>
        {stats.topProducts.map((product, index) => (
          <View key={product.id} style={[styles.productItem, { borderBottomColor: colors.border }]}>
            <View style={styles.productRank}>
              <Text style={[styles.rankText, { color: colors.primary }]}>{index + 1}</Text>
            </View>
            <View style={styles.productInfo}>
              <Text style={[styles.productName, { color: colors.text }]}>{product.name}</Text>
              <Text style={[styles.productStats, { color: colors.textSecondary }]}>
                {product.sales} ventes • {formatCurrency(product.revenue)}
              </Text>
            </View>
            <View style={[styles.productProgress, { backgroundColor: `${colors.primary}20` }]}>
              <View style={[styles.productProgressFill, { width: `${(product.revenue / stats.revenue.total) * 100}%`, backgroundColor: colors.primary }]} />
            </View>
          </View>
        ))}
      </View>

      {/* Méthodes de paiement */}
      <View style={[styles.paymentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Méthodes de paiement</Text>
        {stats.paymentMethods.map((method, index) => (
          <View key={index} style={[styles.paymentItem, { borderBottomColor: colors.border }]}>
            <View style={styles.paymentHeader}>
              <Text style={[styles.paymentName, { color: colors.text }]}>{method.method}</Text>
              <Text style={[styles.paymentPercentage, { color: colors.primary }]}>{method.percentage}%</Text>
            </View>
            <View style={[styles.paymentBar, { backgroundColor: `${colors.primary}20` }]}>
              <View style={[styles.paymentBarFill, { width: `${method.percentage}%`, backgroundColor: colors.primary }]} />
            </View>
            <Text style={[styles.paymentAmount, { color: colors.textSecondary }]}>{formatCurrency(method.amount)}</Text>
          </View>
        ))}
      </View>

      {/* Résumé */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>Résumé {getPeriodLabel()}</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>CA journalier moyen</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCurrency(stats.revenue.average)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Transactions/jour</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{Math.round(stats.transactions.count / (period === 'week' ? 7 : period === 'month' ? 30 : 365))}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Nouveaux clients</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{stats.customers.new}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Taux de conversion</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{(stats.transactions.count / stats.customers.total * 100).toFixed(1)}%</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },

  periodSelector: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  periodText: { fontSize: 13, fontWeight: '500' },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  kpiIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 16, fontWeight: 'bold' },
  kpiLabel: { fontSize: 11 },
  kpiGrowth: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 3,
    marginLeft: 'auto',
  },
  kpiGrowthText: { fontSize: 10, fontWeight: '600' },

  chartCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  chartTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 180,
  },
  barContainer: { alignItems: 'center', width: 40 },
  bar: { width: 30, borderRadius: 8, marginBottom: 8 },
  barLabel: { fontSize: 10, marginTop: 4 },
  barValue: { fontSize: 9, marginTop: 2 },

  topProductsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  productRank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F0F0' },
  rankText: { fontSize: 14, fontWeight: 'bold' },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '500' },
  productStats: { fontSize: 11, marginTop: 2 },
  productProgress: { width: 60, height: 4, borderRadius: 2, overflow: 'hidden' },
  productProgressFill: { height: '100%', borderRadius: 2 },

  paymentCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  paymentItem: { paddingVertical: 12, borderBottomWidth: 1 },
  paymentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  paymentName: { fontSize: 14 },
  paymentPercentage: { fontSize: 14, fontWeight: '600' },
  paymentBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  paymentBarFill: { height: '100%', borderRadius: 3 },
  paymentAmount: { fontSize: 11, marginTop: 6 },

  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 30,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  summaryTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  summaryItem: { flex: 1, minWidth: '45%' },
  summaryLabel: { fontSize: 12, marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: '600' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 12 },
});
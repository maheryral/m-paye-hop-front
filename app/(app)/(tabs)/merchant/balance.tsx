// app/(app)/(tabs)/merchant/balance.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { merchantApi } from '../../../../src/services/merchantApi';

interface BalanceData {
  available: number;
  pending: number;
  totalReceived: number;
  totalWithdrawn: number;
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  currency?: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  bankAccount: string;
  createdAt: string;
  processedAt?: string;
}

export default function MerchantBalance() {
  const { colors } = useTheme();
  
  const [balance, setBalance] = useState<BalanceData>({
    available: 0,
    pending: 0,
    totalReceived: 0,
    totalWithdrawn: 0,
    todayEarnings: 0,
    weekEarnings: 0,
    monthEarnings: 0,
  });

  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [balanceRes, withdrawalsRes] = await Promise.all([
        merchantApi.getBalance(),
        merchantApi.getWithdrawalHistory(1, 20),
      ]);

      const b = balanceRes.data || ({} as any);
      setBalance((prev) => ({
        ...prev,
        available: b.balance ?? 0,
        pending: b.pendingBalance ?? 0,
        totalReceived: b.totalReceived ?? 0,
        currency: b.currency,
      }));

      const wData = withdrawalsRes.data;
      const list: Withdrawal[] = Array.isArray(wData)
        ? wData
        : (wData?.withdrawals || wData?.data || []);
      setWithdrawals(list);
    } catch (error: any) {
      Alert.alert('Erreur', error?.response?.data?.message || 'Impossible de charger les données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-MG', {
      style: 'currency',
      currency: 'MGA',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#3b82f6';
      case 'processing': return '#3b82f6';
      case 'pending': return '#f59e0b';
      case 'failed': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Terminé';
      case 'processing': return 'En traitement';
      case 'pending': return 'En attente';
      case 'failed': return 'Échoué';
      default: return status;
    }
  };

  const handleWithdraw = () => {
    router.push('./withdraw');
  };

  const handleViewDetails = (withdrawal: Withdrawal) => {
    Alert.alert(
      'Détails du retrait',
      `Montant: ${formatCurrency(withdrawal.amount)}\nStatut: ${getStatusText(withdrawal.status)}\nCompte: ${withdrawal.bankAccount}\nDate: ${formatDate(withdrawal.createdAt)}${withdrawal.processedAt ? `\nTraité le: ${formatDate(withdrawal.processedAt)}` : ''}`,
      [{ text: 'OK' }]
    );
  };

  const HistoryModal = () => (
    <Modal
      visible={showHistory}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowHistory(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Historique des retraits</Text>
            <TouchableOpacity onPress={() => setShowHistory(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {withdrawals.length > 0 ? (
              withdrawals.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.historyItem, { borderBottomColor: colors.border }]}
                  onPress={() => handleViewDetails(item)}
                >
                  <View style={styles.historyHeader}>
                    <Text style={[styles.historyAmount, { color: colors.text }]}>
                      {formatCurrency(item.amount)}
                    </Text>
                    <View style={[styles.historyStatusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
                      <Text style={[styles.historyStatusText, { color: getStatusColor(item.status) }]}>
                        {getStatusText(item.status)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.historyDetails}>
                    <View style={styles.historyDetailItem}>
                      <Ionicons name="business-outline" size={12} color={colors.textSecondary} />
                      <Text style={[styles.historyDetailText, { color: colors.textSecondary }]}>
                        {item.bankAccount}
                      </Text>
                    </View>
                    <View style={styles.historyDetailItem}>
                      <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                      <Text style={[styles.historyDetailText, { color: colors.textSecondary }]}>
                        {formatDate(item.createdAt)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyHistory}>
                <Ionicons name="time-outline" size={50} color={colors.textSecondary} />
                <Text style={[styles.emptyHistoryText, { color: colors.textSecondary }]}>
                  Aucun historique de retrait
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mon solde</Text>
        <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.historyButton}>
          <Ionicons name="time-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Solde principal */}
      <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
        <Text style={styles.balanceLabel}>Solde disponible</Text>
        <Text style={styles.balanceValue}>{formatCurrency(balance.available)}</Text>
        <View style={styles.balanceActions}>
          <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdraw}>
            <Ionicons name="arrow-down-outline" size={18} color={colors.primary} />
            <Text style={[styles.withdrawBtnText, { color: colors.primary }]}>Retirer</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Statistiques */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.statIcon, { backgroundColor: `${colors.warning}20` }]}>
            <Ionicons name="time-outline" size={22} color={colors.warning} />
          </View>
          <View>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(balance.pending)}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>En attente</Text>
          </View>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.statIcon, { backgroundColor: `${colors.success}20` }]}>
            <Ionicons name="trending-up-outline" size={22} color={colors.success} />
          </View>
          <View>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(balance.totalReceived)}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total reçu</Text>
          </View>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.statIcon, { backgroundColor: `${colors.error}20` }]}>
            <Ionicons name="arrow-up-outline" size={22} color={colors.error} />
          </View>
          <View>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(balance.totalWithdrawn)}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total retiré</Text>
          </View>
        </View>
      </View>

      {/* Gains récents */}
      <View style={styles.earningsSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Gains récents</Text>
        <View style={styles.earningsGrid}>
          <View style={[styles.earningCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.earningHeader}>
              <Ionicons name="today-outline" size={18} color={colors.primary} />
              <Text style={[styles.earningTitle, { color: colors.text }]}>Aujourd'hui</Text>
            </View>
            <Text style={[styles.earningValue, { color: colors.success }]}>{formatCurrency(balance.todayEarnings)}</Text>
          </View>

          <View style={[styles.earningCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.earningHeader}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={[styles.earningTitle, { color: colors.text }]}>Cette semaine</Text>
            </View>
            <Text style={[styles.earningValue, { color: colors.success }]}>{formatCurrency(balance.weekEarnings)}</Text>
          </View>

          <View style={[styles.earningCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.earningHeader}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={[styles.earningTitle, { color: colors.text }]}>Ce mois</Text>
            </View>
            <Text style={[styles.earningValue, { color: colors.success }]}>{formatCurrency(balance.monthEarnings)}</Text>
          </View>
        </View>
      </View>

      {/* Derniers retraits */}
      <View style={styles.recentSection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Derniers retraits</Text>
          <TouchableOpacity onPress={() => setShowHistory(true)}>
            <Text style={[styles.viewAllText, { color: colors.primary }]}>Voir tout</Text>
          </TouchableOpacity>
        </View>

        {withdrawals.slice(0, 3).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.recentItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => handleViewDetails(item)}
          >
            <View style={styles.recentIcon}>
              <Ionicons name="cash-outline" size={22} color={getStatusColor(item.status)} />
            </View>
            <View style={styles.recentInfo}>
              <Text style={[styles.recentAmount, { color: colors.text }]}>{formatCurrency(item.amount)}</Text>
              <Text style={[styles.recentDate, { color: colors.textSecondary }]}>{formatDate(item.createdAt)}</Text>
            </View>
            <View style={[styles.recentStatus, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
              <Text style={[styles.recentStatusText, { color: getStatusColor(item.status) }]}>
                {getStatusText(item.status)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {withdrawals.filter(w => w.status === 'pending').length > 0 && (
          <View style={[styles.pendingAlert, { backgroundColor: `${colors.warning}15`, borderColor: colors.warning }]}>
            <Ionicons name="information-circle" size={20} color={colors.warning} />
            <Text style={[styles.pendingAlertText, { color: colors.warning }]}>
              Vous avez {withdrawals.filter(w => w.status === 'pending').length} retrait(s) en attente de traitement
            </Text>
          </View>
        )}
      </View>

      {/* Informations */}
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.infoTitle, { color: colors.text }]}>Informations</Text>
        <View style={styles.infoItem}>
          <Ionicons name="timer-outline" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Les retraits sont traités sous 24-48h ouvrées
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Vos transactions sont sécurisées
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="call-outline" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Service client: +261 32 12 345 67
          </Text>
        </View>
      </View>

      <HistoryModal />
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
  historyButton: { padding: 8 },
  
  balanceCard: {
    margin: 16,
    padding: 24,
    borderRadius: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  balanceActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
  },
  withdrawBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 16, fontWeight: 'bold' },
  statLabel: { fontSize: 11 },
  
  earningsSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  earningsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  earningCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  earningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  earningTitle: { fontSize: 12, fontWeight: '500' },
  earningValue: { fontSize: 14, fontWeight: 'bold' },
  
  recentSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: { fontSize: 13, fontWeight: '500' },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  recentIcon: { width: 40, alignItems: 'center' },
  recentInfo: { flex: 1 },
  recentAmount: { fontSize: 14, fontWeight: '600' },
  recentDate: { fontSize: 11, marginTop: 2 },
  recentStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  recentStatusText: { fontSize: 11, fontWeight: '500' },
  
  pendingAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginTop: 12,
  },
  pendingAlertText: { flex: 1, fontSize: 12 },
  
  infoCard: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  infoTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  infoText: { flex: 1, fontSize: 12 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  historyItem: { paddingVertical: 14, borderBottomWidth: 1, gap: 8 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyAmount: { fontSize: 16, fontWeight: '600' },
  historyStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  historyStatusText: { fontSize: 11, fontWeight: '500' },
  historyDetails: { flexDirection: 'row', gap: 16 },
  historyDetailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  historyDetailText: { fontSize: 11 },
  emptyHistory: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyHistoryText: { fontSize: 14 },
});
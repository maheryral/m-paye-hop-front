
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { merchantApi } from '../../../../src/services/merchantApi';

interface Refund {
  id: string;
  transactionId: string;
  transactionReference?: string;
  amount: number;
  reason: string;
  status: 'pending' | 'completed' | 'rejected';
  customerName?: string;
  customerPhone?: string;
  createdAt: string;
  processedAt?: string;
  rejectionReason?: string;
}

export default function MerchantRefunds() {
  const { colors } = useTheme();
  
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadRefunds();
  }, []);

  const loadRefunds = async () => {
    setLoading(true);
    try {
      const response = await merchantApi.getRefunds(1, 50);
      setRefunds(response.data?.refunds || []);
    } catch (error: any) {
      Alert.alert('Erreur', error?.response?.data?.message || 'Impossible de charger les remboursements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRefunds();
  }, []);

  const handleViewDetails = async (refund: Refund) => {
    setSelectedRefund(refund);
    setModalVisible(true);
    try {
      const response = await merchantApi.getRefundDetails(refund.id);
      if (response?.data) {
        setSelectedRefund({ ...refund, ...response.data });
      }
    } catch (error: any) {
      Alert.alert('Erreur', error?.response?.data?.message || 'Impossible de charger les détails');
    }
  };

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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'approved': return '#3b82f6';
      case 'completed': return '#3b82f6';
      case 'rejected': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'approved': return 'Approuvé';
      case 'completed': return 'Remboursé';
      case 'rejected': return 'Rejeté';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return 'time-outline';
      case 'approved': return 'checkmark-circle-outline';
      case 'completed': return 'checkmark-done-circle-outline';
      case 'rejected': return 'close-circle-outline';
      default: return 'help-circle-outline';
    }
  };

  const getFilteredRefunds = () => {
    if (filterStatus === 'all') return refunds;
    return refunds.filter(r => r.status === filterStatus);
  };

  const getStats = () => {
    const total = refunds.reduce((sum, r) => sum + r.amount, 0);
    const pending = refunds.filter(r => r.status === 'pending').length;
    const completed = refunds.filter(r => r.status === 'completed').length;
    return { total, pending, completed };
  };

  const stats = getStats();

  const renderRefundCard = ({ item }: { item: Refund }) => (
    <TouchableOpacity
      style={[styles.refundCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => handleViewDetails(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={[styles.refundId, { color: colors.primary }]}>#{item.id}</Text>
          <Text style={[styles.transactionRef, { color: colors.textSecondary }]}>
            Transaction: {item.transactionReference || item.transactionId}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
          <Ionicons name={getStatusIcon(item.status)} size={12} color={getStatusColor(item.status)} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.customerInfo}>
          <View style={[styles.customerAvatar, { backgroundColor: `${colors.primary}20` }]}>
            <Text style={[styles.customerInitial, { color: colors.primary }]}>
              {(item.customerName || '?').charAt(0)}
            </Text>
          </View>
          <View>
            <Text style={[styles.customerName, { color: colors.text }]}>{item.customerName || 'Client'}</Text>
            <Text style={[styles.customerPhone, { color: colors.textSecondary }]}>{item.customerPhone || ''}</Text>
          </View>
        </View>

        <View style={styles.amountContainer}>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Montant</Text>
          <Text style={[styles.amountValue, { color: colors.error }]}>{formatCurrency(item.amount)}</Text>
        </View>

        <View style={styles.reasonContainer}>
          <Text style={[styles.reasonLabel, { color: colors.textSecondary }]}>Motif</Text>
          <Text style={[styles.reasonText, { color: colors.text }]} numberOfLines={2}>
            {item.reason}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.dateItem}>
            <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>
              Demandé le {formatDate(item.createdAt)}
            </Text>
          </View>
          {item.processedAt && (
            <View style={styles.dateItem}>
              <Ionicons name="checkmark-done-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                Traité le {formatDate(item.processedAt)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const RefundDetailsModal = () => (
    <Modal
      visible={modalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Détails du remboursement</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {selectedRefund && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.detailCard, { backgroundColor: colors.background }]}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Statut</Text>
                  <View style={[styles.detailStatusBadge, { backgroundColor: `${getStatusColor(selectedRefund.status)}20` }]}>
                    <Ionicons name={getStatusIcon(selectedRefund.status)} size={14} color={getStatusColor(selectedRefund.status)} />
                    <Text style={[styles.detailStatusText, { color: getStatusColor(selectedRefund.status) }]}>
                      {getStatusText(selectedRefund.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>ID Remboursement</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>#{selectedRefund.id}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Transaction</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedRefund.transactionReference || selectedRefund.transactionId}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Client</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedRefund.customerName || 'N/A'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Téléphone</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedRefund.customerPhone || 'N/A'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Montant</Text>
                  <Text style={[styles.detailValue, { color: colors.error, fontSize: 20, fontWeight: 'bold' }]}>
                    {formatCurrency(selectedRefund.amount)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Motif</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedRefund.reason}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date de demande</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(selectedRefund.createdAt)}</Text>
                </View>

                {selectedRefund.processedAt && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date de traitement</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(selectedRefund.processedAt)}</Text>
                  </View>
                )}

                {selectedRefund.rejectionReason && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Motif du rejet</Text>
                    <Text style={[styles.detailValue, { color: colors.error }]}>{selectedRefund.rejectionReason}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.closeButtonText, { color: colors.text }]}>Fermer</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  if (loading && refunds.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const filteredRefunds = getFilteredRefunds();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Remboursements</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats */}
      <View style={[styles.statsBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>{refunds.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Demandes</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.warning }]}>{stats.pending}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>En attente</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.success }]}>{stats.completed}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Remboursés</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.error }]}>{formatCurrency(stats.total)}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterChip, filterStatus === 'all' && { backgroundColor: colors.primary }]}
            onPress={() => setFilterStatus('all')}
          >
            <Text style={[styles.filterChipText, filterStatus === 'all' && { color: '#fff' }]}>Tous</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterStatus === 'pending' && { backgroundColor: colors.warning }]}
            onPress={() => setFilterStatus('pending')}
          >
            <Text style={[styles.filterChipText, filterStatus === 'pending' && { color: '#fff' }]}>En attente</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterStatus === 'approved' && { backgroundColor: colors.primary }]}
            onPress={() => setFilterStatus('approved')}
          >
            <Text style={[styles.filterChipText, filterStatus === 'approved' && { color: '#fff' }]}>Approuvés</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterStatus === 'completed' && { backgroundColor: colors.success }]}
            onPress={() => setFilterStatus('completed')}
          >
            <Text style={[styles.filterChipText, filterStatus === 'completed' && { color: '#fff' }]}>Remboursés</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterStatus === 'rejected' && { backgroundColor: colors.error }]}
            onPress={() => setFilterStatus('rejected')}
          >
            <Text style={[styles.filterChipText, filterStatus === 'rejected' && { color: '#fff' }]}>Rejetés</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* List */}
      <FlatList
        data={filteredRefunds}
        keyExtractor={(item) => item.id}
        renderItem={renderRefundCard}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={filteredRefunds.length === 0 ? styles.emptyList : styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="refresh-outline" size={60} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucune demande de remboursement</Text>
          </View>
        )}
      />

      <RefundDetailsModal />
    </View>
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
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  statLabel: { fontSize: 12 },
  statDivider: { width: 1, height: 30 },
  filtersContainer: { paddingHorizontal: 16, marginBottom: 12 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0F0F0', marginRight: 10 },
  filterChipText: { fontSize: 13, fontWeight: '500' },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  emptyList: { flex: 1 },
  refundCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  refundId: { fontSize: 16, fontWeight: 'bold' },
  transactionRef: { fontSize: 11, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  statusText: { fontSize: 11, fontWeight: '500' },
  cardBody: { gap: 12 },
  customerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  customerAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  customerInitial: { fontSize: 18, fontWeight: 'bold' },
  customerName: { fontSize: 16, fontWeight: '600' },
  customerPhone: { fontSize: 12, marginTop: 2 },
  amountContainer: { alignItems: 'flex-end' },
  amountLabel: { fontSize: 11, marginBottom: 2 },
  amountValue: { fontSize: 18, fontWeight: 'bold' },
  reasonContainer: { gap: 4 },
  reasonLabel: { fontSize: 11 },
  reasonText: { fontSize: 13 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  dateItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  detailCard: { borderRadius: 16, padding: 16, marginBottom: 16, gap: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 14, fontWeight: '500' },
  detailStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, gap: 6 },
  detailStatusText: { fontSize: 13, fontWeight: '500' },
  rejectionInput: { marginBottom: 16 },
  rejectionLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  rejectionTextArea: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, height: 80, textAlignVertical: 'top' },
  actionButtons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 8 },
  actionButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  processButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8, marginBottom: 12 },
  processButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  closeButton: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 8 },
  closeButtonText: { fontSize: 14, fontWeight: '500' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { fontSize: 16, marginTop: 16 },
});
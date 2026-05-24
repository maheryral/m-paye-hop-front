// app/(app)/(tabs)/merchant/transactions.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { merchantApi } from '../../../../src/services/merchantApi';

type FilterStatus = 'all' | 'completed' | 'pending' | 'failed' | 'refunded';
type FilterPeriod = 'today' | 'week' | 'month' | 'custom';

interface Transaction {
  id: string;
  transactionId: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed' | 'refunded' | 'cancelled';
  customerName?: string;
  customerPhone?: string;
  createdAt: string;
  paymentMethod: string;
}

export default function MerchantTransactions() {
  const { colors } = useTheme();
  
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<FilterPeriod>('week');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  /**
   * 📄 Génère le reçu en PDF via expo-print depuis le HTML retourné par le backend.
   * Puis ouvre le partage natif (WhatsApp, Email, etc.)
   */
  const generateReceiptPdf = async (transactionId: string) => {
    setGeneratingPdf(true);
    try {
      const res = await merchantApi.receiptHtml(transactionId);
      const html = res.data?.html;
      if (!html) {
        Alert.alert('Erreur', 'Reçu indisponible');
        return;
      }
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Partager le reçu',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF généré', `Fichier : ${uri}`);
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Génération PDF impossible');
    } finally {
      setGeneratingPdf(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    applyFilters(allTransactions);
  }, [selectedStatus, selectedPeriod, searchQuery, allTransactions]);

  const applyFilters = (source: Transaction[]) => {
    let filtered = [...source];

    // Filtre par statut
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(t => t.status === selectedStatus);
    }

    // Filtre par période
    const now = new Date();
    if (selectedPeriod === 'today') {
      filtered = filtered.filter(t => new Date(t.createdAt).toDateString() === now.toDateString());
    } else if (selectedPeriod === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(t => new Date(t.createdAt) >= weekAgo);
    } else if (selectedPeriod === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter(t => new Date(t.createdAt) >= monthAgo);
    }

    // Filtre par recherche
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        (t.customerName || '').toLowerCase().includes(q) ||
        (t.customerPhone || '').includes(searchQuery) ||
        (t.transactionId || '').toLowerCase().includes(q)
      );
    }

    setTransactions(filtered);
  };

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const response = await merchantApi.getTransactions(1, 50);
      const list: Transaction[] = (response.data?.transactions || []).map((t: any) => ({
        id: t.id || t.transactionId,
        transactionId: t.transactionId || t.id,
        amount: t.amount,
        status: t.status,
        customerName: t.customerName,
        customerPhone: t.customerPhone,
        createdAt: t.createdAt,
        paymentMethod: t.paymentMethod,
      }));
      setAllTransactions(list);
    } catch (error: any) {
      Alert.alert('Erreur', error?.response?.data?.message || 'Impossible de charger les transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTransactions();
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
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'À l\'instant';
    if (diffHours < 24) return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#3b82f6';
      case 'pending': return '#f59e0b';
      case 'failed': return '#ef4444';
      case 'refunded': return '#8b5cf6';
      default: return '#94a3b8';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Réussi';
      case 'pending': return 'En attente';
      case 'failed': return 'Échoué';
      case 'refunded': return 'Remboursé';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return 'checkmark-circle';
      case 'pending': return 'time';
      case 'failed': return 'alert-circle';
      case 'refunded': return 'refresh';
      default: return 'help-circle';
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'Mobile Money': return 'phone-portrait-outline';
      case 'Carte bancaire': return 'card-outline';
      case 'QR Code': return 'qr-code-outline';
      default: return 'cash-outline';
    }
  };

  const handleTransactionPress = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowDetails(true);
  };

  const renderTransactionCard = ({ item }: { item: Transaction }) => (
    <TouchableOpacity
      style={[styles.transactionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => handleTransactionPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.customerInfo}>
          <View style={[styles.avatar, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
            <Text style={[styles.avatarText, { color: getStatusColor(item.status) }]}>
              {(item.customerName || '?').charAt(0)}
            </Text>
          </View>
          <View>
            <Text style={[styles.customerName, { color: colors.text }]}>{item.customerName || 'Client'}</Text>
            <Text style={[styles.transactionRef, { color: colors.textSecondary }]}>{item.transactionId}</Text>
          </View>
        </View>
        <View style={styles.amountContainer}>
          <Text style={[styles.amount, { color: colors.success }]}>
            +{formatCurrency(item.amount)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
            <Ionicons name={getStatusIcon(item.status)} size={12} color={getStatusColor(item.status)} />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerItem}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
        <View style={styles.footerItem}>
          <Ionicons name={getPaymentMethodIcon(item.paymentMethod)} size={14} color={colors.textSecondary} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            {item.paymentMethod}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const TransactionDetailsModal = () => (
    <Modal
      visible={showDetails}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowDetails(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Détails transaction</Text>
            <TouchableOpacity onPress={() => setShowDetails(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {selectedTransaction && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.detailCard, { backgroundColor: colors.background }]}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Statut</Text>
                  <View style={[styles.detailStatusBadge, { backgroundColor: `${getStatusColor(selectedTransaction.status)}20` }]}>
                    <Ionicons name={getStatusIcon(selectedTransaction.status)} size={14} color={getStatusColor(selectedTransaction.status)} />
                    <Text style={[styles.detailStatusText, { color: getStatusColor(selectedTransaction.status) }]}>
                      {getStatusText(selectedTransaction.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Montant</Text>
                  <Text style={[styles.detailValue, { color: colors.text, fontSize: 24, fontWeight: 'bold' }]}>
                    {formatCurrency(selectedTransaction.amount)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Client</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedTransaction.customerName || 'N/A'}</Text>
                </View>

                {selectedTransaction.customerPhone && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Téléphone</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedTransaction.customerPhone}</Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {new Date(selectedTransaction.createdAt).toLocaleString('fr-FR')}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Méthode</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedTransaction.paymentMethod}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Référence</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedTransaction.transactionId}</Text>
                </View>
              </View>

              {selectedTransaction.status === 'completed' && (
                <TouchableOpacity style={[styles.refundButton, { backgroundColor: '#ef444420' }]}>
                  <Ionicons name="refresh-outline" size={20} color="#ef4444" />
                  <Text style={[styles.refundButtonText, { color: '#ef4444' }]}>Demander un remboursement</Text>
                </TouchableOpacity>
              )}

              {/* 📄 Générer reçu PDF */}
              <TouchableOpacity
                style={[styles.refundButton, { backgroundColor: '#1e40af20' }]}
                onPress={() => generateReceiptPdf(selectedTransaction.id)}
                disabled={generatingPdf}
              >
                {generatingPdf ? (
                  <ActivityIndicator size="small" color="#1e40af" />
                ) : (
                  <>
                    <Ionicons name="document-text-outline" size={20} color="#1e40af" />
                    <Text style={[styles.refundButtonText, { color: '#1e40af' }]}>
                      Générer reçu PDF
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowDetails(false)}
              >
                <Text style={styles.closeButtonText}>Fermer</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  const FilterModal = () => (
    <Modal visible={showFilters} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.filterModalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Filtres</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.filterLabel, { color: colors.text }]}>Statut</Text>
          <View style={styles.statusFilters}>
            {(['all', 'completed', 'pending', 'failed', 'refunded'] as FilterStatus[]).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterButton,
                  selectedStatus === status && { backgroundColor: getStatusColor(status) }
                ]}
                onPress={() => setSelectedStatus(status)}
              >
                <Text style={[
                  styles.filterButtonText,
                  { color: selectedStatus === status ? '#fff' : colors.text }
                ]}>
                  {status === 'all' ? 'Tous' : getStatusText(status)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.filterLabel, { color: colors.text }]}>Période</Text>
          <View style={styles.periodFilters}>
            {(['today', 'week', 'month'] as FilterPeriod[]).map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.filterButton,
                  selectedPeriod === period && { backgroundColor: colors.primary }
                ]}
                onPress={() => setSelectedPeriod(period)}
              >
                <Text style={[
                  styles.filterButtonText,
                  { color: selectedPeriod === period ? '#fff' : colors.text }
                ]}>
                  {period === 'today' ? 'Aujourd\'hui' : period === 'week' ? 'Cette semaine' : 'Ce mois'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.resetButton, { borderColor: colors.border }]}
              onPress={() => {
                setSelectedStatus('all');
                setSelectedPeriod('week');
                setSearchQuery('');
                setShowFilters(false);
              }}
            >
              <Text style={[styles.resetButtonText, { color: colors.text }]}>Réinitialiser</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyButtonText}>Appliquer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Statistiques
  const stats = {
    total: transactions.reduce((sum, t) => sum + t.amount, 0),
    count: transactions.length,
    completed: transactions.filter(t => t.status === 'completed').length,
    pending: transactions.filter(t => t.status === 'pending').length,
  };

  if (loading && transactions.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Transactions</Text>
        <TouchableOpacity onPress={() => setShowFilters(true)} style={styles.filterButton}>
          <Ionicons name="options-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={[styles.statsBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>{stats.count}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Transactions</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(stats.total)}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.success }]}>{stats.completed}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Réussies</Text>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Rechercher un client..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Active Filters */}
      {(selectedStatus !== 'all' || selectedPeriod !== 'week') && (
        <View style={styles.activeFilters}>
          <Text style={[styles.activeFiltersText, { color: colors.textSecondary }]}>Filtres actifs:</Text>
          {selectedStatus !== 'all' && (
            <View style={[styles.filterChip, { backgroundColor: `${getStatusColor(selectedStatus)}20` }]}>
              <Text style={[styles.filterChipText, { color: getStatusColor(selectedStatus) }]}>
                {getStatusText(selectedStatus)}
              </Text>
            </View>
          )}
          {selectedPeriod !== 'week' && (
            <View style={[styles.filterChip, { backgroundColor: `${colors.primary}20` }]}>
              <Text style={[styles.filterChipText, { color: colors.primary }]}>
                {selectedPeriod === 'today' ? 'Aujourd\'hui' : 'Ce mois'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* List */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransactionCard}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={transactions.length === 0 ? styles.emptyList : styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={60} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucune transaction</Text>
          </View>
        )}
      />

      <FilterModal />
      <TransactionDetailsModal />
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
  filterButton: { padding: 8 },
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  activeFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  activeFiltersText: { fontSize: 12 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 },
  filterChipText: { fontSize: 11, fontWeight: '500' },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  emptyList: { flex: 1 },
  transactionCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: 'bold' },
  customerName: { fontSize: 16, fontWeight: '600' },
  transactionRef: { fontSize: 11, marginTop: 2 },
  amountContainer: { alignItems: 'flex-end', gap: 6 },
  amount: { fontSize: 18, fontWeight: 'bold' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  statusText: { fontSize: 11, fontWeight: '500' },
  cardFooter: { flexDirection: 'row', gap: 16 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  filterModalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  filterLabel: { fontSize: 14, fontWeight: '600', marginBottom: 12, marginTop: 16 },
  statusFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  periodFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0F0F0' },
  filterButtonText: { fontSize: 13, fontWeight: '500' },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  resetButton: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  resetButtonText: { fontSize: 15, fontWeight: '500' },
  applyButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  applyButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  detailCard: { borderRadius: 16, padding: 16, marginBottom: 16, gap: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 16, fontWeight: '500' },
  detailStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, gap: 6 },
  detailStatusText: { fontSize: 13, fontWeight: '500' },
  refundButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 8, marginBottom: 16 },
  refundButtonText: { fontSize: 14, fontWeight: '500' },
  closeButton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { fontSize: 16, marginTop: 16 },
});
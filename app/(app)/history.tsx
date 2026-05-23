// app/(app)/history.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import GradientHeader from '../../src/components/GradientHeader';
import { transactionService } from '../../src/services/api';

interface Transaction {
  id: string;
  type: string;
  montant: number;
  statut: string;
  motif: string | null;
  reference: string;
  feeAmount: number;
  totalAmount: number;
  createdAt: string;
  isCredit: boolean;
  sender?: { fullName: string; email: string; telephone: string };
  receiver?: { fullName: string; email: string; telephone: string };
}

export default function History() {
  const router = useRouter();
  const { colors } = useTheme();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const response = await transactionService.getTransactions({ limit: 50 });
      const transactionsData = response?.transactions || [];
      setTransactions(transactionsData);
    } catch (error: any) {
      console.error(
        'Erreur chargement transactions:',
        error?.response?.data || error?.message,
      );
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Aujourd'hui";
    if (days === 1) return 'Hier';
    if (days < 7) return `Il y a ${days} jours`;
    return date.toLocaleDateString('fr-FR');
  };

  const getTransactionTitle = (tx: Transaction) => {
    if (tx.type === 'DEPOSIT') return 'Dépôt MyWallet';
    if (tx.isCredit && tx.sender?.fullName) return `Reçu de ${tx.sender.fullName}`;
    if (!tx.isCredit && tx.receiver?.fullName) return `Envoyé à ${tx.receiver.fullName}`;
    return tx.motif || 'Transaction';
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filterType === 'credit' && !tx.isCredit && tx.type !== 'DEPOSIT') return false;
    if (filterType === 'debit' && (tx.isCredit || tx.type === 'DEPOSIT')) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const title = getTransactionTitle(tx).toLowerCase();
      const ref = tx.reference.toLowerCase();
      return title.includes(query) || ref.includes(query);
    }
    return true;
  });

  const stats = {
    total: transactions.length,
    credits: transactions.filter(t => t.isCredit || t.type === 'DEPOSIT').reduce((s, t) => s + t.montant, 0),
    debits: transactions.filter(t => !t.isCredit && t.type !== 'DEPOSIT').reduce((s, t) => s + t.montant, 0),
    fees: transactions.reduce((s, t) => s + (t.feeAmount || 0), 0),
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <TouchableOpacity
      style={[styles.transactionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => setSelectedTransaction(item)}
    >
      <View style={styles.transactionLeft}>
        <View
          style={[
            styles.transactionIcon,
            { backgroundColor: item.isCredit || item.type === 'DEPOSIT' ? `${colors.success}20` : `${colors.error}20` },
          ]}
        >
          <Ionicons
            name={item.isCredit || item.type === 'DEPOSIT' ? 'arrow-down' : 'arrow-up'}
            size={20}
            color={item.isCredit || item.type === 'DEPOSIT' ? colors.success : colors.error}
          />
        </View>
        <View>
          <Text style={[styles.transactionTitle, { color: colors.text }]}>{getTransactionTitle(item)}</Text>
          <Text style={[styles.transactionDate, { color: colors.textSecondary }]}>{formatDate(item.createdAt)}</Text>
          <Text style={[styles.transactionRef, { color: colors.textSecondary }]}>Ref: {item.reference.slice(0, 8)}</Text>
        </View>
      </View>
      <View style={styles.transactionRight}>
        <Text
          style={[
            styles.transactionAmount,
            { color: item.isCredit || item.type === 'DEPOSIT' ? colors.success : colors.error },
          ]}
        >
          {item.isCredit || item.type === 'DEPOSIT' ? '+' : '-'}{item.montant.toLocaleString()} Ar
        </Text>
        <View style={[styles.transactionStatus, { backgroundColor: `${colors.success}15` }]}>
          <Text style={[styles.transactionStatusText, { color: colors.success }]}>{item.statut}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader title="Historique" subtitle="Vos transactions récentes" />

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Transactions</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.success }]}>{stats.credits.toLocaleString()} Ar</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Crédits</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.error }]}>{stats.debits.toLocaleString()} Ar</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Débits</Text>
        </View>
      </View>

      {/* Search and Filters */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Rechercher..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterButtons}>
          {(['all', 'credit', 'debit'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                { borderColor: colors.border },
                filterType === filter && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setFilterType(filter)}
            >
              <Text style={[styles.filterText, { color: filterType === filter ? '#fff' : colors.textSecondary }]}>
                {filter === 'all' ? 'Tous' : filter === 'credit' ? 'Crédits' : 'Débits'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Transactions List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucune transaction</Text>
            </View>
          }
        />
      )}

      {/* Transaction Details Modal */}
      <Modal visible={!!selectedTransaction} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Détails de la transaction</Text>
              <TouchableOpacity onPress={() => setSelectedTransaction(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedTransaction && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalDetails}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Type</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {selectedTransaction.type === 'DEPOSIT' ? 'Dépôt' : 'Transfert'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Montant</Text>
                    <Text
                      style={[
                        styles.detailValue,
                        { color: selectedTransaction.isCredit || selectedTransaction.type === 'DEPOSIT' ? colors.success : colors.error, fontWeight: 'bold' },
                      ]}
                    >
                      {selectedTransaction.isCredit || selectedTransaction.type === 'DEPOSIT' ? '+' : '-'}
                      {selectedTransaction.montant.toLocaleString()} Ar
                    </Text>
                  </View>
                  {selectedTransaction.feeAmount > 0 && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Frais</Text>
                      <Text style={[styles.detailValue, { color: colors.warning }]}>{selectedTransaction.feeAmount.toLocaleString()} Ar</Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Statut</Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${colors.success}15` }]}>
                      <Text style={[styles.statusBadgeText, { color: colors.success }]}>{selectedTransaction.statut}</Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {new Date(selectedTransaction.createdAt).toLocaleString('fr-FR')}
                    </Text>
                  </View>
                  {selectedTransaction.motif && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Motif</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{selectedTransaction.motif}</Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Référence</Text>
                    <Text style={[styles.detailValue, { color: colors.text, fontFamily: 'monospace' }]}>
                      {selectedTransaction.reference}
                    </Text>
                  </View>
                  {selectedTransaction.sender && (
                    <View style={styles.personInfo}>
                      <Text style={[styles.personLabel, { color: colors.textSecondary }]}>Expéditeur</Text>
                      <Text style={[styles.personName, { color: colors.text }]}>{selectedTransaction.sender.fullName}</Text>
                      <Text style={[styles.personContact, { color: colors.textSecondary }]}>
                        {selectedTransaction.sender.email || selectedTransaction.sender.telephone}
                      </Text>
                    </View>
                  )}
                  {selectedTransaction.receiver && (
                    <View style={styles.personInfo}>
                      <Text style={[styles.personLabel, { color: colors.textSecondary }]}>Destinataire</Text>
                      <Text style={[styles.personName, { color: colors.text }]}>{selectedTransaction.receiver.fullName}</Text>
                      <Text style={[styles.personContact, { color: colors.textSecondary }]}>
                        {selectedTransaction.receiver.email || selectedTransaction.receiver.telephone}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  transactionDate: {
    fontSize: 11,
    marginTop: 2,
  },
  transactionRef: {
    fontSize: 10,
    marginTop: 1,
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  transactionStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  transactionStatusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalDetails: {
    padding: 20,
    gap: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  personInfo: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 4,
  },
  personLabel: {
    fontSize: 12,
  },
  personName: {
    fontSize: 15,
    fontWeight: '600',
  },
  personContact: {
    fontSize: 12,
  },
});
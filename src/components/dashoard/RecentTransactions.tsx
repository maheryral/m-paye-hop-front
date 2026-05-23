// src/components/RecentTransactions.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { transactionService } from '../../services/api';

interface Transaction {
  id: string;
  title: string;
  date: string;
  amount: number;
  type: 'credit' | 'debit';
}

const RecentTransactions: React.FC = () => {
  const router = useRouter();
  const { colors } = useTheme();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const response = await transactionService.getTransactions({ limit: 5 });
      const data = response?.transactions || [];
      setTransactions(formatTransactions(data));
    } catch (error) {
      console.error('Erreur:', error);
      setTransactions(getMockTransactions());
    } finally {
      setLoading(false);
    }
  };

  const formatTransactions = (data: any[]): Transaction[] => {
    return data.map(tx => ({
      id: tx.id,
      title: tx.motif || (tx.isCredit ? 'Argent reçu' : 'Argent envoyé'),
      date: new Date(tx.createdAt).toLocaleDateString('fr-FR'),
      amount: Math.abs(tx.montant || tx.amount || 0),
      type: tx.isCredit || tx.type === 'DEPOSIT' ? 'credit' : 'debit',
    }));
  };

  const getMockTransactions = (): Transaction[] => [
    { id: '1', title: 'Reçu de Jean Dupont', date: "Aujourd'hui", amount: 25000, type: 'credit' },
    { id: '2', title: 'Envoyé à Marie Claire', date: 'Hier', amount: 15000, type: 'debit' },
    { id: '3', title: 'Dépôt MyWallet', date: '25/03/2024', amount: 50000, type: 'credit' },
  ];

  const renderItem = ({ item }: { item: Transaction }) => (
    <View style={[styles.transactionItem, { borderBottomColor: colors.border }]}>
      <View style={[styles.iconWrapper, { backgroundColor: item.type === 'credit' ? `${colors.success}20` : `${colors.error}20` }]}>
        <Ionicons name={item.type === 'credit' ? 'arrow-down' : 'arrow-up'} size={16} color={item.type === 'credit' ? colors.success : colors.error} />
      </View>
      <View style={styles.transactionInfo}>
        <Text style={[styles.transactionTitle, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.transactionDate, { color: colors.textSecondary }]}>{item.date}</Text>
      </View>
      <Text style={[styles.transactionAmount, { color: item.type === 'credit' ? colors.success : colors.error }]}>
        {item.type === 'credit' ? '+' : '-'}{item.amount.toLocaleString()} Ar
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Transactions récentes</Text>
        <TouchableOpacity onPress={() => router.push('/history' as any)}>
          <Text style={[styles.viewAll, { color: colors.primary }]}>Voir tout</Text>
        </TouchableOpacity>
      </View>
      <FlatList data={transactions} keyExtractor={item => item.id} renderItem={renderItem} scrollEnabled={false} />
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  viewAll: {
    fontSize: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  transactionDate: {
    fontSize: 11,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default RecentTransactions;
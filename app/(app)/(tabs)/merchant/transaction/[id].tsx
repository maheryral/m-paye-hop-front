// app/(app)/(tabs)/merchant/transaction/[id].tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../../../../src/contexts/ThemeContext';
import { merchantApi, Transaction } from '../../../../../src/services/merchantApi';
import { SkeletonLoader } from '../../../../../src/components/merchant/LoadingSpinner';
import { EmptyState } from '../../../../../src/components/merchant/EmptyState';

export default function TransactionDetail() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    fetchTransaction();
  }, [id]);

  const fetchTransaction = async () => {
    try {
      const response = await merchantApi.getTransactionDetails(id);
      setTransaction(response.data);
    } catch (error) {
      console.error('Error fetching transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = () => {
    Alert.alert(
      'Remboursement',
      `Voulez-vous rembourser ${formatCurrency(transaction?.amount || 0)} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Rembourser',
          style: 'destructive',
          onPress: async () => {
            setRefunding(true);
            try {
              await merchantApi.createRefund(id, transaction!.amount, 'Remboursement demandé par le client');
              Alert.alert('Succès', 'Remboursement effectué');
              fetchTransaction();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de rembourser');
            } finally {
              setRefunding(false);
            }
          },
        },
      ]
    );
  };

  const handleShareReceipt = async () => {
    try {
      await Share.share({
        title: 'Reçu de paiement',
        message: `Paiement de ${formatCurrency(transaction?.amount || 0)} effectué le ${new Date(transaction?.createdAt || '').toLocaleDateString('fr-FR')}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-MG', { style: 'currency', currency: 'MGA' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed': return { text: 'Réussi', color: '#52C41A', icon: 'checkmark-circle' };
      case 'pending': return { text: 'En attente', color: '#FAAD14', icon: 'time-outline' };
      case 'failed': return { text: 'Échoué', color: '#FF4D4F', icon: 'close-circle' };
      case 'refunded': return { text: 'Remboursé', color: '#999', icon: 'refresh-circle' };
      default: return { text: status, color: '#666', icon: 'help-circle' };
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SkeletonLoader type="card" count={3} />
      </View>
    );
  }

  if (!transaction) {
    return <EmptyState title="Transaction non trouvée" message="Cette transaction n'existe pas" icon="alert-circle-outline" />;
  }

  const statusConfig = getStatusConfig(transaction.status);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      {/* Status Header */}
      <View style={[styles.statusHeader, { backgroundColor: statusConfig.color + '10' }]}>
        <Ionicons name={statusConfig.icon as any} size={48} color={statusConfig.color} />
        <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.text}</Text>
        <Text style={[styles.transactionId, { color: colors.textSecondary }]}>ID: {transaction.transactionId}</Text>
      </View>

      {/* Montant */}
      <View style={[styles.amountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Montant</Text>
        <Text style={[styles.amountValue, { color: colors.text }]}>{formatCurrency(transaction.amount)}</Text>
      </View>

      {/* Informations client */}
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Client</Text>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.text }]}>{transaction.customerName || 'Client anonyme'}</Text>
        </View>
        {transaction.customerPhone && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>{transaction.customerPhone}</Text>
          </View>
        )}
        {transaction.customerEmail && (
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>{transaction.customerEmail}</Text>
          </View>
        )}
      </View>

      {/* Détails paiement */}
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Détails du paiement</Text>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.text }]}>{formatDate(transaction.createdAt)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="card-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.text }]}>{transaction.paymentMethod}</Text>
        </View>
        {transaction.storeName && (
          <View style={styles.infoRow}>
            <Ionicons name="storefront-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>{transaction.storeName}</Text>
          </View>
        )}
      </View>

      {/* Articles */}
      {transaction.items && transaction.items.length > 0 && (
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Articles</Text>
          {transaction.items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.itemQuantity, { color: colors.textSecondary }]}>x{item.quantity}</Text>
              <Text style={[styles.itemPrice, { color: colors.text }]}>{formatCurrency(item.price * item.quantity)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary + '15' }]} onPress={handleShareReceipt}>
          <Ionicons name="share-outline" size={20} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>Partager le reçu</Text>
        </TouchableOpacity>

        {transaction.status === 'completed' && (
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#FF4D4F15' }]} onPress={handleRefund} disabled={refunding}>
            {refunding ? <ActivityIndicator size="small" color="#FF4D4F" /> : <Ionicons name="refresh-outline" size={20} color="#FF4D4F" />}
            <Text style={[styles.actionText, { color: '#FF4D4F' }]}>Rembourser</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statusHeader: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  statusText: { fontSize: 18, fontWeight: 'bold' },
  transactionId: { fontSize: 12 },
  amountCard: { margin: 16, padding: 20, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  amountLabel: { fontSize: 14, marginBottom: 8 },
  amountValue: { fontSize: 32, fontWeight: 'bold' },
  infoCard: { marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { fontSize: 14, flex: 1 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  itemName: { fontSize: 14, flex: 2 },
  itemQuantity: { fontSize: 12, width: 40, textAlign: 'center' },
  itemPrice: { fontSize: 14, fontWeight: '500', width: 80, textAlign: 'right' },
  actionsContainer: { flexDirection: 'row', gap: 12, margin: 16, marginBottom: 32 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 },
  actionText: { fontSize: 14, fontWeight: '500' },
});
// src/components/merchant/MerchantTransactionCard.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableNativeFeedback,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { Transaction as ApiTransaction } from '../../services/merchantApi';

// Définir les types possibles pour paymentMethod selon votre API
type PaymentMethod = 'card' | 'cash' | 'alipay' | 'wechat' | 'bank' | string;

interface MerchantTransactionCardProps {
  transaction: ApiTransaction;
  onPress?: (transaction: ApiTransaction) => void;
  showActions?: boolean;
  showStore?: boolean; // Ajout de la propriété showStore
  storeName?: string; // Optionnel: nom du magasin
  onRefund?: (transaction: ApiTransaction) => void;
  onReceipt?: (transaction: ApiTransaction) => void;
}

const MerchantTransactionCard: React.FC<MerchantTransactionCardProps> = ({
  transaction,
  onPress,
  showActions = false,
  showStore = false, // Valeur par défaut
  storeName,
  onRefund,
  onReceipt,
}) => {
  const { colors } = useTheme();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-MG', {
      style: 'currency',
      currency: 'MGA',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      return 'À l\'instant';
    } else if (diffHours < 24) {
      return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
    } else {
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#3b82f6';
      case 'pending':
        return '#f59e0b';
      case 'failed':
        return '#ef4444';
      case 'refunded':
        return '#8b5cf6';
      default:
        return '#94a3b8';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Réussi';
      case 'pending':
        return 'En attente';
      case 'failed':
        return 'Échoué';
      case 'refunded':
        return 'Remboursé';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return 'checkmark-circle';
      case 'pending':
        return 'time';
      case 'failed':
        return 'alert-circle';
      case 'refunded':
        return 'refresh';
      default:
        return 'help-circle';
    }
  };

  const getPaymentMethodIcon = (method?: PaymentMethod) => {
    switch (method) {
      case 'mobile_money':
      case 'alipay':
      case 'wechat':
        return 'phone-portrait-outline';
      case 'card':
      case 'bank':
        return 'card-outline';
      case 'qr_code':
        return 'qr-code-outline';
      case 'cash':
        return 'cash-outline';
      default:
        return 'cash-outline';
    }
  };

  const getPaymentMethodText = (method?: PaymentMethod) => {
    switch (method) {
      case 'mobile_money':
        return 'Mobile Money';
      case 'card':
        return 'Carte bancaire';
      case 'cash':
        return 'Espèces';
      case 'alipay':
        return 'Alipay';
      case 'wechat':
        return 'WeChat Pay';
      case 'bank':
        return 'Virement bancaire';
      case 'qr_code':
        return 'QR Code';
      default:
        return method || 'Paiement';
    }
  };

  // Fonction pour obtenir le nom du client
  const getCustomerName = () => {
    const anyTransaction = transaction as any;
    if (transaction.customerName) {
      return transaction.customerName;
    }
    if (anyTransaction.clientName) {
      return anyTransaction.clientName;
    }
    if (anyTransaction.userName) {
      return anyTransaction.userName;
    }
    if (anyTransaction.payerName) {
      return anyTransaction.payerName;
    }
    if (anyTransaction.senderName) {
      return anyTransaction.senderName;
    }
    return 'Client anonyme';
  };

  // Fonction pour obtenir l'initiale du client
  const getCustomerInitial = () => {
    const name = getCustomerName();
    return name.charAt(0).toUpperCase();
  };

  // Fonction pour obtenir la référence de transaction
  const getTransactionReference = () => {
    const anyTransaction = transaction as any;
    if (anyTransaction.reference) {
      return anyTransaction.reference;
    }
    if (anyTransaction.transactionId) {
      return anyTransaction.transactionId;
    }
    if (anyTransaction.txnId) {
      return anyTransaction.txnId;
    }
    if (anyTransaction.orderId) {
      return anyTransaction.orderId;
    }
    if (anyTransaction.ref) {
      return anyTransaction.ref;
    }
    // Si aucune référence n'est trouvée, retourner un ID tronqué
    if (transaction.id) {
      return transaction.id.slice(-8);
    }
    return null;
  };

  const transactionReference = getTransactionReference();

  const TouchableComponent = Platform.OS === 'android' && Platform.Version >= 21
    ? TouchableNativeFeedback
    : TouchableOpacity;

  const cardContent = (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* En-tête avec info client et montant */}
      <View style={styles.header}>
        <View style={styles.customerInfo}>
          <View style={[styles.customerAvatar, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.customerInitial, { color: colors.primary }]}>
              {getCustomerInitial()}
            </Text>
          </View>
          <View>
            <Text style={[styles.customerName, { color: colors.text }]}>
              {getCustomerName()}
            </Text>
            {transaction.customerPhone && (
              <Text style={[styles.customerPhone, { color: colors.textSecondary }]}>
                {transaction.customerPhone}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.amountContainer}>
          <Text style={[styles.amount, { color: colors.success }]}>
            +{formatCurrency(transaction.amount)}
          </Text>
        </View>
      </View>

      {/* Détails de la transaction */}
      <View style={styles.details}>
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {formatDate(transaction.createdAt)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons 
              name={getPaymentMethodIcon(transaction.paymentMethod)} 
              size={14} 
              color={colors.textSecondary} 
            />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {getPaymentMethodText(transaction.paymentMethod)}
            </Text>
          </View>
        </View>

        {/* Affichage du nom du magasin si showStore est true */}
        {showStore && (storeName || (transaction as any).storeName) && (
          <View style={styles.storeContainer}>
            <Ionicons name="storefront-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.storeText, { color: colors.textSecondary }]}>
              {storeName || (transaction as any).storeName}
            </Text>
          </View>
        )}

        {transactionReference && (
          <View style={styles.referenceContainer}>
            <Text style={[styles.referenceLabel, { color: colors.textSecondary }]}>
              Réf:
            </Text>
            <Text style={[styles.referenceValue, { color: colors.textSecondary }]}>
              {transactionReference}
            </Text>
          </View>
        )}

        {/* Statut */}
        <View style={styles.statusContainer}>
          <Ionicons
            name={getStatusIcon(transaction.status)}
            size={16}
            color={getStatusColor(transaction.status)}
          />
          <Text style={[styles.statusText, { color: getStatusColor(transaction.status) }]}>
            {getStatusText(transaction.status)}
          </Text>
        </View>
      </View>

      {/* Actions (si disponibles) */}
      {showActions && transaction.status === 'completed' && (
        <View style={styles.actions}>
          {onRefund && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.error + '10' }]}
              onPress={() => onRefund(transaction)}
            >
              <Ionicons name="refresh-outline" size={18} color={colors.error} />
              <Text style={[styles.actionText, { color: colors.error }]}>Rembourser</Text>
            </TouchableOpacity>
          )}
          {onReceipt && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary + '10' }]}
              onPress={() => onReceipt(transaction)}
            >
              <Ionicons name="print-outline" size={18} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>Reçu</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableComponent onPress={() => onPress(transaction)}>
        {cardContent}
      </TouchableComponent>
    );
  }

  return cardContent;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInitial: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: 12,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  details: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
  },
  storeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  storeText: {
    fontSize: 11,
  },
  referenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  referenceLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  referenceValue: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

export default MerchantTransactionCard;
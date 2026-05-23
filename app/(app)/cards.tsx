// app/(app)/cards.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useWallet } from '../../src/contexts/WalletContext';

interface Method {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  fees: string;
  min: number;
  max: number;
  processingTime: string;
}

export default function DepositWithdraw() {
  const router = useRouter();
  const { colors } = useTheme();
  const { balance, fetchBalance } = useWallet();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [step, setStep] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [transactionId, setTransactionId] = useState('');

  const depositMethods: Method[] = [
    { id: 'card', name: 'Carte bancaire', icon: 'card-outline', color: '#3b82f6', fees: '0%', min: 1000, max: 5000000, processingTime: 'Instantané' },
    { id: 'mobile', name: 'Mobile Money', icon: 'phone-portrait-outline', color: '#3b82f6', fees: '1%', min: 500, max: 2000000, processingTime: 'Instantané' },
    { id: 'bank', name: 'Virement bancaire', icon: 'business-outline', color: '#8b5cf6', fees: '0.5%', min: 10000, max: 10000000, processingTime: '24-48h' },
  ];

  const withdrawMethods: Method[] = [
    { id: 'mobile', name: 'Mobile Money', icon: 'phone-portrait-outline', color: '#ef4444', fees: '1.5%', min: 1000, max: 1500000, processingTime: 'Instantané' },
    { id: 'bank', name: 'Virement bancaire', icon: 'business-outline', color: '#8b5cf6', fees: '1%', min: 5000, max: 5000000, processingTime: '24-48h' },
  ];

  const currentMethods = activeTab === 'deposit' ? depositMethods : withdrawMethods;
  const selectedMethodData = currentMethods.find(m => m.id === selectedMethod);
  const amountNum = parseFloat(amount) || 0;
  const feeAmount = amountNum * (parseFloat(selectedMethodData?.fees || '0') / 100);
  const totalAmount = activeTab === 'deposit' ? amountNum - feeAmount : amountNum + feeAmount;

  const handleMethodSelect = (methodId: string) => {
    setSelectedMethod(methodId);
    setStep(2);
  };

  const handleAmountSubmit = () => {
    if (!amount || amountNum <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un montant valide');
      return;
    }
    if (selectedMethodData && amountNum < selectedMethodData.min) {
      Alert.alert('Erreur', `Montant minimum: ${selectedMethodData.min.toLocaleString()} Ar`);
      return;
    }
    if (selectedMethodData && amountNum > selectedMethodData.max) {
      Alert.alert('Erreur', `Montant maximum: ${selectedMethodData.max.toLocaleString()} Ar`);
      return;
    }
    if (activeTab === 'withdraw' && amountNum > balance) {
      Alert.alert('Erreur', `Solde insuffisant. Solde: ${balance.toLocaleString()} Ar`);
      return;
    }
    setStep(3);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setTimeout(async () => {
      const newId = (activeTab === 'deposit' ? 'DEP-' : 'WDR-') + Math.random().toString(36).substr(2, 8).toUpperCase();
      setTransactionId(newId);
      await fetchBalance();
      setLoading(false);
      setSuccess(true);
    }, 2000);
  };

  const handleNewTransaction = () => {
    setStep(1);
    setSelectedMethod(null);
    setAmount('');
    setSuccess(false);
    setTransactionId('');
  };

  if (success) {
    return (
      <View style={[styles.successContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.successCard, { backgroundColor: colors.card }]}>
          <View style={[styles.successIcon, { backgroundColor: `${colors.success}20` }]}>
            <Ionicons name="checkmark-circle" size={60} color={colors.success} />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>
            {activeTab === 'deposit' ? 'Dépôt réussi !' : 'Retrait effectué !'}
          </Text>
          <Text style={[styles.successAmount, { color: colors.success }]}>
            {amountNum.toLocaleString()} Ar
          </Text>
          <View style={[styles.transactionIdContainer, { backgroundColor: colors.background }]}>
            <Text style={[styles.transactionIdLabel, { color: colors.textSecondary }]}>ID Transaction</Text>
            <Text style={[styles.transactionId, { color: colors.text }]}>{transactionId}</Text>
          </View>
          <View style={styles.successButtons}>
            <TouchableOpacity
              style={[styles.successButton, { backgroundColor: colors.primary }]}
              onPress={handleNewTransaction}
            >
              <Ionicons name="refresh-outline" size={20} color="#fff" />
              <Text style={styles.successButtonText}>Nouvelle opération</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.successButton, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => router.push('/history' as any)}
            >
              <Ionicons name="time-outline" size={20} color={colors.text} />
              <Text style={[styles.successButtonText, { color: colors.text }]}>Voir historique</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Dépôt & Retrait</Text>
          <TouchableOpacity onPress={() => router.push('/history' as any)}>
            <Ionicons name="time-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.balanceLabel}>Solde disponible</Text>
          <Text style={styles.balanceAmount}>{balance.toLocaleString()} Ar</Text>
        </View>

        {/* Tabs */}
        <View style={[styles.tabsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'deposit' && styles.activeTab, activeTab === 'deposit' && { backgroundColor: colors.primary }]}
            onPress={() => {
              setActiveTab('deposit');
              setStep(1);
              setSelectedMethod(null);
              setAmount('');
            }}
          >
            <Ionicons name="arrow-down-outline" size={18} color={activeTab === 'deposit' ? '#fff' : colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'deposit' && { color: '#fff' }]}>Dépôt</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'withdraw' && styles.activeTab, activeTab === 'withdraw' && { backgroundColor: colors.error }]}
            onPress={() => {
              setActiveTab('withdraw');
              setStep(1);
              setSelectedMethod(null);
              setAmount('');
            }}
          >
            <Ionicons name="arrow-up-outline" size={18} color={activeTab === 'withdraw' ? '#fff' : colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'withdraw' && { color: '#fff' }]}>Retrait</Text>
          </TouchableOpacity>
        </View>

        {step === 1 && (
          <View style={styles.methodsContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Choisissez votre méthode de {activeTab === 'deposit' ? 'dépôt' : 'retrait'}
            </Text>
            {currentMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[styles.methodCard, { backgroundColor: `${method.color}20`, borderColor: method.color }]}
                onPress={() => handleMethodSelect(method.id)}
              >
                <View style={styles.methodHeader}>
                  <View style={[styles.methodIcon, { backgroundColor: method.color }]}>
                    <Ionicons name={method.icon} size={24} color="#fff" />
                  </View>
                  <View style={styles.methodInfo}>
                    <Text style={[styles.methodName, { color: colors.text }]}>{method.name}</Text>
                    <Text style={[styles.methodDescription, { color: colors.textSecondary }]}>
                      Frais: {method.fees} | {method.min.toLocaleString()} - {method.max.toLocaleString()} Ar
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 2 && selectedMethodData && (
          <View style={styles.amountContainer}>
            <TouchableOpacity onPress={() => setStep(1)} style={styles.backStepButton}>
              <Ionicons name="arrow-back" size={18} color={colors.primary} />
              <Text style={[styles.backStepText, { color: colors.primary }]}>Retour</Text>
            </TouchableOpacity>

            <View style={[styles.amountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Montant</Text>
              <TextInput
                style={[styles.amountInput, { color: colors.text }]}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
              <Text style={[styles.limitText, { color: colors.textSecondary }]}>
                Min: {selectedMethodData.min.toLocaleString()} Ar | Max: {selectedMethodData.max.toLocaleString()} Ar
              </Text>

              {amount && amountNum > 0 && (
                <View style={[styles.feesPreview, { borderTopColor: colors.border }]}>
                  <View style={styles.feesRow}>
                    <Text style={[styles.feesLabel, { color: colors.textSecondary }]}>Montant</Text>
                    <Text style={[styles.feesValue, { color: colors.text }]}>{amountNum.toLocaleString()} Ar</Text>
                  </View>
                  <View style={styles.feesRow}>
                    <Text style={[styles.feesLabel, { color: colors.textSecondary }]}>Frais ({selectedMethodData.fees})</Text>
                    <Text style={[styles.feesValue, { color: colors.warning }]}>{feeAmount.toLocaleString()} Ar</Text>
                  </View>
                  <View style={styles.feesDivider} />
                  <View style={styles.feesRow}>
                    <Text style={[styles.feesLabel, { fontWeight: '600', color: colors.text }]}>Total à {activeTab === 'deposit' ? 'payer' : 'débiter'}</Text>
                    <Text style={[styles.feesValue, { fontWeight: '700', color: colors.primary }]}>{totalAmount.toLocaleString()} Ar</Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.continueButton, { backgroundColor: activeTab === 'deposit' ? colors.primary : colors.error }]}
                onPress={handleAmountSubmit}
              >
                <Text style={styles.continueButtonText}>Continuer</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 3 && selectedMethodData && (
          <View style={styles.confirmContainer}>
            <TouchableOpacity onPress={() => setStep(2)} style={styles.backStepButton}>
              <Ionicons name="arrow-back" size={18} color={colors.primary} />
              <Text style={[styles.backStepText, { color: colors.primary }]}>Retour</Text>
            </TouchableOpacity>

            <View style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.confirmTitle, { color: colors.text }]}>
                Confirmation du {activeTab === 'deposit' ? 'dépôt' : 'retrait'}
              </Text>

              <View style={styles.confirmDetails}>
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>Opération</Text>
                  <Text style={[styles.confirmValue, { color: activeTab === 'deposit' ? colors.primary : colors.error }]}>
                    {activeTab === 'deposit' ? 'Dépôt' : 'Retrait'}
                  </Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>Méthode</Text>
                  <Text style={[styles.confirmValue, { color: colors.text }]}>{selectedMethodData.name}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>Montant</Text>
                  <Text style={[styles.confirmValue, { color: colors.text, fontWeight: '700' }]}>{amountNum.toLocaleString()} Ar</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>Frais</Text>
                  <Text style={[styles.confirmValue, { color: colors.warning }]}>{feeAmount.toLocaleString()} Ar</Text>
                </View>
                <View style={styles.confirmDivider} />
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: colors.text }]}>Total</Text>
                  <Text style={[styles.confirmValue, { color: colors.primary, fontWeight: '700', fontSize: 16 }]}>{totalAmount.toLocaleString()} Ar</Text>
                </View>
              </View>

              <View style={[styles.securityInfo, { backgroundColor: `${colors.info}15`, borderColor: colors.info }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.info} />
                <Text style={[styles.securityText, { color: colors.textSecondary }]}>
                  Transaction sécurisée. Délai: {selectedMethodData.processingTime}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: activeTab === 'deposit' ? colors.success : colors.error }]}
                onPress={handleConfirm}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name={activeTab === 'deposit' ? 'arrow-down-outline' : 'arrow-up-outline'} size={20} color="#fff" />
                    <Text style={styles.confirmButtonText}>
                      Confirmer le {activeTab === 'deposit' ? 'dépôt' : 'retrait'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
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
  balanceCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  balanceLabel: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 8,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  methodsContainer: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  methodCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '600',
  },
  methodDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  amountContainer: {
    gap: 16,
  },
  backStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
  },
  backStepText: {
    fontSize: 14,
  },
  amountCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    gap: 16,
  },
  amountLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  amountInput: {
    fontSize: 32,
    fontWeight: 'bold',
    paddingVertical: 8,
  },
  limitText: {
    fontSize: 12,
  },
  feesPreview: {
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 8,
  },
  feesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  feesLabel: {
    fontSize: 14,
  },
  feesValue: {
    fontSize: 14,
  },
  feesDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmContainer: {
    gap: 16,
  },
  confirmCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    gap: 20,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  confirmDetails: {
    gap: 12,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmLabel: {
    fontSize: 14,
  },
  confirmValue: {
    fontSize: 14,
  },
  confirmDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    gap: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successCard: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  successAmount: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  transactionIdContainer: {
    padding: 12,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  transactionIdLabel: {
    fontSize: 11,
  },
  transactionId: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  successButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  successButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    gap: 8,
  },
  successButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
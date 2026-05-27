// app/(app)/(tabs)/merchant/withdraw.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { merchantApi } from '../../../../src/services/merchantApi';

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isDefault: boolean;
}

interface MobileMoneyAccount {
  id: string;
  operator: 'Orange' | 'Airtel' | 'Telma';
  phoneNumber: string;
  holderName: string;
  isDefault: boolean;
}

type WithdrawMethod = 'bank' | 'mobile_money' | 'cash';

export default function MerchantWithdraw() {
  const { colors } = useTheme();
  
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<WithdrawMethod>('mobile_money');
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);
  const [selectedMobile, setSelectedMobile] = useState<MobileMoneyAccount | null>(null);
  const [showAccounts, setShowAccounts] = useState(false);
  const [showMobileAccounts, setShowMobileAccounts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(150000);
  const [fee, setFee] = useState(0);
  const [netAmount, setNetAmount] = useState(0);

  // Comptes bancaires mockés
  const bankAccounts: BankAccount[] = [
    {
      id: '1',
      bankName: 'BOA Madagascar',
      accountNumber: '1234 5678 9012 3456',
      accountHolder: 'Jean Rakoto',
      isDefault: true,
    },
    {
      id: '2',
      bankName: 'BNI Madagascar',
      accountNumber: '9876 5432 1098 7654',
      accountHolder: 'Jean Rakoto',
      isDefault: false,
    },
  ];

  // Comptes Mobile Money mockés
  const mobileMoneyAccounts: MobileMoneyAccount[] = [
    {
      id: '1',
      operator: 'Orange',
      phoneNumber: '+261 32 12 345 67',
      holderName: 'Jean Rakoto',
      isDefault: true,
    },
    {
      id: '2',
      operator: 'Airtel',
      phoneNumber: '+261 33 98 765 43',
      holderName: 'Jean Rakoto',
      isDefault: false,
    },
    {
      id: '3',
      operator: 'Telma',
      phoneNumber: '+261 34 55 55 55',
      holderName: 'Jean Rakoto',
      isDefault: false,
    },
  ];

  const minAmount = 5000;
  const maxAmount = 5000000;

  // Calcul des frais selon la méthode
  const calculateFee = (amountNum: number, method: WithdrawMethod) => {
    switch (method) {
      case 'bank':
        return amountNum * 0.005; // 0.5% pour virement bancaire
      case 'mobile_money':
        return amountNum * 0.01; // 1% pour mobile money
      case 'cash':
        return 0; // 0% pour retrait cash (gratuit)
      default:
        return 0;
    }
  };

  useEffect(() => {
    // Sélectionner le compte par défaut
    const defaultBank = bankAccounts.find(acc => acc.isDefault);
    if (defaultBank) setSelectedBank(defaultBank);

    const defaultMobile = mobileMoneyAccounts.find(acc => acc.isDefault);
    if (defaultMobile) setSelectedMobile(defaultMobile);

    // Charger le solde disponible
    (async () => {
      try {
        const response = await merchantApi.getBalance();
        const b = response.data || ({} as any);
        if (typeof b.balance === 'number') setBalance(b.balance);
      } catch (error: any) {
        Alert.alert('Erreur', error?.response?.data?.message || 'Impossible de récupérer le solde');
      }
    })();
  }, []);

  useEffect(() => {
    const amountNum = parseFloat(amount) || 0;
    const calculatedFee = calculateFee(amountNum, selectedMethod);
    setFee(calculatedFee);
    setNetAmount(amountNum - calculatedFee);
  }, [amount, selectedMethod]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-MG', {
      style: 'currency',
      currency: 'MGA',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getOperatorIcon = (operator: string) => {
    switch (operator) {
      case 'Orange': return 'phone-portrait-outline';
      case 'Airtel': return 'phone-portrait-outline';
      case 'Telma': return 'phone-portrait-outline';
      default: return 'phone-portrait-outline';
    }
  };

  const getOperatorColor = (operator: string) => {
    switch (operator) {
      case 'Orange': return '#f97316';
      case 'Airtel': return '#ef4444';
      case 'Telma': return '#06b6d4';
      default: return colors.primary;
    }
  };

  const amountNum = parseFloat(amount) || 0;
  const hasEnoughBalance = amountNum <= balance;
  const isAmountValid = amountNum >= minAmount && amountNum <= maxAmount;
  
  const canWithdraw = (selectedMethod === 'bank' && selectedBank) ||
                      (selectedMethod === 'mobile_money' && selectedMobile) ||
                      (selectedMethod === 'cash');
                      
  const canSubmit = canWithdraw && amount && isAmountValid && hasEnoughBalance && !loading;

  const handleWithdraw = () => {
    let destination = '';
    if (selectedMethod === 'bank' && selectedBank) {
      destination = `${selectedBank.bankName} - ${selectedBank.accountNumber.slice(-4)}`;
    } else if (selectedMethod === 'mobile_money' && selectedMobile) {
      destination = `${selectedMobile.operator} - ${selectedMobile.phoneNumber}`;
    } else if (selectedMethod === 'cash') {
      destination = 'Retrait en espèces au point de retrait';
    }

    Alert.alert(
      'Confirmation de retrait',
      `Méthode: ${getMethodLabel()}\nMontant: ${formatCurrency(amountNum)}\nFrais: ${formatCurrency(fee)}\nNet à recevoir: ${formatCurrency(netAmount)}\n${destination ? `\nDestination: ${destination}` : ''}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setLoading(true);
            try {
              const bankAccountId =
                selectedMethod === 'bank' && selectedBank
                  ? selectedBank.id
                  : selectedMethod === 'mobile_money' && selectedMobile
                  ? selectedMobile.id
                  : 'cash';
              await merchantApi.withdraw(amountNum, bankAccountId);
              Alert.alert(
                'Succès',
                `Votre demande de retrait a été enregistrée.\n${selectedMethod === 'cash' ? 'Rendez-vous au point de retrait avec votre pièce d\'identité.' : 'Le traitement peut prendre 24-48h.'}`,
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (error: any) {
              Alert.alert('Erreur', error?.response?.data?.message || 'Une erreur est survenue');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const getMethodLabel = () => {
    switch (selectedMethod) {
      case 'bank': return 'Virement bancaire';
      case 'mobile_money': return 'Mobile Money';
      case 'cash': return 'Retrait cash';
      default: return '';
    }
  };

  const handleQuickAmount = (value: number) => {
    setAmount(value.toString());
  };

  // Modal pour les comptes bancaires
  const BankAccountModal = () => (
    <Modal
      visible={showAccounts}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowAccounts(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Comptes bancaires</Text>
            <TouchableOpacity onPress={() => setShowAccounts(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {bankAccounts.map((account) => (
              <TouchableOpacity
                key={account.id}
                style={[
                  styles.accountItem,
                  { borderBottomColor: colors.border },
                  selectedBank?.id === account.id && { backgroundColor: `${colors.primary}10` }
                ]}
                onPress={() => {
                  setSelectedBank(account);
                  setShowAccounts(false);
                }}
              >
                <View style={styles.accountInfo}>
                  <View style={[styles.accountIcon, { backgroundColor: `${colors.primary}20` }]}>
                    <Ionicons name="business-outline" size={20} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.accountBank, { color: colors.text }]}>{account.bankName}</Text>
                    <Text style={[styles.accountNumber, { color: colors.textSecondary }]}>
                      {account.accountNumber.slice(-4)}
                    </Text>
                    <Text style={[styles.accountHolder, { color: colors.textSecondary }]}>
                      {account.accountHolder}
                    </Text>
                  </View>
                </View>
                {selectedBank?.id === account.id && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                )}
                {account.isDefault && (
                  <View style={[styles.defaultBadge, { backgroundColor: `${colors.primary}20` }]}>
                    <Text style={[styles.defaultBadgeText, { color: colors.primary }]}>Défaut</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={[styles.addButton, { borderColor: colors.border }]}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.addButtonText, { color: colors.primary }]}>Ajouter un compte bancaire</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Modal pour les comptes Mobile Money
  const MobileMoneyModal = () => (
    <Modal
      visible={showMobileAccounts}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowMobileAccounts(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Comptes Mobile Money</Text>
            <TouchableOpacity onPress={() => setShowMobileAccounts(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {mobileMoneyAccounts.map((account) => (
              <TouchableOpacity
                key={account.id}
                style={[
                  styles.accountItem,
                  { borderBottomColor: colors.border },
                  selectedMobile?.id === account.id && { backgroundColor: `${getOperatorColor(account.operator)}10` }
                ]}
                onPress={() => {
                  setSelectedMobile(account);
                  setShowMobileAccounts(false);
                }}
              >
                <View style={styles.accountInfo}>
                  <View style={[styles.accountIcon, { backgroundColor: `${getOperatorColor(account.operator)}20` }]}>
                    <Ionicons name={getOperatorIcon(account.operator) as any} size={20} color={getOperatorColor(account.operator)} />
                  </View>
                  <View>
                    <Text style={[styles.accountBank, { color: colors.text }]}>{account.operator}</Text>
                    <Text style={[styles.accountNumber, { color: colors.textSecondary }]}>
                      {account.phoneNumber}
                    </Text>
                    <Text style={[styles.accountHolder, { color: colors.textSecondary }]}>
                      {account.holderName}
                    </Text>
                  </View>
                </View>
                {selectedMobile?.id === account.id && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                )}
                {account.isDefault && (
                  <View style={[styles.defaultBadge, { backgroundColor: `${colors.primary}20` }]}>
                    <Text style={[styles.defaultBadgeText, { color: colors.primary }]}>Défaut</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={[styles.addButton, { borderColor: colors.border }]}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.addButtonText, { color: colors.primary }]}>Ajouter un compte Mobile Money</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Retrait d'argent</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Solde disponible */}
      <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Solde disponible</Text>
        <Text style={[styles.balanceValue, { color: colors.text }]}>{formatCurrency(balance)}</Text>
      </View>

      {/* Méthode de retrait */}
      <View style={styles.methodSection}>
        <Text style={[styles.label, { color: colors.text }]}>Méthode de retrait</Text>
        <View style={styles.methodButtons}>
          <TouchableOpacity
            style={[
              styles.methodButton,
              { backgroundColor: colors.card, borderColor: colors.border },
              selectedMethod === 'mobile_money' && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => setSelectedMethod('mobile_money')}
          >
            <Ionicons 
              name="phone-portrait-outline" 
              size={22} 
              color={selectedMethod === 'mobile_money' ? '#fff' : colors.text} 
            />
            <Text style={[styles.methodText, { color: selectedMethod === 'mobile_money' ? '#fff' : colors.text }]}>
              Mobile Money
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodButton,
              { backgroundColor: colors.card, borderColor: colors.border },
              selectedMethod === 'bank' && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => setSelectedMethod('bank')}
          >
            <Ionicons 
              name="business-outline" 
              size={22} 
              color={selectedMethod === 'bank' ? '#fff' : colors.text} 
            />
            <Text style={[styles.methodText, { color: selectedMethod === 'bank' ? '#fff' : colors.text }]}>
              Virement bancaire
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodButton,
              { backgroundColor: colors.card, borderColor: colors.border },
              selectedMethod === 'cash' && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => setSelectedMethod('cash')}
          >
            <Ionicons 
              name="cash-outline" 
              size={22} 
              color={selectedMethod === 'cash' ? '#fff' : colors.text} 
            />
            <Text style={[styles.methodText, { color: selectedMethod === 'cash' ? '#fff' : colors.text }]}>
              Retrait cash
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Montant */}
      <View style={styles.amountSection}>
        <Text style={[styles.label, { color: colors.text }]}>Montant à retirer (Ar)</Text>
        <View style={[styles.amountInputContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.currencySymbol, { color: colors.textSecondary }]}>Ar</Text>
          <TextInput
            style={[styles.amountInput, { color: colors.text }]}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
        </View>
        
        {amount && !isAmountValid && (
          <Text style={styles.errorText}>
            Montant doit être entre {formatCurrency(minAmount)} et {formatCurrency(maxAmount)}
          </Text>
        )}
        {amount && !hasEnoughBalance && (
          <Text style={styles.errorText}>Solde insuffisant</Text>
        )}

        {/* Montants rapides */}
        <View style={styles.quickAmounts}>
          <TouchableOpacity
            style={[styles.quickAmountBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => handleQuickAmount(10000)}
          >
            <Text style={[styles.quickAmountText, { color: colors.text }]}>10k Ar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickAmountBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => handleQuickAmount(50000)}
          >
            <Text style={[styles.quickAmountText, { color: colors.text }]}>50k Ar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickAmountBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => handleQuickAmount(100000)}
          >
            <Text style={[styles.quickAmountText, { color: colors.text }]}>100k Ar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickAmountBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => handleQuickAmount(500000)}
          >
            <Text style={[styles.quickAmountText, { color: colors.text }]}>500k Ar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Destination selon méthode */}
      {(selectedMethod === 'bank' || selectedMethod === 'mobile_money') && (
        <View style={styles.accountSection}>
          <Text style={[styles.label, { color: colors.text }]}>
            {selectedMethod === 'bank' ? 'Compte bancaire' : 'Compte Mobile Money'}
          </Text>
          <TouchableOpacity
            style={[styles.accountSelector, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => selectedMethod === 'bank' ? setShowAccounts(true) : setShowMobileAccounts(true)}
          >
            {selectedMethod === 'bank' && selectedBank ? (
              <View style={styles.selectedAccount}>
                <View style={[styles.accountIconSmall, { backgroundColor: `${colors.primary}20` }]}>
                  <Ionicons name="business-outline" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.selectedBank, { color: colors.text }]}>{selectedBank.bankName}</Text>
                  <Text style={[styles.selectedAccountNumber, { color: colors.textSecondary }]}>
                    {selectedBank.accountNumber.slice(-4)}
                  </Text>
                </View>
              </View>
            ) : selectedMethod === 'mobile_money' && selectedMobile ? (
              <View style={styles.selectedAccount}>
                <View style={[styles.accountIconSmall, { backgroundColor: `${getOperatorColor(selectedMobile.operator)}20` }]}>
                  <Ionicons name={getOperatorIcon(selectedMobile.operator) as any} size={18} color={getOperatorColor(selectedMobile.operator)} />
                </View>
                <View>
                  <Text style={[styles.selectedBank, { color: colors.text }]}>{selectedMobile.operator}</Text>
                  <Text style={[styles.selectedAccountNumber, { color: colors.textSecondary }]}>
                    {selectedMobile.phoneNumber}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={[styles.selectAccountText, { color: colors.textSecondary }]}>
                Sélectionner un compte
              </Text>
            )}
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {selectedMethod === 'cash' && (
        <View style={[styles.cashInfo, { backgroundColor: `${colors.info}15`, borderColor: colors.info }]}>
          <Ionicons name="information-circle" size={20} color={colors.info} />
          <Text style={[styles.cashInfoText, { color: colors.info }]}>
            Rendez-vous dans un point de retrait M'Paye avec votre pièce d'identité
          </Text>
        </View>
      )}

      {/* Résumé des frais */}
      {amount && amountNum > 0 && isAmountValid && (
        <View style={[styles.feesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.feesTitle, { color: colors.text }]}>Résumé</Text>
          <View style={styles.feesRow}>
            <Text style={[styles.feesLabel, { color: colors.textSecondary }]}>Montant demandé</Text>
            <Text style={[styles.feesValue, { color: colors.text }]}>{formatCurrency(amountNum)}</Text>
          </View>
          <View style={styles.feesRow}>
            <Text style={[styles.feesLabel, { color: colors.textSecondary }]}>Frais ({selectedMethod === 'cash' ? '0' : selectedMethod === 'mobile_money' ? '1' : '0.5'}%)</Text>
            <Text style={[styles.feesValue, { color: colors.error }]}>{formatCurrency(fee)}</Text>
          </View>
          <View style={[styles.feesDivider, { backgroundColor: colors.border }]} />
          <View style={styles.feesRow}>
            <Text style={[styles.netLabel, { color: colors.text, fontWeight: '600' }]}>Net à recevoir</Text>
            <Text style={[styles.netValue, { color: colors.success, fontWeight: 'bold' }]}>{formatCurrency(netAmount)}</Text>
          </View>
        </View>
      )}

      {/* Bouton de validation */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          { backgroundColor: colors.primary },
          !canSubmit && styles.submitButtonDisabled,
        ]}
        onPress={handleWithdraw}
        disabled={!canSubmit}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="arrow-down-outline" size={20} color="#fff" />
            <Text style={styles.submitButtonText}>Demander le retrait</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Informations */}
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.infoHeader}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={[styles.infoTitle, { color: colors.text }]}>Informations</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Délai de traitement: 24 à 48h ouvrées
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Montant minimum: {formatCurrency(minAmount)}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Montant maximum: {formatCurrency(maxAmount)} par transaction
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="trending-down-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Frais: Virement bancaire 0.5% | Mobile Money 1% | Cash 0%
          </Text>
        </View>
      </View>

      <BankAccountModal />
      <MobileMoneyModal />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  
  balanceCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  balanceLabel: { fontSize: 14, marginBottom: 8 },
  balanceValue: { fontSize: 32, fontWeight: 'bold' },
  
  methodSection: { paddingHorizontal: 16, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  methodButtons: { flexDirection: 'row', gap: 10 },
  methodButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  methodText: { fontSize: 12, fontWeight: '500' },
  
  amountSection: { paddingHorizontal: 16, marginBottom: 20 },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 60,
  },
  currencySymbol: { fontSize: 18, fontWeight: '500', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 24, fontWeight: 'bold', padding: 0 },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 8 },
  
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  quickAmountBtn: {
    flex: 1,
    minWidth: '23%',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  quickAmountText: { fontSize: 12, fontWeight: '500' },
  
  accountSection: { paddingHorizontal: 16, marginBottom: 20 },
  accountSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectedAccount: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountIconSmall: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  selectedBank: { fontSize: 14, fontWeight: '500' },
  selectedAccountNumber: { fontSize: 12, marginTop: 2 },
  selectAccountText: { fontSize: 14 },
  
  cashInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  cashInfoText: { flex: 1, fontSize: 12 },
  
  feesCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  feesTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  feesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  feesLabel: { fontSize: 13 },
  feesValue: { fontSize: 13 },
  feesDivider: { height: 1, marginVertical: 8 },
  netLabel: { fontSize: 14 },
  netValue: { fontSize: 16 },
  
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
    marginBottom: 20,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  infoCard: {
    marginHorizontal: 16,
    marginBottom: 30,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  infoTitle: { fontSize: 14, fontWeight: '600' },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoText: { flex: 1, fontSize: 12 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  accountInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  accountIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  accountBank: { fontSize: 14, fontWeight: '500' },
  accountNumber: { fontSize: 12, marginTop: 2 },
  accountHolder: { fontSize: 11, marginTop: 2 },
  defaultBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 8 },
  defaultBadgeText: { fontSize: 10, fontWeight: '500' },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderWidth: 1, borderRadius: 12, marginTop: 16, gap: 8 },
  addButtonText: { fontSize: 14, fontWeight: '500' },
});
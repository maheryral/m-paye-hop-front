// app/(app)/transfers.tsx
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import GradientHeader from '../../src/components/GradientHeader';
import { useBiometricGuard } from '../../src/contexts/BiometricGuardContext';
import { monetizationApi, FeeCalculation } from '../../src/services/monetizationApi';
import { useLocale } from '../../src/contexts/LocaleContext';
import { useWallet } from '../../src/contexts/WalletContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { transactionService } from '../../src/services/api';

export default function Transfers() {
  const router = useRouter();
  const { colors } = useTheme();
  const { requireBiometric } = useBiometricGuard();
  const { formatCurrency } = useLocale();
  const { balance, fetchBalance } = useWallet();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [searching, setSearching] = useState(false);
  const [validatedRecipient, setValidatedRecipient] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [formData, setFormData] = useState({
    toPhone: '',
    recipientName: '',
    amount: '',
    motif: '',
  });

  const minAmount = 1000;
  const maxAmount = 5000000;

  const amountNum = parseFloat(formData.amount) || 0;
  const hasEnoughBalance = amountNum <= balance;
  const isAmountValid = amountNum >= minAmount && amountNum <= maxAmount;
  const isFormValid = validatedRecipient && formData.amount && isAmountValid && hasEnoughBalance;

  const [feeCalc, setFeeCalc] = useState<FeeCalculation | null>(null);

  // Calcul live des fees (debounced)
  useEffect(() => {
    if (!amountNum || amountNum <= 0) {
      setFeeCalc(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await monetizationApi.calculateFee('TRANSFER', amountNum);
        setFeeCalc(res.data);
      } catch {
        setFeeCalc(null);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountNum]);

  const fee = feeCalc?.feeAmount ?? 0;
  const feePercentLabel = feeCalc ? `${(feeCalc.feePercent * 100).toFixed(2)}%` : '0%';
  const totalDebit = amountNum + fee;
  
  
  // 🔎 Recherche debounced d'utilisateurs (email OU téléphone, normalisé)
  const fetchSuggestions = async (q: string) => {
    if (!q || q.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearching(true);
    try {
      const list = await transactionService.suggestUsers(q);
      setSuggestions(Array.isArray(list) ? list : []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  };

  const handleToPhoneChange = (text: string) => {
    setFormData(prev => ({ ...prev, toPhone: text, recipientName: '' }));
    setValidatedRecipient(null);

    if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
    suggestionTimer.current = setTimeout(() => fetchSuggestions(text), 250);
  };

  // L'user tape sur une suggestion : on remplit + on valide le destinataire
  const pickRecipient = (recipient: any) => {
    setValidatedRecipient(recipient);
    setFormData(prev => ({
      ...prev,
      // Affiche email si c'est un email recherché, sinon téléphone
      toPhone: recipient.email || recipient.telephone,
      recipientName: `${recipient.prenom || ''} ${recipient.nom || ''}`.trim(),
    }));
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleAmountChange = (text: string) => {
    setFormData(prev => ({ ...prev, amount: text }));
  };

  const handleSubmit = async () => {
    if (!validatedRecipient) {
      Alert.alert('Erreur', 'Veuillez saisir un email ou numéro de téléphone valide');
      return;
    }
    
    if (!formData.amount || amountNum <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un montant valide');
      return;
    }
    
    if (amountNum < minAmount) {
      Alert.alert('Erreur', `Le montant minimum est de ${minAmount.toLocaleString()} Ar`);
      return;
    }
    
    if (amountNum > maxAmount) {
      Alert.alert('Erreur', `Le montant maximum est de ${maxAmount.toLocaleString()} Ar`);
      return;
    }
    
    if (!hasEnoughBalance) {
      Alert.alert('Erreur', `Solde insuffisant. Solde disponible: ${formatCurrency(balance)}`);
      return;
    }

    const ok = await requireBiometric(
      `Confirmez le transfert de ${amountNum.toLocaleString()} Ar`,
    );
    if (!ok) return;

    setLoading(true);
    setStep(2);

    try {
      await transactionService.transfer({
        toPhone: formData.toPhone,
        amount: amountNum,
        motif: formData.motif || 'Transfert MyWallet',
      });
      
      await fetchBalance();
      setStep(3);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Erreur lors du transfert');
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      toPhone: '',
      recipientName: '',
      amount: '',
      motif: '',
    });
    setValidatedRecipient(null);
    setStep(1);
  };

  const renderStep1 = () => (
    <View style={styles.formContainer}>
      {/* Champ destinataire */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Email ou numéro de téléphone
        </Text>
        <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="exemple@email.com ou 032 12 345 67"
            placeholderTextColor={colors.textSecondary}
            value={formData.toPhone}
            onChangeText={handleToPhoneChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searching && <ActivityIndicator size="small" color={colors.primary} />}
        </View>

        {/* 🔎 Dropdown suggestions */}
        {showSuggestions && suggestions.length > 0 && !validatedRecipient && (
          <View style={[styles.suggBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {suggestions.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={[styles.suggItem, { borderBottomColor: colors.border }]}
                onPress={() => pickRecipient(u)}
                activeOpacity={0.7}
              >
                <View style={[styles.suggAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.suggAvatarText}>
                    {(u.prenom?.[0] || u.email?.[0] || '?').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.suggName, { color: colors.text }]} numberOfLines={1}>
                    {`${u.prenom || ''} ${u.nom || ''}`.trim() || 'Utilisateur'}
                  </Text>
                  <Text style={[styles.suggContact, { color: colors.textSecondary }]} numberOfLines={1}>
                    {u.email} {u.telephone ? `· ${u.telephone}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty state si recherche sans résultats */}
        {showSuggestions && suggestions.length === 0 && !searching && formData.toPhone.length >= 3 && !validatedRecipient && (
          <View style={[styles.suggEmpty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Aucun utilisateur trouvé
            </Text>
          </View>
        )}
      </View>

      {/* Bénéficiaire validé */}
      {validatedRecipient && (
        <View style={[styles.validatedCard, { backgroundColor: `${colors.success}15`, borderColor: colors.success }]}>
          <View style={styles.validatedHeader}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[styles.validatedTitle, { color: colors.success }]}>Bénéficiaire validé</Text>
          </View>
          <Text style={[styles.validatedName, { color: colors.text }]}>
            {`${validatedRecipient.prenom} ${validatedRecipient.nom}`}
          </Text>
          <Text style={[styles.validatedContact, { color: colors.textSecondary }]}>
            {validatedRecipient.email || validatedRecipient.telephone}
          </Text>
        </View>
      )}

      {/* Champ montant */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Montant (Ar)
        </Text>
        <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Ionicons name="cash-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, { color: colors.text, fontSize: 18, fontWeight: '600' }]}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            value={formData.amount}
            onChangeText={handleAmountChange}
            keyboardType="numeric"
          />
        </View>
        <Text style={[styles.helperText, { color: colors.textSecondary }]}>
          Min: {minAmount.toLocaleString()} Ar | Max: {maxAmount.toLocaleString()} Ar
        </Text>
        {formData.amount && !isAmountValid && (
          <Text style={styles.errorText}>
            Le montant doit être entre {minAmount.toLocaleString()} et {maxAmount.toLocaleString()} Ar
          </Text>
        )}
      </View>

      {/* Aperçu des frais */}
      {formData.amount && amountNum > 0 && isAmountValid && (
        <View style={[styles.feesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.feesRow}>
            <Text style={[styles.feesLabel, { color: colors.textSecondary }]}>Montant</Text>
            <Text style={[styles.feesValue, { color: colors.text }]}>{amountNum.toLocaleString()} Ar</Text>
          </View>
          <View style={styles.feesRow}>
            <Text style={[styles.feesLabel, { color: colors.textSecondary }]}>
              Frais ({feePercentLabel})
            </Text>
            <Text style={[styles.feesValue, { color: fee > 0 ? colors.warning : colors.success }]}>
              {fee > 0 ? `${fee.toLocaleString()} Ar` : 'Gratuit ✨'}
            </Text>
          </View>
          {feeCalc?.appliedRule && (
            <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: -2 }}>
              {feeCalc.appliedRule}
            </Text>
          )}
          <View style={[styles.feesDivider, { backgroundColor: colors.border }]} />
          <View style={styles.feesRow}>
            <Text style={[styles.feesLabel, { fontWeight: '600', color: colors.text }]}>Total à débiter</Text>
            <Text style={[styles.feesValue, { fontWeight: '700', color: hasEnoughBalance ? colors.primary : colors.error }]}>
              {totalDebit.toLocaleString()} Ar
            </Text>
          </View>
          {!hasEnoughBalance && (
            <Text style={[styles.errorText, { marginTop: 8 }]}>
              Solde insuffisant. Solde disponible: {formatCurrency(balance)}
            </Text>
          )}
        </View>
      )}

      {/* Champ motif */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Motif (optionnel)</Text>
        <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Ex: Remboursement, Cadeau, Salaire..."
            placeholderTextColor={colors.textSecondary}
            value={formData.motif}
            onChangeText={(text) => setFormData(prev => ({ ...prev, motif: text }))}
          />
        </View>
      </View>

      {/* Récapitulatif */}
      {isFormValid && (
        <View style={[styles.summaryCard, { backgroundColor: `${colors.primary}10`, borderColor: colors.primary }]}>
          <Text style={[styles.summaryTitle, { color: colors.primary }]}>Récapitulatif du transfert</Text>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Destinataire</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{validatedRecipient?.nom}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Contact</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{formData.toPhone}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Montant</Text>
            <Text style={[styles.summaryValue, { color: colors.text, fontWeight: '700' }]}>{amountNum.toLocaleString()} Ar</Text>
          </View>
          {formData.motif && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Motif</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{formData.motif}</Text>
            </View>
          )}
        </View>
      )}

      {/* Bouton de validation */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          { backgroundColor: colors.primary },
          (!validatedRecipient || !formData.amount || !isAmountValid || !hasEnoughBalance) && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!validatedRecipient || !formData.amount || !isAmountValid || !hasEnoughBalance || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="send-outline" size={20} color="#fff" />
            <Text style={styles.submitButtonText}>Effectuer le transfert</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.processingContainer}>
      <View style={styles.processingIcon}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
      <Text style={[styles.processingTitle, { color: colors.text }]}>Transfert en cours...</Text>
      <Text style={[styles.processingText, { color: colors.textSecondary }]}>Veuillez patienter</Text>
      <View style={[styles.processingDetails, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.processingDetailsLabel, { color: colors.textSecondary }]}>Détails du transfert</Text>
        <Text style={[styles.processingDetailsAmount, { color: colors.text }]}>{amountNum.toLocaleString()} Ar</Text>
        <Text style={[styles.processingDetailsRecipient, { color: colors.textSecondary }]}>
          vers {validatedRecipient?.name || formData.toPhone}
        </Text>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.successContainer}>
      <View style={[styles.successIcon, { backgroundColor: `${colors.success}20` }]}>
        <Ionicons name="checkmark-circle" size={60} color={colors.success} />
      </View>
      <Text style={[styles.successTitle, { color: colors.text }]}>Transfert réussi !</Text>
      <Text style={[styles.successAmount, { color: colors.success }]}>
        {amountNum.toLocaleString()} Ar
      </Text>
      <Text style={[styles.successRecipient, { color: colors.textSecondary }]}>
        envoyés à {validatedRecipient?.name || formData.toPhone}
      </Text>
      
      <View style={styles.successButtons}>
        <TouchableOpacity
          style={[styles.successButton, { backgroundColor: colors.primary }]}
          onPress={resetForm}
        >
          <Ionicons name="refresh-outline" size={20} color="#fff" />
          <Text style={styles.successButtonText}>Nouveau transfert</Text>
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
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <GradientHeader
        title="Transfert Wallet"
        subtitle="Envoyez de l'argent à un autre utilisateur MyWallet"
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        {/* Balance card */}
        <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.balanceLabel}>Solde disponible</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(balance)}</Text>
          <Text style={styles.balanceAccount}>
            Compte: {user?.prenom || 'Compte principal'}
          </Text>
        </View>

        {/* Steps */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {/* Informations */}
        {step === 1 && (
          <View style={[styles.infoCard, { backgroundColor: `${colors.info}10`, borderColor: colors.info }]}>
            <Ionicons name="information-circle" size={20} color={colors.info} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.info }]}>Informations sur le transfert</Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                • Transfert instantané entre comptes MyWallet
              </Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                • Sans frais
              </Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                • Transfert sécurisé par authentification JWT
              </Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                • Montant minimum: {minAmount.toLocaleString()} Ar
              </Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                • Montant maximum: {maxAmount.toLocaleString()} Ar
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
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
    marginBottom: 8,
  },
  balanceAccount: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
  },
  formContainer: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  helperText: {
    fontSize: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  suggBox: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
  },
  suggAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  suggName: { fontSize: 14, fontWeight: '600' },
  suggContact: { fontSize: 11, marginTop: 2 },
  suggEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  validatedCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  validatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  validatedTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  validatedName: {
    fontSize: 15,
    fontWeight: '600',
  },
  validatedContact: {
    fontSize: 12,
  },
  feesCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
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
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 13,
  },
  summaryValue: {
    fontSize: 13,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    gap: 10,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  processingIcon: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  processingText: {
    fontSize: 14,
  },
  processingDetails: {
    marginTop: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  processingDetailsLabel: {
    fontSize: 14,
  },
  processingDetailsAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  processingDetailsRecipient: {
    fontSize: 14,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  successAmount: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  successRecipient: {
    fontSize: 16,
    textAlign: 'center',
  },
  successButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
    width: '100%',
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
  infoCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 12,
  },
  infoContent: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
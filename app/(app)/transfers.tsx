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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import BottomTabBar from '../../src/components/BottomTabBar';
import { useBiometricGuard } from '../../src/contexts/BiometricGuardContext';
import { monetizationApi, FeeCalculation } from '../../src/services/monetizationApi';
import { useLocale } from '../../src/contexts/LocaleContext';
import { useWallet } from '../../src/contexts/WalletContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { transactionService } from '../../src/services/api';
import { useStripe } from '@stripe/stripe-react-native';
import { providersApi } from '../../src/services/providersApi';
import { paymentApi } from '../../src/services/paymentApi';
import { cardsApi } from '../../src/services/cardsApi';

// ── Modes de paiement (comme la page QR) ──
type PayMethodId = 'wallet' | 'card' | 'mvola' | 'orange' | 'airtel';
interface PayMethod {
  id: PayMethodId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  providerCode?: string;
}
const PAY_METHODS: PayMethod[] = [
  { id: 'wallet', label: 'Wallet', icon: 'wallet', color: '#2563eb' },
  { id: 'card', label: 'Carte', icon: 'card', color: '#6366f1' },
  { id: 'mvola', label: 'MVola', icon: 'phone-portrait', color: '#ec4899', providerCode: 'MVOLA' },
  { id: 'orange', label: 'Orange Money', icon: 'phone-portrait', color: '#f97316', providerCode: 'ORANGE_MONEY' },
  { id: 'airtel', label: 'Airtel Money', icon: 'phone-portrait', color: '#ef4444', providerCode: 'AIRTEL_MONEY' },
];

export default function Transfers() {
  const router = useRouter();
  const { colors } = useTheme();
  const { requireBiometric } = useBiometricGuard();
  const { formatCurrency } = useLocale();
  const { balance, fetchBalance } = useWallet();
  const { user } = useAuth();
  const { confirmPayment } = useStripe();
  const insets = useSafeAreaInsets();
  const [selectedMethod, setSelectedMethod] = useState<PayMethodId>('wallet');
  const [availableMethods, setAvailableMethods] = useState<Set<PayMethodId>>(new Set(['wallet']));
  const [mvolaPhone, setMvolaPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [infoOpen, setInfoOpen] = useState(true);
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
  const isWallet = selectedMethod === 'wallet';
  // Seul le wallet exige un solde suffisant ; carte / mobile money débitent
  // directement la source externe.
  const hasEnoughBalance = !isWallet || amountNum <= balance;
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

  // Modes de paiement réellement disponibles (providers actifs côté backend).
  useEffect(() => {
    if (user?.telephone) setMvolaPhone(user.telephone);
    providersApi
      .getPublic()
      .then((r) => {
        const avail = new Set<PayMethodId>(['wallet']);
        for (const p of r.data || []) {
          if (p.type === 'CARD') avail.add('card');
          const code = (p.code || '').toUpperCase();
          if (code.includes('MVOLA')) avail.add('mvola');
          else if (code.includes('ORANGE')) avail.add('orange');
          else if (code.includes('AIRTEL')) avail.add('airtel');
        }
        setAvailableMethods(avail);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.telephone]);

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

  /**
   * Paiement carte DIRECT : charge la carte par défaut via Stripe, puis le
   * backend crédite le destinataire (le wallet n'est jamais touché).
   */
  const payByCardDirect = async (toPhone: string, amt: number): Promise<boolean> => {
    try {
      const list = (await cardsApi.list()).data || [];
      const sel = list.find((c) => c.isDefault) ?? list[0];
      if (!sel?.stripePaymentMethodId) {
        Alert.alert('Aucune carte', 'Ajoutez une carte dans le Portefeuille pour payer par carte.');
        return false;
      }
      const intent = await paymentApi.createCardTransferIntent(toPhone, amt);
      const clientSecret = intent.data.clientSecret;
      if (!clientSecret) throw new Error('clientSecret manquant');
      const { paymentIntent, error } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
        paymentMethodData: { paymentMethodId: sel.stripePaymentMethodId } as any,
      });
      if (error || paymentIntent?.status !== 'Succeeded') {
        Alert.alert('Paiement carte refusé', error?.message || 'Réessayez.');
        return false;
      }
      await paymentApi.confirmCardTransfer(intent.data.paymentRequestId);
      return true;
    } catch (e: any) {
      Alert.alert('Erreur carte', e?.response?.data?.message || e?.message || 'Paiement impossible.');
      return false;
    }
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

    if (isWallet && !hasEnoughBalance) {
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
      // 💳 Carte : débit DIRECT (le wallet n'est jamais touché)
      if (selectedMethod === 'card') {
        const done = await payByCardDirect(formData.toPhone, amountNum);
        if (!done) { setStep(1); return; }
        await fetchBalance();
        setStep(3);
        return;
      }

      // 📱 Mobile money : débit DIRECT — on charge le mobile money du payeur,
      // le destinataire est crédité directement.
      if (selectedMethod !== 'wallet') {
        const method = PAY_METHODS.find((m) => m.id === selectedMethod);
        if (!method?.providerCode || !availableMethods.has(selectedMethod)) {
          Alert.alert('Bientôt disponible', "Ce mode de paiement n'est pas encore actif.");
          setStep(1);
          return;
        }
        const phone = mvolaPhone.trim();
        if (!phone) {
          Alert.alert('Numéro requis', 'Saisissez votre numéro mobile money.');
          setStep(1);
          return;
        }
        const res = await providersApi.mobileMoneyDeposit(method.providerCode, amountNum, phone, formData.toPhone);
        if (res.data.status === 'SUCCESS') {
          await fetchBalance();
          setStep(3);
        } else {
          Alert.alert(
            res.data.status === 'FAILED' ? 'Paiement refusé' : 'En attente',
            res.data.message || 'Réessayez ou utilisez un autre mode.',
          );
          setStep(1);
        }
        return;
      }

      // 👛 Wallet : transfert direct depuis le solde
      // 🔒 Idempotency-Key : double-tap ou retry → backend rejette le doublon
      const idem = `tx-${formData.toPhone}-${amountNum}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await transactionService.transfer(
        {
          toPhone: formData.toPhone,
          amount: amountNum,
          motif: formData.motif || 'Transfert MyWallet',
        },
        idem,
      );

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
    setSelectedMethod('wallet');
    setStep(1);
  };

  const quickAmounts = [5000, 10000, 25000, 50000];

  const renderStep1 = () => (
    <View style={styles.formContainer}>
      {/* Champ destinataire */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Envoyer à</Text>
        <View style={[styles.fieldCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={[styles.fieldIcon, { backgroundColor: `${colors.primary}14` }]}>
            <Ionicons name="person-outline" size={20} color={colors.primary} />
          </View>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Email ou numéro de téléphone"
            placeholderTextColor={colors.textTertiary}
            value={formData.toPhone}
            onChangeText={handleToPhoneChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <TouchableOpacity
              style={[styles.fieldTrailingBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/beneficiaries' as any)}
            >
              <Ionicons name="people" size={18} color="#fff" />
            </TouchableOpacity>
          )}
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

      {/* Sélecteur de méthode de paiement */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Payer avec</Text>
        <View style={styles.methodRow}>
          {PAY_METHODS.filter((m) => availableMethods.has(m.id)).map((m) => {
            const active = selectedMethod === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.methodChip,
                  {
                    backgroundColor: active ? `${m.color}18` : colors.card,
                    borderColor: active ? m.color : colors.border,
                  },
                ]}
                onPress={() => setSelectedMethod(m.id)}
                activeOpacity={0.8}
              >
                <Ionicons name={m.icon} size={20} color={m.color} />
                <Text style={[styles.methodChipText, { color: active ? m.color : colors.text }]} numberOfLines={1}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Numéro mobile money si méthode opérateur choisie */}
        {selectedMethod !== 'wallet' && selectedMethod !== 'card' && (
          <View style={[styles.fieldCard, { borderColor: colors.border, backgroundColor: colors.card, marginTop: 4 }]}>
            <View style={[styles.fieldIcon, { backgroundColor: `${colors.primary}14` }]}>
              <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
            </View>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Votre numéro mobile money"
              placeholderTextColor={colors.textTertiary}
              value={mvolaPhone}
              onChangeText={setMvolaPhone}
              keyboardType="phone-pad"
            />
          </View>
        )}

        <Text style={[styles.helperText, { color: colors.textSecondary }]}>
          {isWallet
            ? 'Débité de votre solde M\'Paye.'
            : selectedMethod === 'card'
              ? 'Débité directement sur votre carte par défaut.'
              : 'Débité directement sur votre mobile money.'}
        </Text>
      </View>

      {/* Champ montant */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Montant (Ar)</Text>
        <View style={[styles.fieldCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={[styles.fieldIcon, { backgroundColor: `${colors.primary}14` }]}>
            <Ionicons name="cash-outline" size={20} color={colors.primary} />
          </View>
          <TextInput
            style={[styles.input, { color: colors.text, fontSize: 22, fontWeight: '700' }]}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            value={formData.amount}
            onChangeText={handleAmountChange}
            keyboardType="numeric"
          />
          <Text style={[styles.amountSuffix, { color: colors.primary }]}>Ar</Text>
        </View>

        {/* Chips montants rapides */}
        <View style={styles.chipsRow}>
          {quickAmounts.map((amt) => {
            const active = formData.amount === String(amt);
            return (
              <TouchableOpacity
                key={amt}
                style={[
                  styles.chip,
                  { backgroundColor: active ? colors.primary : `${colors.primary}10`, borderColor: active ? colors.primary : 'transparent' },
                ]}
                onPress={() => handleAmountChange(String(amt))}
              >
                <Text style={[styles.chipText, { color: active ? '#fff' : colors.primary }]}>{amt.toLocaleString()}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: `${colors.primary}10` }]}
            onPress={() => handleAmountChange('')}
          >
            <Text style={[styles.chipText, { color: colors.primary }]}>Autre</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.helperText, { color: colors.textSecondary }]}>
          Min: <Text style={{ color: colors.primary, fontWeight: '700' }}>{minAmount.toLocaleString()} Ar</Text>
          {'  |  '}Max: <Text style={{ color: colors.primary, fontWeight: '700' }}>{maxAmount.toLocaleString()} Ar</Text>
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
        <Text style={[styles.label, { color: colors.text }]}>Motif (optionnel)</Text>
        <View style={[styles.fieldCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={[styles.fieldIcon, { backgroundColor: `${colors.secondary}14` }]}>
            <Ionicons name="document-text-outline" size={20} color={colors.secondary} />
          </View>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Ex: Remboursement, Cadeau, Salaire..."
            placeholderTextColor={colors.textTertiary}
            value={formData.motif}
            onChangeText={(text) => setFormData(prev => ({ ...prev, motif: text }))}
          />
          <Ionicons name="chevron-down" size={20} color={colors.primary} />
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      {/* ═══════════ HEADER BLEU ═══════════ */}
      <LinearGradient
        colors={['#2563eb', '#1e40af', '#1e3a8a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.7 }}
        style={[styles.gradHeader, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.gradHeaderDecor} />
        <View style={styles.gradHeaderRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.gradBackBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.gradTitle}>Transfert Wallet</Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Aide', "Saisissez un email ou numéro M'Paye, un montant, puis validez. Transfert instantané et sans frais.")
            }
            style={styles.gradHelpBtn}
            hitSlop={8}
          >
            <Ionicons name="help" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.gradSubtitle}>Envoyez de l'argent à un autre utilisateur MyWallet</Text>

        {/* Carte solde (panneau dans le bloc bleu, comme le dashboard) */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceDecor} />
          <View style={styles.walletIllustration}>
            <Ionicons name="wallet" size={52} color="rgba(255,255,255,0.9)" />
            <View style={styles.walletCheck}>
              <Ionicons name="checkmark" size={14} color="#fff" />
            </View>
          </View>

          <View style={styles.balanceLabelRow}>
            <Text style={styles.balanceLabel}>Solde disponible</Text>
            <TouchableOpacity onPress={() => setShowBalance((v) => !v)} hitSlop={10}>
              <Ionicons name={showBalance ? 'eye-outline' : 'eye-off-outline'} size={18} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
          <Text style={styles.balanceAmount}>{showBalance ? formatCurrency(balance) : '••••••••'}</Text>
          <Text style={styles.balanceAccount}>Compte : {user?.prenom || 'Compte principal'}</Text>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Steps */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {/* Informations (accordéon) */}
        {step === 1 && (
          <View style={[styles.infoCard, { backgroundColor: `${colors.info}0d`, borderColor: `${colors.info}33` }]}>
            <TouchableOpacity style={styles.infoHeaderRow} onPress={() => setInfoOpen((v) => !v)} activeOpacity={0.7}>
              <Ionicons name="information-circle" size={22} color={colors.info} />
              <Text style={[styles.infoTitle, { color: colors.info }]}>Informations sur le transfert</Text>
              <Ionicons name={infoOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.info} />
            </TouchableOpacity>
            {infoOpen && (
              <View style={styles.infoRows}>
                {[
                  { icon: 'flash' as const, bg: '#3b82f615', color: '#3b82f6', text: 'Transfert instantané entre comptes MyWallet' },
                  { icon: 'shield-checkmark' as const, bg: '#22c55e15', color: '#22c55e', text: 'Sans frais' },
                  { icon: 'lock-closed' as const, bg: '#8b5cf615', color: '#8b5cf6', text: 'Transfert sécurisé et authentifié par JWT' },
                ].map((r) => (
                  <View key={r.text} style={styles.infoRow}>
                    <View style={[styles.infoRowIcon, { backgroundColor: r.bg }]}>
                      <Ionicons name={r.icon} size={16} color={r.color} />
                    </View>
                    <Text style={[styles.infoRowText, { color: colors.text }]}>{r.text}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 96,
  },

  // ─── Header bleu ───
  gradHeader: {
    paddingHorizontal: 16,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  gradHeaderDecor: {
    position: 'absolute',
    top: -30,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  gradHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  gradBackBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  gradTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  gradHelpBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 },

  // ─── Carte solde (panneau translucide dans le bloc bleu) ───
  balanceCard: {
    borderRadius: 20,
    padding: 18,
    marginTop: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  balanceDecor: {
    position: 'absolute',
    bottom: -50,
    left: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  walletIllustration: {
    position: 'absolute',
    top: 22,
    right: 20,
    width: 76,
    height: 76,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletCheck: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  balanceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },
  balanceAmount: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 6, letterSpacing: 0.3 },
  balanceAccount: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 6 },

  formContainer: {
    gap: 22,
  },
  inputGroup: {
    gap: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },

  // ─── Champ en carte ───
  fieldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  fieldIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  fieldTrailingBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  amountSuffix: { fontSize: 18, fontWeight: '800' },
  input: {
    flex: 1,
    fontSize: 15,
  },

  // ─── Sélecteur de méthode ───
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  methodChipText: { fontSize: 13, fontWeight: '700' },

  // ─── Chips montant ───
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '700' },

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
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
  },
  infoHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  infoRows: { marginTop: 14, gap: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoRowIcon: { width: 34, height: 34, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  infoRowText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
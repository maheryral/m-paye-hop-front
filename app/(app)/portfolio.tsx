// app/(app)/portfolio.tsx — Dépôt / Retrait avec modal plein écran par méthode
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  CardField,
  useStripe,
  useConfirmSetupIntent,
} from '@stripe/stripe-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/contexts/ThemeContext';
import BottomTabBar from '../../src/components/BottomTabBar';
import { useWallet } from '../../src/contexts/WalletContext';
import { useSocket } from '../../src/contexts/SocketContext';
import { useBiometricGuard } from '../../src/contexts/BiometricGuardContext';
import { useLocale } from '../../src/contexts/LocaleContext';
import {
  paymentApi,
  PaymentRequestMethod,
} from '../../src/services/paymentApi';
import { cardsApi, type SavedCard } from '../../src/services/cardsApi';
import { providersApi } from '../../src/services/providersApi';

type Tab = 'deposit' | 'withdraw';

interface MethodMeta {
  id: PaymentRequestMethod;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  description: string;
}

const METHODS: MethodMeta[] = [
  {
    id: 'CARD',
    name: 'Carte bancaire',
    icon: 'card-outline',
    color: '#3b82f6',
    description: 'Visa, Mastercard via Stripe',
  },
  {
    id: 'MOBILE_MONEY',
    name: 'Mobile Money',
    icon: 'phone-portrait-outline',
    color: '#10b981',
    description: 'MVola, Orange Money, Airtel Money',
  },
  {
    id: 'BANK',
    name: 'Virement bancaire',
    icon: 'business-outline',
    color: '#8b5cf6',
    description: 'BNI, BFV, BOA…',
  },
  {
    id: 'CASH',
    name: 'Cash chez agent',
    icon: 'cash-outline',
    color: '#f59e0b',
    description: 'Dépôt/retrait en espèces',
  },
];

export default function Portfolio() {
  const router = useRouter();
  const { colors } = useTheme();
  const { balance, fetchBalance } = useWallet();
  const { onNotification } = useSocket();
  const { requireBiometric } = useBiometricGuard();
  const { formatCurrency } = useLocale();
  const { confirmPayment } = useStripe();
  const { confirmSetupIntent } = useConfirmSetupIntent();

  const [tab, setTab] = useState<Tab>('deposit');
  const [method, setMethod] = useState<PaymentRequestMethod | null>(null);
  const [methodModal, setMethodModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [details, setDetails] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const insets = useSafeAreaInsets();

  // === Stripe carte ===
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [useNewCard, setUseNewCard] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);

  // === Modal ajout d'une carte (SetupIntent autonome) ===
  const [addCardModal, setAddCardModal] = useState(false);
  const [addCardComplete, setAddCardComplete] = useState(false);
  const [savingCard, setSavingCard] = useState(false);

  const loadSavedCards = useCallback(async () => {
    try {
      const r = await cardsApi.list();
      const list = Array.isArray(r.data) ? r.data : [];
      setSavedCards(list);
      const def = list.find((c) => c.isDefault) ?? list[0];
      setSelectedCardId(def?.id ?? null);
      setUseNewCard(list.length === 0);
    } catch {
      setUseNewCard(true);
    }
  }, []);

  useEffect(() => {
    void loadSavedCards();
  }, [loadSavedCards]);

  // Refresh auto sur notification de paiement
  useEffect(() => {
    const unsub = onNotification((n) => {
      if (
        n.type === 'DEPOSIT_SUCCESS' ||
        n.type === 'PAYMENT_SUCCESS' ||
        n.type === 'PAYMENT_FAILED' ||
        n.actionType === 'PAYMENT_REQUEST'
      ) {
        fetchBalance();
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchBalance(), loadSavedCards()]);
    setRefreshing(false);
  };

  const openMethodModal = (m: PaymentRequestMethod) => {
    if (tab === 'withdraw' && m === 'CARD') {
      Alert.alert(
        'Indisponible',
        'Retrait par carte non supporté — utilisez Mobile Money ou Bank.',
      );
      return;
    }
    setMethod(m);
    setAmount('');
    setDetails({});
    setCardComplete(false);
    if (m === 'CARD') {
      const def = savedCards.find((c) => c.isDefault) ?? savedCards[0];
      setSelectedCardId(def?.id ?? null);
      setUseNewCard(savedCards.length === 0);
    }
    setMethodModal(true);
  };

  const closeMethodModal = () => {
    if (submitting) return;
    setMethodModal(false);
    setMethod(null);
    setAmount('');
    setDetails({});
    setCardComplete(false);
  };

  /** Ajout d'une carte autonome via SetupIntent Stripe. */
  const addNewCard = async () => {
    if (!addCardComplete) {
      Alert.alert('Carte incomplète', 'Renseignez les informations de la carte.');
      return;
    }
    setSavingCard(true);
    try {
      const setup = await cardsApi.createSetupIntent();
      const { setupIntent, error } = await confirmSetupIntent(
        setup.data.clientSecret,
        { paymentMethodType: 'Card' },
      );
      if (error) {
        Alert.alert('Erreur', error.message || "Échec de l'enregistrement");
        return;
      }
      const pmId = setupIntent?.paymentMethod?.id;
      if (!pmId) {
        Alert.alert('Erreur', 'Carte non tokenisée');
        return;
      }
      await cardsApi.saveCard(pmId);
      setAddCardModal(false);
      setAddCardComplete(false);
      await loadSavedCards();
    } catch (e: any) {
      Alert.alert(
        'Erreur',
        e?.response?.data?.message || 'Stripe non configuré côté serveur ?',
      );
    } finally {
      setSavingCard(false);
    }
  };

  const removeCard = (id: string) => {
    Alert.alert('Supprimer la carte', 'Confirmer la suppression ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await cardsApi.remove(id);
            if (selectedCardId === id) {
              setSelectedCardId(null);
              setUseNewCard(true);
            }
            await loadSavedCards();
          } catch (e: any) {
            Alert.alert('Erreur', e?.response?.data?.message || 'Échec');
          }
        },
      },
    ]);
  };

  const setDefaultCard = async (id: string) => {
    try {
      await cardsApi.setDefault(id);
      await loadSavedCards();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Échec');
    }
  };

  const validate = (): string | null => {
    const a = parseFloat(amount);
    if (!a || a < 100) return 'Montant minimum : 100 Ar';
    if (tab === 'withdraw' && a > balance) {
      return `Solde insuffisant (${formatCurrency(balance)} disponible)`;
    }
    if (!method) return 'Choisissez une méthode';
    if (method === 'MOBILE_MONEY') {
      if (!details.operator) return 'Choisissez un opérateur';
      if (!details.phoneNumber?.trim()) return 'Numéro mobile money requis';
      const digits = details.phoneNumber.replace(/\D+/g, '');
      const normalized = digits.startsWith('00261')
        ? digits.slice(5)
        : digits.startsWith('261')
          ? digits.slice(3)
          : digits;
      const final = normalized.length === 9 ? '0' + normalized : normalized;
      if (!/^0(32|33|34|38)\d{7}$/.test(final)) {
        return `Numéro invalide. Format attendu : 0343500004 (10 chiffres, préfixe 032/033/034/038)`;
      }
    }
    if (method === 'BANK') {
      if (!details.bankName?.trim()) return 'Nom de banque requis';
      if (!details.accountNumber?.trim()) return 'Numéro de compte requis';
    }
    if (method === 'CARD' && tab === 'deposit') {
      if (!useNewCard && !selectedCardId) {
        return 'Sélectionnez une carte enregistrée ou ajoutez-en une.';
      }
      if (useNewCard && !cardComplete) {
        return 'Renseignez les informations de la carte.';
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      Alert.alert('Erreur', err);
      return;
    }

    const amt = parseFloat(amount);

    if (amt > 50000) {
      const ok = await requireBiometric(
        `Confirmez votre ${tab === 'deposit' ? 'dépôt' : 'retrait'} de ${amt.toLocaleString('fr-FR')} Ar`,
      );
      if (!ok) return;
    }

    // === Cas 1 : Dépôt CARTE Stripe ===
    if (tab === 'deposit' && method === 'CARD') {
      setSubmitting(true);
      try {
        const ref = await doCardDeposit(amt);
        closeMethodModalForce();
        await fetchBalance();
        Alert.alert(
          'Dépôt réussi ✅',
          `${amt.toLocaleString('fr-FR')} Ar crédités sur votre wallet.\nRéférence : ${ref}`,
        );
      } catch (e: any) {
        Alert.alert('Échec dépôt', e?.message || 'Erreur lors du paiement');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // === Cas 2 : Mobile Money auto (MVola / Airtel) ===
    const autoOperators: Record<string, { code: string; label: string }> = {
      mvola: { code: 'MVOLA', label: 'MVola' },
      airtel: { code: 'AIRTEL_MONEY', label: 'Airtel Money' },
    };
    const auto =
      tab === 'deposit' &&
      method === 'MOBILE_MONEY' &&
      details.operator &&
      autoOperators[details.operator];
    if (auto) {
      setSubmitting(true);
      try {
        const res = await providersApi.mobileMoneyDeposit(
          auto.code,
          amt,
          details.phoneNumber!.trim(),
        );
        const status = res.data.status;
        if (status === 'SUCCESS') {
          await fetchBalance();
          closeMethodModalForce();
          Alert.alert(
            'Dépôt réussi ✅',
            `${amt.toLocaleString('fr-FR')} Ar crédités sur votre wallet.\nRéférence : ${res.data.reference}`,
          );
        } else if (status === 'FAILED') {
          Alert.alert(
            `Dépôt ${auto.label} refusé ❌`,
            `${res.data.message ?? auto.label + ' a refusé la transaction.'}\nRéférence : ${res.data.reference}`,
          );
        } else {
          closeMethodModalForce();
          Alert.alert(
            `En attente ${auto.label} ⏳`,
            `${res.data.message ?? auto.label + ' met du temps à confirmer.'}\nRéférence : ${res.data.reference}`,
          );
        }
      } catch (e: any) {
        Alert.alert(
          `Erreur ${auto.label}`,
          e?.response?.data?.message || e?.message || `Échec dépôt ${auto.label}`,
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // === Cas 3 : autres → PaymentRequest standard ===
    setSubmitting(true);
    try {
      const res = await paymentApi.create({
        type: tab === 'deposit' ? 'DEPOSIT' : 'WITHDRAWAL',
        method: method!,
        amount: amt,
        details: Object.keys(details).length > 0 ? details : undefined,
      });
      closeMethodModalForce();
      Alert.alert(
        `Demande créée ✅`,
        `Référence : ${res.data.reference}\n\n${getInstructions(method!, tab, res.data.reference)}`,
      );
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Échec de la demande');
    } finally {
      setSubmitting(false);
    }
  };

  /** Ferme le modal en bypassant submitting (utilisé après une opération réussie). */
  const closeMethodModalForce = () => {
    setMethodModal(false);
    setMethod(null);
    setAmount('');
    setDetails({});
    setCardComplete(false);
  };

  /** Dépôt CARTE Stripe — utilise une carte sauvegardée ou en saisit une nouvelle. */
  const doCardDeposit = async (amt: number): Promise<string> => {
    let paymentMethodId: string | null = null;

    if (useNewCard || !selectedCardId) {
      if (!cardComplete) throw new Error('Carte incomplète');
      const setup = await cardsApi.createSetupIntent();
      const { setupIntent, error: setupErr } = await confirmSetupIntent(
        setup.data.clientSecret,
        { paymentMethodType: 'Card' },
      );
      if (setupErr) throw new Error(setupErr.message || 'Échec enregistrement carte');
      const pmId = setupIntent?.paymentMethod?.id;
      if (!pmId) throw new Error('Carte non tokenisée');
      try { await cardsApi.saveCard(pmId); } catch { /* ignore */ }
      paymentMethodId = pmId;
    } else {
      const sel = savedCards.find((c) => c.id === selectedCardId);
      if (!sel?.stripePaymentMethodId) {
        throw new Error('Carte sauvegardée invalide — réessayez ou ajoutez une nouvelle carte');
      }
      paymentMethodId = sel.stripePaymentMethodId;
    }

    const intent = await paymentApi.createStripeIntent(amt);
    const clientSecret = intent.data.clientSecret;
    if (!clientSecret) throw new Error('Pas de clientSecret');

    const { paymentIntent, error } = await confirmPayment(clientSecret, {
      paymentMethodType: 'Card',
      paymentMethodData: { paymentMethodId } as any,
    });
    if (error) throw new Error(error.message || 'Paiement refusé');
    if (paymentIntent?.status !== 'Succeeded') {
      throw new Error(`Statut Stripe: ${paymentIntent?.status ?? 'inconnu'}`);
    }
    const confirmed = await paymentApi.confirmStripeDeposit(intent.data.paymentRequestId);
    return confirmed.data.reference;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ═══════════ HEADER BLEU ═══════════ */}
      <LinearGradient
        colors={['#2563eb', '#1e40af', '#1e3a8a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.7 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerDecor} />
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={styles.headerTitle}>Mon Portefeuille</Text>
            <Text style={styles.headerSubtitle}>Dépôt et retrait</Text>
          </View>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Aide', 'Choisissez Dépôt ou Retrait, puis une méthode de paiement pour continuer.')
            }
            style={styles.headerHelpBtn}
            hitSlop={8}
          >
            <Ionicons name="help" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ─── Carte solde (panneau dans le bloc bleu, comme le dashboard) ─── */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceDecor} />
          {/* Illustration portefeuille */}
          <View style={styles.walletIllustration}>
            <Ionicons name="wallet" size={56} color="rgba(255,255,255,0.9)" />
            <View style={styles.walletCheck}>
              <Ionicons name="checkmark" size={15} color="#fff" />
            </View>
          </View>

          <View style={styles.balanceLabelRow}>
            <Text style={styles.balanceLabel}>Solde disponible</Text>
            <TouchableOpacity onPress={() => setShowBalance((v) => !v)} hitSlop={10}>
              <Ionicons name={showBalance ? 'eye-outline' : 'eye-off-outline'} size={18} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
          <Text style={styles.balanceAmount}>{showBalance ? formatCurrency(balance) : '••••••••'}</Text>

          <TouchableOpacity style={styles.detailsBtn} onPress={() => router.push('/history' as any)} activeOpacity={0.85}>
            <Text style={styles.detailsBtnText}>Voir les détails</Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 96 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e40af" />
        }
      >
        <View style={styles.body}>
          {/* ─── Tabs Dépôt/Retrait ─── */}
          <View style={[styles.tabs, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.tab, tab === 'deposit' && styles.tabActiveDeposit]}
              onPress={() => setTab('deposit')}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-down" size={18} color={tab === 'deposit' ? '#fff' : colors.textSecondary} />
              <Text style={[styles.tabText, { color: tab === 'deposit' ? '#fff' : colors.textSecondary }]}>Dépôt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'withdraw' && styles.tabActiveWithdraw]}
              onPress={() => setTab('withdraw')}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-up" size={18} color={tab === 'withdraw' ? '#fff' : colors.text} />
              <Text style={[styles.tabText, { color: tab === 'withdraw' ? '#fff' : colors.text }]}>Retrait</Text>
            </TouchableOpacity>
          </View>

          {/* ─── Choix méthode ─── */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Choisissez une méthode</Text>
          <View style={styles.methodsGrid}>
            {METHODS.map((m) => {
              const disabled = tab === 'withdraw' && m.id === 'CARD';
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.methodCard,
                    { backgroundColor: colors.card, borderColor: colors.border, opacity: disabled ? 0.4 : 1 },
                  ]}
                  disabled={disabled}
                  onPress={() => openMethodModal(m.id)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.methodIcon,
                      { backgroundColor: m.color, shadowColor: m.color },
                    ]}
                  >
                    <Ionicons name={m.icon} size={24} color="#fff" />
                  </View>
                  <Text style={[styles.methodName, { color: colors.text }]} numberOfLines={1}>
                    {m.name}
                  </Text>
                  <Text style={[styles.methodDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {m.description}
                  </Text>
                  <View style={[styles.methodChevron, { backgroundColor: colors.borderLight }]}>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ─── Info ─── */}
          <View style={[styles.infoCard, { backgroundColor: colors.borderLight }]}>
            <View style={[styles.infoIconCircle, { backgroundColor: `${colors.primary}1a` }]}>
              <Ionicons name="information" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.infoCardText, { color: colors.textSecondary }]}>
              Cliquez sur une méthode pour ouvrir le formulaire de {tab === 'deposit' ? 'dépôt' : 'retrait'}.
            </Text>
          </View>

          {/* ─── Atouts ─── */}
          <View style={[styles.featuresCard, { backgroundColor: colors.borderLight }]}>
            {[
              { icon: 'shield-checkmark' as const, title: 'Sécurisé', desc: 'Vos transactions sont protégées' },
              { icon: 'flash' as const, title: 'Rapide', desc: 'Dépôt en quelques secondes' },
              { icon: 'headset' as const, title: 'Assistance', desc: "Besoin d'aide ? Contactez-nous" },
            ].map((f) => (
              <View key={f.title} style={styles.featureItem}>
                <View style={[styles.featureIcon, { backgroundColor: `${colors.primary}1a` }]}>
                  <Ionicons name={f.icon} size={16} color={colors.primary} />
                </View>
                <Text style={[styles.featureTitle, { color: colors.text }]}>{f.title}</Text>
                <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <BottomTabBar />

      {/* ============================================================== */}
      {/* MODAL PLEIN ÉCRAN — formulaire de dépôt/retrait par méthode    */}
      {/* ============================================================== */}
      <Modal
        visible={methodModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeMethodModal}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          >
            {/* Header modal */}
            <View style={styles.modalHeaderRow}>
              <TouchableOpacity
                onPress={closeMethodModal}
                disabled={submitting}
                style={styles.backBtn}
              >
                <Ionicons name="arrow-back" size={22} color={colors.text} />
                <Text style={[styles.backText, { color: colors.text }]}>Retour</Text>
              </TouchableOpacity>
              <View
                style={[
                  styles.tonebadge,
                  { backgroundColor: tab === 'deposit' ? '#10b98120' : '#ef444420' },
                ]}
              >
                <Text
                  style={{
                    color: tab === 'deposit' ? '#10b981' : '#ef4444',
                    fontSize: 11,
                    fontWeight: '700',
                  }}
                >
                  {tab === 'deposit' ? 'DÉPÔT' : 'RETRAIT'}
                </Text>
              </View>
            </View>

            {/* Card en-tête méthode */}
            {method && (() => {
              const m = METHODS.find((x) => x.id === method)!;
              return (
                <View
                  style={[
                    styles.methodHeaderCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={[styles.methodIcon, { backgroundColor: m.color, width: 48, height: 48 }]}>
                    <Ionicons name={m.icon} size={24} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.methodName, { color: colors.text, fontSize: 16 }]}>
                      {m.name}
                    </Text>
                    <Text style={[styles.methodDesc, { color: colors.textSecondary }]}>
                      {m.description}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* ==== CARD ==== */}
            {method === 'CARD' && tab === 'deposit' && (
              <>
                {/* Gestion cartes intégrée */}
                <View
                  style={[
                    styles.section2,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="card" size={16} color={colors.primary} />
                      <Text style={[styles.sectionTitle2, { color: colors.text }]}>
                        Mes cartes
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setAddCardComplete(false);
                        setAddCardModal(true);
                      }}
                      style={[styles.addCardBtn, { backgroundColor: colors.primary }]}
                    >
                      <Ionicons name="add" size={14} color="#fff" />
                      <Text style={styles.addCardBtnText}>Ajouter</Text>
                    </TouchableOpacity>
                  </View>

                  {savedCards.length === 0 ? (
                    <View style={[styles.emptyCards, { borderColor: colors.border }]}>
                      <Ionicons name="card-outline" size={26} color={colors.textSecondary} />
                      <Text style={[styles.emptyCardsText, { color: colors.textSecondary }]}>
                        Aucune carte enregistrée
                      </Text>
                      <Text style={[styles.emptyCardsHint, { color: colors.textSecondary }]}>
                        Cliquez "Ajouter" pour enregistrer votre première carte.
                      </Text>
                    </View>
                  ) : (
                    <>
                      {savedCards.map((c) => {
                        const selected = !useNewCard && selectedCardId === c.id;
                        return (
                          <View
                            key={c.id}
                            style={[
                              styles.savedCardRow,
                              {
                                backgroundColor: colors.background,
                                borderColor: selected ? colors.primary : colors.border,
                                borderWidth: selected ? 2 : 1,
                              },
                            ]}
                          >
                            <TouchableOpacity
                              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                              onPress={() => {
                                setUseNewCard(false);
                                setSelectedCardId(c.id);
                              }}
                            >
                              <View style={[styles.savedCardIcon, { backgroundColor: `${colors.primary}20` }]}>
                                <Ionicons name="card" size={18} color={colors.primary} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.savedCardBrand, { color: colors.text }]}>
                                  {c.brand?.toUpperCase()} •••• {c.last4}
                                </Text>
                                <Text style={[styles.savedCardExp, { color: colors.textSecondary }]}>
                                  Expire {c.expiration}
                                  {c.isDefault ? ' · Par défaut' : ''}
                                </Text>
                              </View>
                              {selected && (
                                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                              )}
                            </TouchableOpacity>
                            {!c.isDefault && (
                              <TouchableOpacity
                                onPress={() => setDefaultCard(c.id)}
                                style={styles.iconBtn}
                              >
                                <Ionicons name="star-outline" size={18} color="#f59e0b" />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => removeCard(c.id)} style={styles.iconBtn}>
                              <Ionicons name="trash-outline" size={18} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                      <TouchableOpacity
                        style={[
                          styles.savedCardRow,
                          {
                            backgroundColor: colors.background,
                            borderColor: useNewCard ? colors.primary : colors.border,
                            borderWidth: useNewCard ? 2 : 1,
                          },
                        ]}
                        onPress={() => {
                          setUseNewCard(true);
                          setSelectedCardId(null);
                        }}
                      >
                        <Ionicons
                          name="add-circle-outline"
                          size={22}
                          color={useNewCard ? colors.primary : colors.textSecondary}
                        />
                        <Text style={{ flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' }}>
                          Utiliser une autre carte (à saisir)
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {/* Champ carte si "nouvelle carte" sélectionnée */}
                {useNewCard && (
                  <View
                    style={[
                      styles.section2,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.label, { color: colors.textSecondary }]}>
                      SAISISSEZ VOTRE CARTE
                    </Text>
                    <CardField
                      postalCodeEnabled={false}
                      placeholders={{ number: '4242 4242 4242 4242' }}
                      cardStyle={{
                        backgroundColor: colors.background,
                        textColor: colors.text,
                        placeholderColor: colors.textSecondary,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: 12,
                      }}
                      style={{ width: '100%', height: 50, marginTop: 4 }}
                      onCardChange={(d) => setCardComplete(d.complete)}
                    />
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 8 }}>
                      Carte de test : 4242 4242 4242 4242 — date future, CVC 123
                    </Text>
                  </View>
                )}

                {/* Montant */}
                <View
                  style={[
                    styles.section2,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.label, { color: colors.textSecondary }]}>MONTANT (Ar)</Text>
                  <TextInput
                    style={[styles.input, styles.amountInput, { color: colors.text, borderColor: colors.border }]}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                    Minimum : 100 Ar
                  </Text>
                </View>
              </>
            )}

            {/* ==== MOBILE_MONEY ==== */}
            {method === 'MOBILE_MONEY' && (
              <View
                style={[
                  styles.section2,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.label, { color: colors.textSecondary }]}>OPÉRATEUR</Text>
                <View style={styles.row}>
                  {['mvola', 'orange', 'airtel'].map((op) => (
                    <TouchableOpacity
                      key={op}
                      style={[
                        styles.pill,
                        { borderColor: colors.border },
                        details.operator === op && { backgroundColor: '#10b981', borderColor: '#10b981' },
                      ]}
                      onPress={() => setDetails({ ...details, operator: op })}
                    >
                      <Text
                        style={{
                          color: details.operator === op ? '#fff' : colors.text,
                          fontWeight: '600',
                          fontSize: 12,
                        }}
                      >
                        {op.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>
                  NUMÉRO MOBILE MONEY
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  value={details.phoneNumber || ''}
                  onChangeText={(t) => setDetails({ ...details, phoneNumber: t })}
                  placeholder="0343500004"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                  maxLength={13}
                />
                <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4 }}>
                  Format : 10 chiffres, préfixe 032/033/034/038. Sandbox MVola : 0343500004.
                </Text>

                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>
                  MONTANT (Ar)
                </Text>
                <TextInput
                  style={[styles.input, styles.amountInput, { color: colors.text, borderColor: colors.border }]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>
            )}

            {/* ==== BANK ==== */}
            {method === 'BANK' && (
              <View
                style={[
                  styles.section2,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.label, { color: colors.textSecondary }]}>BANQUE</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  value={details.bankName || ''}
                  onChangeText={(t) => setDetails({ ...details, bankName: t })}
                  placeholder="BNI, BFV, BOA..."
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>
                  NUMÉRO DE COMPTE
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  value={details.accountNumber || ''}
                  onChangeText={(t) => setDetails({ ...details, accountNumber: t })}
                  placeholder="00012 3456 78901234567"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>
                  MONTANT (Ar)
                </Text>
                <TextInput
                  style={[styles.input, styles.amountInput, { color: colors.text, borderColor: colors.border }]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>
            )}

            {/* ==== CASH ==== */}
            {method === 'CASH' && (
              <View
                style={[
                  styles.section2,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={[styles.infoBox, { backgroundColor: '#f59e0b15', borderColor: '#f59e0b' }]}>
                  <Ionicons name="information-circle" size={18} color="#f59e0b" />
                  <Text style={[styles.infoText, { color: colors.text }]}>
                    Après création, un agent M'Paye vous contactera avec un code à présenter
                    pour {tab === 'deposit' ? 'déposer' : 'retirer'} en espèces.
                  </Text>
                </View>
                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>
                  MONTANT (Ar)
                </Text>
                <TextInput
                  style={[styles.input, styles.amountInput, { color: colors.text, borderColor: colors.border }]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>
            )}

            {/* Bouton submit */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: tab === 'deposit' ? '#1e40af' : '#ef4444' },
                submitting && { opacity: 0.6 },
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={method === 'CARD' ? 'lock-closed' : 'checkmark'}
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.submitText}>
                    {method === 'CARD' && tab === 'deposit'
                      ? `Payer ${parseFloat(amount || '0').toLocaleString('fr-FR')} Ar`
                      : tab === 'deposit'
                        ? 'Demander un dépôt'
                        : 'Demander un retrait'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {submitting &&
              tab === 'deposit' &&
              method === 'MOBILE_MONEY' &&
              (details.operator === 'mvola' || details.operator === 'airtel') && (
                <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 8, textAlign: 'center' }}>
                  📲 Validez sur votre téléphone (push USSD{' '}
                  {details.operator === 'mvola' ? 'MVola' : 'Airtel'})…{'\n'}
                  Attente du verdict opérateur, peut prendre jusqu'à 30s.
                </Text>
              )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL ajout d'une carte (SetupIntent autonome)                  */}
      {/* ============================================================== */}
      <Modal
        visible={addCardModal}
        transparent
        animationType="slide"
        onRequestClose={() => !savingCard && setAddCardModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Ajouter une carte</Text>
              <TouchableOpacity
                onPress={() => !savingCard && setAddCardModal(false)}
                disabled={savingCard}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <CardField
              postalCodeEnabled={false}
              placeholders={{ number: '4242 4242 4242 4242' }}
              cardStyle={{
                backgroundColor: colors.background,
                textColor: colors.text,
                placeholderColor: colors.textSecondary,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
              }}
              style={styles.cardField}
              onCardChange={(d) => setAddCardComplete(d.complete)}
            />

            <View style={styles.secureRow}>
              <Ionicons name="lock-closed-outline" size={13} color={colors.textSecondary} />
              <Text style={[styles.secureText, { color: colors.textSecondary }]}>
                Carte tokenisée par Stripe — données jamais stockées chez nous.
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                {
                  backgroundColor: addCardComplete ? colors.primary : colors.border,
                  marginTop: 12,
                },
              ]}
              onPress={addNewCard}
              disabled={!addCardComplete || savingCard}
            >
              {savingCard ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={styles.submitText}>Enregistrer la carte</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getInstructions(method: PaymentRequestMethod, tab: Tab, ref: string): string {
  if (method === 'MOBILE_MONEY') {
    return tab === 'deposit'
      ? `Envoyez le montant via votre opérateur en mentionnant la référence ${ref}. Un admin validera sous 24h.`
      : `Vous recevrez le montant sur votre numéro mobile money après validation admin.`;
  }
  if (method === 'BANK') {
    return tab === 'deposit'
      ? `Effectuez le virement vers le compte M'Paye et indiquez la référence ${ref}.`
      : `L'admin effectuera le virement vers votre compte bancaire après validation.`;
  }
  if (method === 'CASH') return `Un agent vous contactera. Présentez le code ${ref}.`;
  return 'Demande en attente de validation.';
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ─── Header bleu ───
  header: {
    paddingHorizontal: 16,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 4 },
  headerBackBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 1 },
  headerHelpBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Corps ───
  body: { paddingHorizontal: 16, paddingTop: 20 },

  // ─── Carte solde (panneau translucide dans le bloc bleu) ───
  balanceCard: {
    padding: 18,
    borderRadius: 20,
    marginTop: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  balanceDecor: {
    position: 'absolute',
    top: -50,
    left: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  walletIllustration: {
    position: 'absolute',
    top: 24,
    right: 20,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletCheck: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  balanceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },
  balanceAmount: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 6, letterSpacing: 0.3 },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 16,
  },
  detailsBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // ─── Tabs ───
  tabs: {
    flexDirection: 'row',
    padding: 5,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  tabActiveDeposit: {
    backgroundColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabActiveWithdraw: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabText: { fontWeight: '700', fontSize: 15 },

  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  sectionTitle2: { fontSize: 14, fontWeight: '700' },
  hint: { fontSize: 11, textAlign: 'center', marginTop: 8 },

  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  methodCard: {
    width: '47.8%',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 160,
  },
  methodIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  methodName: { fontWeight: '700', fontSize: 15, marginBottom: 4 },
  methodDesc: { fontSize: 12, lineHeight: 16 },
  methodChevron: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Info ───
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    marginTop: 18,
  },
  infoIconCircle: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  infoCardText: { flex: 1, fontSize: 13, lineHeight: 18 },

  // ─── Atouts ───
  featuresCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    marginTop: 12,
    gap: 8,
  },
  featureItem: { flex: 1, alignItems: 'flex-start' },
  featureIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  featureTitle: { fontSize: 12, fontWeight: '700' },
  featureDesc: { fontSize: 10, lineHeight: 13, marginTop: 2 },

  // === Modal plein écran ===
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  backText: { fontSize: 14, fontWeight: '600' },
  tonebadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  methodHeaderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12,
  },

  section2: {
    padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  addCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addCardBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  input: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14,
  },
  amountInput: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1 },

  infoBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12, marginTop: 4,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // === Cards ===
  savedCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  savedCardIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  savedCardBrand: { fontSize: 13, fontWeight: '700' },
  savedCardExp: { fontSize: 11, marginTop: 2 },
  iconBtn: { padding: 6 },
  emptyCards: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyCardsText: { fontSize: 13, fontWeight: '600' },
  emptyCardsHint: { fontSize: 11, textAlign: 'center' },

  // === Modal ajout carte (overlay) ===
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', padding: 20,
  },
  modalCard: { borderRadius: 18, padding: 20, gap: 12 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  cardField: { width: '100%', height: 50, marginTop: 4 },
  secureRow: {
    flexDirection: 'row', gap: 8,
    marginTop: 8, paddingHorizontal: 4,
    alignItems: 'flex-start',
  },
  secureText: { flex: 1, fontSize: 11, lineHeight: 14 },
});

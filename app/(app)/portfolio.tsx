// app/(app)/portfolio.tsx — Dépôt / Retrait avec PaymentRequest (Stripe carte 100% auto)
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  CardField,
  useStripe,
  useConfirmSetupIntent,
} from '@stripe/stripe-react-native';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useWallet } from '../../src/contexts/WalletContext';
import { useSocket } from '../../src/contexts/SocketContext';
import { useBiometricGuard } from '../../src/contexts/BiometricGuardContext';
import { useLocale } from '../../src/contexts/LocaleContext';
import GradientHeader from '../../src/components/GradientHeader';
import {
  paymentApi,
  PaymentRequest,
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

const STATUS_META: Record<string, { color: string; label: string; icon: string }> = {
  PENDING: { color: '#f59e0b', label: 'EN ATTENTE', icon: 'time-outline' },
  PROCESSING: { color: '#3b82f6', label: 'EN COURS', icon: 'sync-outline' },
  APPROVED: { color: '#10b981', label: 'APPROUVÉ', icon: 'checkmark-circle' },
  REJECTED: { color: '#ef4444', label: 'REJETÉ', icon: 'close-circle' },
  CANCELLED: { color: '#9ca3af', label: 'ANNULÉ', icon: 'ban' },
  EXPIRED: { color: '#9ca3af', label: 'EXPIRÉ', icon: 'hourglass' },
};

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
  const [amount, setAmount] = useState('');
  const [details, setDetails] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stripe carte : modal de saisie + cartes enregistrées
  const [cardModal, setCardModal] = useState(false);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [useNewCard, setUseNewCard] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  useEffect(() => {
    cardsApi
      .list()
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        setSavedCards(list);
        if (list.length === 0) setUseNewCard(true);
      })
      .catch(() => setUseNewCard(true));
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const res = await paymentApi.listMine();
      setRequests(res.data);
    } catch (e: any) {
      console.error('Erreur chargement requests', e?.response?.data || e?.message);
    } finally {
      setLoadingRequests(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Refresh auto sur notification de paiement
  useEffect(() => {
    const unsub = onNotification((n) => {
      if (
        n.type === 'DEPOSIT_SUCCESS' ||
        n.type === 'PAYMENT_SUCCESS' ||
        n.type === 'PAYMENT_FAILED' ||
        n.actionType === 'PAYMENT_REQUEST'
      ) {
        loadRequests();
        fetchBalance();
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
    fetchBalance();
  };

  const reset = () => {
    setMethod(null);
    setAmount('');
    setDetails({});
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
      // Validation format Madagascar : 10 chiffres commençant par 032/033/034/038
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
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      Alert.alert('Erreur', err);
      return;
    }

    const amt = parseFloat(amount);

    // Biométrie pour montants > 50000
    if (amt > 50000) {
      const ok = await requireBiometric(
        `Confirmez votre ${tab === 'deposit' ? 'dépôt' : 'retrait'} de ${amt.toLocaleString('fr-FR')} Ar`,
      );
      if (!ok) return;
    }

    // Cas spécial CARD pour dépôt → ouvre la modale Stripe (flux auto)
    if (tab === 'deposit' && method === 'CARD') {
      setCardComplete(false);
      setCardModal(true);
      return;
    }

    // Cas spécial MOBILE_MONEY + opérateurs auto (MVola, Airtel)
    // Le backend attend le verdict opérateur (polling 30s) avant de répondre.
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
          Alert.alert(
            'Dépôt réussi ✅',
            `${amt.toLocaleString('fr-FR')} Ar crédités sur votre wallet.\nRéférence : ${res.data.reference}`,
            [{ text: 'OK', onPress: () => { reset(); loadRequests(); } }],
          );
        } else if (status === 'FAILED') {
          Alert.alert(
            `Dépôt ${auto.label} refusé ❌`,
            `${res.data.message ?? auto.label + ' a refusé la transaction.'}\nRéférence : ${res.data.reference}`,
            [{ text: 'OK', onPress: () => loadRequests() }],
          );
        } else {
          // PENDING (timeout polling)
          Alert.alert(
            `En attente ${auto.label} ⏳`,
            `${res.data.message ?? auto.label + ' met du temps à confirmer.'}\nRéférence : ${res.data.reference}\n\nRefresh dans quelques minutes pour voir le statut final.`,
            [{ text: 'OK', onPress: () => { reset(); loadRequests(); } }],
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

    setSubmitting(true);
    try {
      // Cas universel → PaymentRequest avec validation admin
      const res = await paymentApi.create({
        type: tab === 'deposit' ? 'DEPOSIT' : 'WITHDRAWAL',
        method: method!,
        amount: amt,
        details: Object.keys(details).length > 0 ? details : undefined,
      });

      const instructions = getInstructions(method!, tab, res.data);
      Alert.alert(
        `Demande créée ✅`,
        `Référence : ${res.data.reference}\n\n${instructions}`,
        [{ text: 'Voir mes demandes', onPress: () => { reset(); loadRequests(); } }],
      );
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Échec de la demande');
    } finally {
      setSubmitting(false);
    }
  };

  /** Dépôt CARTE réel via Stripe (SetupIntent → save → PaymentIntent → confirm → crédit). */
  const doCardDeposit = async (amt: number): Promise<string> => {
    if (!cardComplete) throw new Error('Carte incomplète');
    const setup = await cardsApi.createSetupIntent();
    const { setupIntent, error: setupErr } = await confirmSetupIntent(
      setup.data.clientSecret,
      { paymentMethodType: 'Card' },
    );
    if (setupErr) throw new Error(setupErr.message || 'Échec enregistrement carte');
    const pmId = setupIntent?.paymentMethod?.id;
    if (!pmId) throw new Error('Carte non tokenisée');
    try { await cardsApi.saveCard(pmId); } catch {}
    const intent = await paymentApi.createStripeIntent(amt);
    const clientSecret = intent.data.clientSecret;
    if (!clientSecret) throw new Error('Pas de clientSecret');
    const { paymentIntent, error } = await confirmPayment(clientSecret, {
      paymentMethodType: 'Card',
      paymentMethodData: { paymentMethodId: pmId } as any,
    });
    if (error) throw new Error(error.message || 'Paiement refusé');
    if (paymentIntent?.status !== 'Succeeded') {
      throw new Error(`Statut Stripe: ${paymentIntent?.status ?? 'inconnu'}`);
    }
    const confirmed = await paymentApi.confirmStripeDeposit(
      intent.data.paymentRequestId,
    );
    return confirmed.data.reference;
  };

  const handleCardModalConfirm = async () => {
    const amt = parseFloat(amount);
    setSubmitting(true);
    try {
      const ref = await doCardDeposit(amt);
      setCardModal(false);
      reset();
      await fetchBalance();
      await loadRequests();
      Alert.alert(
        'Dépôt réussi ✅',
        `${amt.toLocaleString('fr-FR')} Ar crédités sur votre wallet.\nRéférence : ${ref}`,
      );
    } catch (e: any) {
      Alert.alert('Échec dépôt', e?.message || 'Erreur lors du paiement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = (id: string) => {
    Alert.alert('Annuler la demande', 'Confirmer ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        style: 'destructive',
        onPress: async () => {
          try {
            await paymentApi.cancel(id);
            loadRequests();
          } catch (e: any) {
            Alert.alert('Erreur', e?.response?.data?.message || 'Annulation impossible');
          }
        },
      },
    ]);
  };

  const formatAmount = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title="Mon Portefeuille"
        subtitle="Dépôt et retrait — données 100% réelles"
        rightIcon="time-outline"
        onRightPress={() => router.push('/history' as any)}
      />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e40af" />
        }
      >
        <View style={{ padding: 16 }}>
          {/* Solde */}
          <View style={[styles.balanceCard, { backgroundColor: '#1e40af' }]}>
            <Text style={styles.balanceLabel}>Solde disponible</Text>
            <Text style={styles.balanceAmount}>{formatCurrency(balance)}</Text>
          </View>

          {/* Tabs */}
          <View style={[styles.tabs, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.tab,
                tab === 'deposit' && { backgroundColor: '#1e40af' },
              ]}
              onPress={() => { setTab('deposit'); reset(); }}
            >
              <Ionicons name="arrow-down-outline" size={18} color={tab === 'deposit' ? '#fff' : colors.textSecondary} />
              <Text style={[styles.tabText, { color: tab === 'deposit' ? '#fff' : colors.textSecondary }]}>
                Dépôt
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                tab === 'withdraw' && { backgroundColor: '#ef4444' },
              ]}
              onPress={() => { setTab('withdraw'); reset(); }}
            >
              <Ionicons name="arrow-up-outline" size={18} color={tab === 'withdraw' ? '#fff' : colors.textSecondary} />
              <Text style={[styles.tabText, { color: tab === 'withdraw' ? '#fff' : colors.textSecondary }]}>
                Retrait
              </Text>
            </TouchableOpacity>
          </View>

          {/* Méthodes */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Méthode
          </Text>
          {METHODS.map((m) => {
            const selected = method === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.methodCard,
                  { backgroundColor: colors.card, borderColor: selected ? m.color : colors.border, borderWidth: selected ? 2 : 1 },
                ]}
                onPress={() => setMethod(m.id)}
              >
                <View style={[styles.methodIcon, { backgroundColor: m.color }]}>
                  <Ionicons name={m.icon} size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.methodName, { color: colors.text }]}>{m.name}</Text>
                  <Text style={[styles.methodDesc, { color: colors.textSecondary }]}>{m.description}</Text>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={22} color={m.color} />}
              </TouchableOpacity>
            );
          })}

          {/* Formulaire spécifique */}
          {method && (
            <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Mobile Money : operator + numéro */}
              {method === 'MOBILE_MONEY' && (
                <>
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
                        <Text style={{ color: details.operator === op ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>
                          {op.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>NUMÉRO MOBILE MONEY</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    value={details.phoneNumber || ''}
                    onChangeText={(t) => setDetails({ ...details, phoneNumber: t })}
                    placeholder="0343500004 (sandbox test)"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="phone-pad"
                    maxLength={13}
                  />
                  <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4 }}>
                    Format : 10 chiffres, préfixe 032/033/034/038. Pour tester MVola sandbox : 0343500004
                  </Text>
                </>
              )}

              {/* Bank : banque + RIB */}
              {method === 'BANK' && (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>BANQUE</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    value={details.bankName || ''}
                    onChangeText={(t) => setDetails({ ...details, bankName: t })}
                    placeholder="BNI, BFV, BOA..."
                    placeholderTextColor={colors.textSecondary}
                  />
                  <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>NUMÉRO DE COMPTE</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    value={details.accountNumber || ''}
                    onChangeText={(t) => setDetails({ ...details, accountNumber: t })}
                    placeholder="00012 3456 78901234567"
                    placeholderTextColor={colors.textSecondary}
                  />
                </>
              )}

              {/* CASH : juste info */}
              {method === 'CASH' && (
                <View style={[styles.infoBox, { backgroundColor: '#f59e0b15', borderColor: '#f59e0b' }]}>
                  <Ionicons name="information-circle" size={18} color="#f59e0b" />
                  <Text style={[styles.infoText, { color: colors.text }]}>
                    Après création, un agent M'Paye vous contactera avec un code à présenter
                    pour {tab === 'deposit' ? 'déposer' : 'retirer'} en espèces.
                  </Text>
                </View>
              )}

              {/* CARD : info Stripe */}
              {method === 'CARD' && (
                <View style={[styles.infoBox, { backgroundColor: '#3b82f615', borderColor: '#3b82f6' }]}>
                  <Ionicons name="lock-closed" size={18} color="#3b82f6" />
                  <Text style={[styles.infoText, { color: colors.text }]}>
                    Paiement sécurisé par Stripe. {tab === 'withdraw' ? "Pour le retrait, utilisez Mobile Money ou Bank." : "Vous serez redirigé pour saisir votre carte."}
                  </Text>
                </View>
              )}

              {/* Montant */}
              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>MONTANT (Ar)</Text>
              <TextInput
                style={[styles.input, styles.amountInput, { color: colors.text, borderColor: colors.border }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />

              {/* Bouton submit */}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { backgroundColor: tab === 'deposit' ? '#1e40af' : '#ef4444' },
                  (submitting || (tab === 'withdraw' && method === 'CARD')) && { opacity: 0.5 },
                ]}
                onPress={handleSubmit}
                disabled={submitting || (tab === 'withdraw' && method === 'CARD')}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.submitText}>
                      {tab === 'deposit' ? 'Demander un dépôt' : 'Demander un retrait'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Message contextuel pendant l'attente opérateur (peut prendre 30s) */}
              {submitting &&
                tab === 'deposit' &&
                method === 'MOBILE_MONEY' &&
                (details.operator === 'mvola' || details.operator === 'airtel') && (
                  <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 8, textAlign: 'center' }}>
                    📲 Validez sur votre téléphone (push USSD {details.operator === 'mvola' ? 'MVola' : 'Airtel'})…{'\n'}
                    Attente du verdict opérateur, peut prendre jusqu'à 30s.
                  </Text>
                )}

              {tab === 'withdraw' && method === 'CARD' && (
                <Text style={{ color: '#ef4444', fontSize: 11, marginTop: 8, textAlign: 'center' }}>
                  Retrait par carte non supporté — utilisez Mobile Money ou Bank.
                </Text>
              )}
            </View>
          )}

          {/* Mes demandes */}
          <View style={{ marginTop: 24, marginBottom: 8 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Mes demandes récentes
            </Text>
          </View>

          {loadingRequests ? (
            <ActivityIndicator color="#1e40af" />
          ) : requests.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="document-outline" size={36} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Aucune demande pour le moment
              </Text>
            </View>
          ) : (
            requests.map((r) => {
              const meta = STATUS_META[r.status];
              return (
                <View
                  key={r.id}
                  style={[styles.requestCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.requestTop}>
                    <View>
                      <Text style={[styles.requestRef, { color: colors.text }]}>{r.reference}</Text>
                      <Text style={[styles.requestMeta, { color: colors.textSecondary }]}>
                        {r.type === 'DEPOSIT' ? 'Dépôt' : 'Retrait'} · {r.method}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: meta.color + '20' }]}>
                      <Ionicons name={meta.icon as any} size={12} color={meta.color} />
                      <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>
                  <View style={styles.requestBottom}>
                    <Text style={[styles.requestAmount, { color: colors.text }]}>
                      {formatAmount(Number(r.amount))} Ar
                    </Text>
                    <Text style={[styles.requestDate, { color: colors.textSecondary }]}>
                      {new Date(r.createdAt).toLocaleString('fr-FR', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  {r.rejectionReason && (
                    <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                      Raison : {r.rejectionReason}
                    </Text>
                  )}
                  {r.status === 'PENDING' && (
                    <TouchableOpacity
                      style={[styles.cancelBtn, { borderColor: colors.border }]}
                      onPress={() => handleCancel(r.id)}
                    >
                      <Text style={[styles.cancelText, { color: colors.text }]}>Annuler</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ─────────── Modal Stripe : dépôt carte 100% auto ─────────── */}
      <Modal
        visible={cardModal}
        transparent
        animationType="slide"
        onRequestClose={() => !submitting && setCardModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Dépôt par carte — {parseFloat(amount || '0').toLocaleString('fr-FR')} Ar
              </Text>
              <TouchableOpacity
                onPress={() => !submitting && setCardModal(false)}
                disabled={submitting}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {savedCards.length > 0 && !useNewCard ? (
              <>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  CARTE ENREGISTRÉE
                </Text>
                {savedCards.map((c) => (
                  <View
                    key={c.id}
                    style={[styles.savedCardRow, { borderColor: colors.border }]}
                  >
                    <Ionicons name="card" size={20} color="#3b82f6" />
                    <Text style={{ color: colors.text, flex: 1 }}>
                      {c.brand?.toUpperCase()} •••• {c.last4}
                    </Text>
                    {c.isDefault && (
                      <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                        défaut
                      </Text>
                    )}
                  </View>
                ))}
                <TouchableOpacity onPress={() => setUseNewCard(true)}>
                  <Text style={{ color: '#3b82f6', fontSize: 13, marginTop: 4 }}>
                    + Utiliser une nouvelle carte
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 6 }}>
                  💡 Aujourd'hui on resaisit la carte à chaque dépôt.
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
                  style={{ width: '100%', height: 50, marginTop: 8 }}
                  onCardChange={(d) => setCardComplete(d.complete)}
                />
              </>
            ) : (
              <>
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
                  💡 Carte de test : 4242 4242 4242 4242 — date future, CVC 123
                </Text>
              </>
            )}

            <TouchableOpacity
              style={[
                styles.modalConfirmBtn,
                { backgroundColor: '#1e40af' },
                (!cardComplete || submitting) && { opacity: 0.5 },
              ]}
              onPress={handleCardModalConfirm}
              disabled={!cardComplete || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="lock-closed" size={18} color="#fff" />
                  <Text style={styles.submitText}>Payer & créditer mon wallet</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getInstructions(method: PaymentRequestMethod, tab: Tab, r: PaymentRequest): string {
  if (method === 'MOBILE_MONEY') {
    return tab === 'deposit'
      ? `Envoyez le montant via votre opérateur en mentionnant la référence ${r.reference}. Un admin validera sous 24h.`
      : `Vous recevrez le montant sur votre numéro mobile money après validation admin.`;
  }
  if (method === 'BANK') {
    return tab === 'deposit'
      ? `Effectuez le virement vers le compte M'Paye et indiquez la référence ${r.reference}.`
      : `L'admin effectuera le virement vers votre compte bancaire après validation.`;
  }
  if (method === 'CASH') {
    return `Un agent vous contactera. Présentez le code ${r.reference}.`;
  }
  return 'Demande en attente de validation.';
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  balanceCard: {
    padding: 20,
    borderRadius: 18,
    marginBottom: 16,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  balanceAmount: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 8 },

  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 10,
  },
  tabText: { fontWeight: '700', fontSize: 14 },

  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 4 },

  methodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, marginBottom: 10,
  },
  methodIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  methodName: { fontWeight: '700', fontSize: 14 },
  methodDesc: { fontSize: 11, marginTop: 2 },

  formCard: {
    padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 12,
  },
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
    padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 4,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12, marginTop: 16,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  emptyBox: {
    alignItems: 'center', padding: 32, borderRadius: 14, borderWidth: 1, gap: 8,
  },
  emptyText: { fontSize: 13 },

  requestCard: {
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  requestTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestRef: { fontSize: 13, fontWeight: '700' },
  requestMeta: { fontSize: 11, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  requestBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8,
  },
  requestAmount: { fontSize: 16, fontWeight: '800' },
  requestDate: { fontSize: 11 },
  cancelBtn: {
    marginTop: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center',
  },
  cancelText: { fontSize: 12, fontWeight: '600' },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', padding: 20,
  },
  modalCard: {
    borderRadius: 18, padding: 20, gap: 12,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  savedCardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1,
  },
  modalConfirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12, marginTop: 12,
  },
});

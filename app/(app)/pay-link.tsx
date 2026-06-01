// app/(app)/pay-link.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useStripe } from '@stripe/stripe-react-native';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useBiometricGuard } from '../../src/contexts/BiometricGuardContext';
import { useWallet } from '../../src/contexts/WalletContext';
import {
  merchantApi,
  type PublicPaymentLink,
} from '../../src/services/merchantApi';
import { cardsApi, type SavedCard } from '../../src/services/cardsApi';

function randomKey() {
  // expo-crypto non garanti ici : clé pseudo-unique suffisante pour l'idempotence
  return `pl-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export default function PayLink() {
  const { reference } = useLocalSearchParams<{ reference: string }>();
  const ref = Array.isArray(reference) ? reference[0] : reference || '';
  const router = useRouter();
  const { colors } = useTheme();
  const { requireBiometric } = useBiometricGuard();
  const { fetchBalance } = useWallet();
  const { handleNextAction } = useStripe();

  const [link, setLink] = useState<PublicPaymentLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Source de paiement : 'WALLET' ou l'id d'une carte enregistrée
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [source, setSource] = useState<string>('WALLET');

  const idempotencyKey = useMemo(() => randomKey(), [ref]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await merchantApi.getPublicPaymentLink(ref);
        if (active) setLink(r.data);
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    cardsApi
      .list()
      .then((r) => {
        if (!active) return;
        const list = Array.isArray(r.data) ? r.data : [];
        setCards(list);
        const def = list.find((c) => c.isDefault);
        if (def) setSource(def.id);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ref]);

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

  const mgaEq = (display: number): number | null =>
    link && link.devise !== 'MGA' && link.fxRate ? display * link.fxRate : null;

  const pay = async () => {
    if (!link) return;
    const amt = link.openAmount ? Number(amount) : link.amount ?? 0;
    if (link.openAmount && (!amt || amt <= 0)) {
      setErr('Saisissez un montant');
      return;
    }
    const mga = mgaEq(amt);
    const prompt =
      link.devise === 'MGA'
        ? `Confirmez le paiement de ${fmt(amt)} Ar`
        : `Confirmez le paiement de ${amt} ${link.devise}${
            mga ? ` (≈ ${fmt(mga)} Ar)` : ''
          }`;
    const ok = await requireBiometric(prompt);
    if (!ok) return;

    setBusy(true);
    setErr(null);
    try {
      let coords: { lat: number; lng: number } | undefined;
      if (link.requiresLocation) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErr('Localisation requise pour payer sur place (autorisez l’accès).');
          setBusy(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }

      const isCard = source !== 'WALLET';
      const res = await merchantApi.payPaymentLink(ref, {
        amount: link.openAmount ? amt : undefined,
        idempotencyKey,
        lat: coords?.lat,
        lng: coords?.lng,
        source: isCard ? 'CARD' : 'WALLET',
        paymentMethodId: isCard ? source : undefined,
      });

      // 3DS : authentification requise pour la carte
      if (res.data.requiresAction && res.data.clientSecret) {
        const { error } = await handleNextAction(res.data.clientSecret);
        if (error) {
          setErr(error.message || 'Authentification de la carte échouée');
          setBusy(false);
          return;
        }
        await merchantApi.confirmCardPaymentLink(ref, {
          paymentIntentId: res.data.paymentIntentId!,
          amount: link.openAmount ? amt : undefined,
          lat: coords?.lat,
          lng: coords?.lng,
          source: 'CARD',
          paymentMethodId: source,
        });
      }
      await fetchBalance();
      setDone(true);
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Échec du paiement');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (notFound || !link) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="close-circle-outline" size={56} color="#ef4444" />
        <Text style={[styles.title, { color: colors.text }]}>Lien introuvable</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Ce lien de paiement n'existe pas ou a été supprimé.
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.linkText, { color: colors.primary }]}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (done) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="checkmark-circle" size={64} color="#10b981" />
        <Text style={[styles.title, { color: colors.text }]}>Paiement réussi</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Vous avez payé{' '}
          {link.devise === 'MGA'
            ? `Ar ${fmt(link.openAmount ? Number(amount) : link.amount ?? 0)}`
            : `${link.openAmount ? Number(amount) : link.amount} ${link.devise}`}{' '}
          à {link.merchantName}.
        </Text>
        <TouchableOpacity
          style={[styles.payBtn, { backgroundColor: colors.primary, marginTop: 20 }]}
          onPress={() => router.replace('/(app)/(tabs)/history' as any)}
        >
          <Text style={styles.payBtnText}>Voir mes transactions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const unavailable = link.status !== 'ACTIVE';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.merchantHead}>
        {link.merchantLogo ? (
          <Image source={{ uri: link.merchantLogo }} style={styles.logo} />
        ) : (
          <View style={[styles.logo, { backgroundColor: `${colors.primary}20`, alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="storefront" size={28} color={colors.primary} />
          </View>
        )}
        <Text style={[styles.merchantName, { color: colors.text }]}>{link.merchantName}</Text>
        {link.storeName ? (
          <Text style={[styles.sub, { color: colors.textSecondary }]}>{link.storeName}</Text>
        ) : null}
      </View>

      {link.label ? (
        <Text style={[styles.label, { color: colors.text }]}>{link.label}</Text>
      ) : null}
      {link.description ? (
        <Text style={[styles.desc, { color: colors.textSecondary }]}>{link.description}</Text>
      ) : null}

      {unavailable ? (
        <Text style={[styles.unavailable, { color: colors.textSecondary }]}>
          Ce lien de paiement n'est plus disponible.
        </Text>
      ) : (
        <>
          {link.openAmount ? (
            <View style={{ marginVertical: 24 }}>
              <TextInput
                style={[styles.amountInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, marginVertical: 0 }]}
                placeholder={`Montant (${link.devise})`}
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />
              {link.devise !== 'MGA' &&
                Number(amount) > 0 &&
                mgaEq(Number(amount)) != null && (
                  <Text style={[styles.secure, { color: colors.textSecondary, marginTop: 8 }]}>
                    ≈ Ar {fmt(mgaEq(Number(amount)) as number)} prélevés
                  </Text>
                )}
            </View>
          ) : link.devise === 'MGA' ? (
            <Text style={[styles.bigAmount, { color: colors.text }]}>
              Ar {fmt(link.amount ?? 0)}
            </Text>
          ) : (
            <View style={{ marginVertical: 24, alignItems: 'center' }}>
              <Text style={[styles.bigAmount, { color: colors.text, marginVertical: 0 }]}>
                {link.amount} {link.devise}
              </Text>
              {link.mgaAmount != null && (
                <Text style={[styles.sub, { color: colors.textSecondary, marginTop: 4 }]}>
                  ≈ Ar {fmt(link.mgaAmount)} prélevés
                </Text>
              )}
            </View>
          )}

          {/* Source de paiement */}
          <Text style={[styles.sourceLabel, { color: colors.textSecondary }]}>Payer avec</Text>
          <View style={styles.sourceList}>
            <TouchableOpacity
              style={[
                styles.sourceOption,
                { borderColor: colors.border, backgroundColor: colors.card },
                source === 'WALLET' && { borderColor: colors.primary },
              ]}
              onPress={() => setSource('WALLET')}
            >
              <Ionicons name="wallet-outline" size={18} color={colors.primary} />
              <Text style={[styles.sourceText, { color: colors.text }]}>Mon solde M'Paye</Text>
              {source === 'WALLET' && (
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
            {cards.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.sourceOption,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  source === c.id && { borderColor: colors.primary },
                ]}
                onPress={() => setSource(c.id)}
              >
                <Ionicons name="card-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.sourceText, { color: colors.text }]}>
                  {c.brand?.toUpperCase()} •••• {c.last4}
                </Text>
                {source === c.id && (
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {err ? <Text style={styles.error}>{err}</Text> : null}

          <TouchableOpacity
            style={[styles.payBtn, { backgroundColor: colors.primary }]}
            onPress={pay}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={18} color="#fff" />
                <Text style={styles.payBtnText}>Payer maintenant</Text>
              </>
            )}
          </TouchableOpacity>
          {link.requiresLocation && (
            <Text style={[styles.secure, { color: colors.textSecondary }]}>
              📍 Paiement sur place : votre position sera vérifiée.
            </Text>
          )}
          <Text style={[styles.secure, { color: colors.textSecondary }]}>
            Paiement sécurisé depuis votre portefeuille M'Paye.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  merchantHead: { alignItems: 'center', gap: 6, marginBottom: 20 },
  logo: { width: 64, height: 64, borderRadius: 18 },
  merchantName: { fontSize: 18, fontWeight: 'bold' },
  label: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  desc: { fontSize: 13, textAlign: 'center', marginTop: 4 },
  title: { fontSize: 20, fontWeight: 'bold', marginTop: 8 },
  sub: { fontSize: 13, textAlign: 'center' },
  linkText: { fontSize: 14, fontWeight: '600', marginTop: 10 },
  bigAmount: { fontSize: 36, fontWeight: '800', textAlign: 'center', marginVertical: 24 },
  amountInput: { height: 60, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontSize: 20, marginVertical: 24, textAlign: 'center' },
  unavailable: { fontSize: 14, textAlign: 'center', marginTop: 20 },
  error: { color: '#ef4444', fontSize: 13, textAlign: 'center', marginBottom: 10 },
  sourceLabel: { fontSize: 12, marginBottom: 8 },
  sourceList: { gap: 8, marginBottom: 16 },
  sourceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  sourceText: { flex: 1, fontSize: 14 },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14 },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secure: { fontSize: 11, textAlign: 'center', marginTop: 12 },
});

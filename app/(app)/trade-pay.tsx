// app/(app)/trade-pay.tsx
// Page de confirmation de paiement Trade (initiée par un partenaire OAuth).
//
// Entrée :
//   - via deep-link : monpaye://trade/pay?trade_no=TR-XXX&return_url=...
//   - via expo-router push : router.push({ pathname:'/trade-pay', params:{trade_no,return_url}})
//
// L'user (déjà loggé) voit le détail + confirme → débit wallet + retour partenaire.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useBiometricGuard } from '../../src/contexts/BiometricGuardContext';
import { useWallet } from '../../src/contexts/WalletContext';
import { tradeApi, type TradeDto } from '../../src/services/tradeApi';

type Phase = 'loading' | 'ready' | 'paying' | 'success' | 'error';

export default function TradePay() {
  const params = useLocalSearchParams<{ trade_no?: string; return_url?: string }>();
  const tradeNo = pickStr(params.trade_no);
  const returnUrl = pickStr(params.return_url);

  const router = useRouter();
  const { colors } = useTheme();
  const { requireBiometric } = useBiometricGuard();
  const { fetchBalance } = useWallet();

  const [phase, setPhase] = useState<Phase>('loading');
  const [trade, setTrade] = useState<TradeDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tradeNo) {
      setError('Paramètre trade_no manquant.');
      setPhase('error');
      return;
    }
    let active = true;
    tradeApi
      .getOne(tradeNo)
      .then((t) => {
        if (!active) return;
        setTrade(t);
        if (t.status !== 'PENDING') {
          setError(`Ce paiement est déjà ${labelStatus(t.status)}.`);
          setPhase('error');
        } else {
          setPhase('ready');
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err?.response?.data?.message ??
            err?.message ??
            'Trade introuvable ou expiré.',
        );
        setPhase('error');
      });
    return () => {
      active = false;
    };
  }, [tradeNo]);

  const isAuthMode = trade?.trade_type === 'AUTHORIZATION';

  const handlePay = useCallback(async () => {
    if (!trade) return;
    const reason = trade.trade_type === 'AUTHORIZATION'
      ? `Bloquer ${trade.amount.toLocaleString('fr-FR')} ${trade.currency} pour ${trade.partner.name}`
      : 'Confirmer le paiement à ' + trade.partner.name;
    const ok = await requireBiometric(reason);
    if (!ok) return;

    setPhase('paying');
    setError(null);
    try {
      if (trade.trade_type === 'AUTHORIZATION') {
        await tradeApi.authorize(trade.trade_no);
      } else {
        await tradeApi.pay(trade.trade_no);
      }
      setPhase('success');
      void fetchBalance?.();
      if (returnUrl) {
        setTimeout(() => {
          openReturnUrl(returnUrl, {
            status: trade.trade_type === 'AUTHORIZATION' ? 'authorized' : 'paid',
            trade_no: trade.trade_no,
          });
        }, 2000);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          err?.message ??
          "L'opération a échoué. Réessayez.",
      );
      setPhase('error');
    }
  }, [trade, returnUrl, requireBiometric, fetchBalance]);

  const handleCancel = useCallback(() => {
    if (returnUrl) {
      openReturnUrl(returnUrl, {
        status: 'cancelled',
        trade_no: trade?.trade_no,
      });
    } else {
      router.back();
    }
  }, [returnUrl, trade, router]);

  if (phase === 'loading') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingLabel, { color: colors.textSecondary }]}>
            Chargement du paiement…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'success' && trade) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <View style={[styles.successBubble, { backgroundColor: '#10b98120' }]}>
            <Ionicons name="checkmark-circle" size={72} color="#10b981" />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>
            {isAuthMode ? 'Fonds bloqués' : 'Paiement confirmé'}
          </Text>
          <Text style={[styles.successAmount, { color: colors.text }]}>
            {fmtAmount(trade.amount)} {trade.currency}
          </Text>
          <Text style={[styles.successPartner, { color: colors.textSecondary }]}>
            {isAuthMode ? 'réservés pour ' : 'à '}{trade.partner.name}
          </Text>
          <Text style={[styles.successRef, { color: colors.textTertiary }]}>
            Réf. {trade.trade_no}
          </Text>
          {returnUrl ? (
            <View style={styles.returnRow}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text style={[styles.returnLabel, { color: colors.textSecondary }]}>
                Retour vers {trade.partner.name}…
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => router.replace('/(app)/dashboard')}
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.primaryBtnText}>Retour à M'Paye</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'error' && !trade) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <View style={[styles.errorBubble, { backgroundColor: colors.error + '20' }]}>
            <Ionicons name="alert-circle" size={72} color={colors.error} />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>Paiement impossible</Text>
          <Text style={[styles.errorMsg, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity
            onPress={() => router.replace('/(app)/dashboard')}
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.primaryBtnText}>Retour à M'Paye</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!trade) return null;
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.partnerCard, { backgroundColor: colors.primary }]}>
          <View style={styles.partnerHeader}>
            {trade.partner.logoUrl ? (
              <Image source={{ uri: trade.partner.logoUrl }} style={styles.partnerLogo} />
            ) : (
              <View style={[styles.partnerLogo, styles.partnerLogoPlaceholder]}>
                <Text style={styles.partnerLogoLetter}>
                  {trade.partner.name.charAt(0)}
                </Text>
              </View>
            )}
            <View style={styles.partnerHeaderText}>
              <Text style={styles.partnerHint}>
                {isAuthMode ? 'Pré-autorisation pour' : 'Paiement à'}
              </Text>
              <Text style={styles.partnerName} numberOfLines={1}>
                {trade.partner.name}
              </Text>
            </View>
            <Ionicons name="shield-checkmark" size={22} color="#dbeafe" />
          </View>
          <Text style={styles.amountHint}>
            {isAuthMode ? 'Montant à bloquer' : 'Montant'}
          </Text>
          <Text style={styles.amount}>
            {fmtAmount(trade.amount)}{' '}
            <Text style={styles.amountCurrency}>{trade.currency}</Text>
          </Text>
        </View>

        <View style={[styles.detailsCard, { backgroundColor: colors.card }]}>
          <Row label="Description" value={trade.subject} colors={colors} />
          {trade.body ? <Row label="Détails" value={trade.body} colors={colors} /> : null}
          <Row label="Référence partenaire" value={trade.out_trade_no} colors={colors} mono />
          <Row label="Expire le" value={fmtDate(trade.expires_at)} colors={colors} />

          {error && (
            <View style={[styles.errorBox, { backgroundColor: colors.error + '15' }]}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          <View style={[styles.lockBox, { backgroundColor: colors.borderLight }]}>
            <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
            <Text style={[styles.lockText, { color: colors.textSecondary }]}>
              {isAuthMode
                ? `Ce montant sera bloqué sur votre wallet. ${trade.partner.name} le débitera à la facturation finale. Le solde non utilisé sera restitué.`
                : `Débité depuis votre solde M'Paye. ${trade.partner.name} ne voit pas votre numéro.`}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={handleCancel}
          disabled={phase === 'paying'}
          style={[styles.secondaryBtn, { backgroundColor: colors.borderLight }]}
        >
          <Ionicons name="close" size={18} color={colors.text} />
          <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handlePay}
          disabled={phase === 'paying'}
          style={[styles.primaryBtn, styles.payBtn, { backgroundColor: '#10b981' }]}
        >
          {phase === 'paying' ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.primaryBtnText}>
                {isAuthMode ? 'Blocage…' : 'Paiement…'}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.primaryBtnText}>
                {isAuthMode ? 'Bloquer les fonds' : 'Payer'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  colors,
  mono,
}: {
  label: string;
  value: string;
  colors: any;
  mono?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[styles.rowValue, { color: colors.text }, mono && styles.mono]}
        numberOfLines={3}
      >
        {value}
      </Text>
    </View>
  );
}

function pickStr(v: string | string[] | undefined): string {
  if (!v) return '';
  return Array.isArray(v) ? v[0] : v;
}
function fmtAmount(n: number) {
  return n.toLocaleString('fr-FR');
}
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
function labelStatus(s: string) {
  switch (s) {
    case 'PAID':
      return 'payé';
    case 'REFUNDED':
      return 'remboursé';
    case 'EXPIRED':
      return 'expiré';
    case 'CANCELLED':
      return 'annulé';
    case 'FAILED':
      return 'en échec';
    case 'AUTHORIZED':
      return 'pré-autorisé';
    case 'CAPTURED':
      return 'capturé';
    case 'PARTIALLY_CAPTURED':
      return 'partiellement capturé';
    case 'RELEASED':
      return 'libéré';
    default:
      return s.toLowerCase();
  }
}
function openReturnUrl(returnUrl: string, params: Record<string, string | undefined>) {
  try {
    const sep = returnUrl.includes('?') ? '&' : '?';
    const qs = Object.entries(params)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`)
      .join('&');
    Linking.openURL(returnUrl + sep + qs).catch(() => {});
  } catch {
    // ignore
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingLabel: { marginTop: 12, fontSize: 14 },

  scroll: { padding: 16, paddingBottom: 32 },

  partnerCard: { borderRadius: 20, padding: 20, marginBottom: 16 },
  partnerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  partnerLogo: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#ffffff20' },
  partnerLogoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  partnerLogoLetter: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  partnerHeaderText: { flex: 1 },
  partnerHint: { color: '#dbeafe', fontSize: 12 },
  partnerName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  amountHint: { color: '#dbeafe', fontSize: 12, marginBottom: 4 },
  amount: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  amountCurrency: { fontSize: 20, fontWeight: '400' },

  detailsCard: { borderRadius: 20, padding: 18, gap: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  rowLabel: { fontSize: 13, flexShrink: 0 },
  rowValue: { fontSize: 14, flex: 1, textAlign: 'right' },
  mono: { fontFamily: 'Courier', fontSize: 12 },

  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, padding: 12 },
  errorText: { flex: 1, fontSize: 13 },

  lockBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  lockText: { flex: 1, fontSize: 12, lineHeight: 16 },

  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
  primaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtn: { flex: 1, flexDirection: 'row', gap: 6 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  successBubble: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  errorBubble: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  successAmount: { fontSize: 28, fontWeight: 'bold' },
  successPartner: { fontSize: 15, marginTop: 4 },
  successRef: { fontSize: 12, marginTop: 8, marginBottom: 32 },
  errorMsg: { fontSize: 14, textAlign: 'center', marginBottom: 32, paddingHorizontal: 16 },
  returnRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  returnLabel: { fontSize: 13 },
});

// app/(app)/transport-scolaire/my-subscriptions.tsx
// Liste des abonnements du parent — actions selon status :
//   PENDING_PAYMENT : Payer | Annuler
//   ACTIVE          : Voir détails | Annuler (refund pro-rata)
//   EXPIRED         : info
//   CANCELLED       : info

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useWallet } from '../../../src/contexts/WalletContext';
import {
  transportScolaireApi,
  type TransportSubscription,
  type SubscriptionStatus,
} from '../../../src/services/transportScolaireApi';

const STATUS_META: Record<SubscriptionStatus, { label: string; color: string; icon: any }> = {
  PENDING_PAYMENT: { label: 'À payer', color: '#f59e0b', icon: 'time-outline' },
  ACTIVE:          { label: 'Actif',  color: '#10b981', icon: 'checkmark-circle' },
  EXPIRED:         { label: 'Expiré', color: '#9ca3af', icon: 'close-circle-outline' },
  CANCELLED:       { label: 'Annulé', color: '#ef4444', icon: 'ban-outline' },
};

const fmtAr = (n: number | string) => Number(n).toLocaleString('fr-FR') + ' Ar';
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function MySubscriptionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { fetchBalance } = useWallet();
  const [items, setItems] = useState<TransportSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await transportScolaireApi.listSubscriptions();
      setItems(res.data ?? []);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message ?? 'Chargement échoué');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handlePay = (sub: TransportSubscription) => {
    Alert.alert(
      'Payer l\'abonnement',
      `Débiter ${fmtAr(sub.prixApplique)} de votre wallet M'Paye ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Payer',
          onPress: async () => {
            setBusyId(sub.id);
            try {
              await transportScolaireApi.paySubscription(sub.id);
              await load();
              void fetchBalance?.();
              Alert.alert('Paiement réussi ✅', 'Abonnement activé');
            } catch (e: any) {
              Alert.alert('Paiement échoué', e?.response?.data?.message ?? 'Réessayez');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const handleCancel = (sub: TransportSubscription) => {
    if (sub.status === 'PENDING_PAYMENT') {
      Alert.alert(
        'Annuler l\'abonnement',
        'L\'abonnement n\'a pas été payé. L\'annulation est gratuite.',
        [
          { text: 'Garder', style: 'cancel' },
          {
            text: 'Annuler',
            style: 'destructive',
            onPress: () => doCancel(sub),
          },
        ],
      );
      return;
    }

    // ACTIVE → preview refund pro-rata
    const dureeJours = sub.pricingPlan?.dureeJours ?? 30;
    const remainingMs = new Date(sub.dateFin).getTime() - Date.now();
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
    const ratio = remainingDays / dureeJours;
    const refund = Math.round(Number(sub.prixApplique) * Math.max(0, Math.min(1, ratio)));
    const retained = Number(sub.prixApplique) - refund;

    Alert.alert(
      'Confirmer l\'annulation',
      refund > 0
        ? `Pro-rata : ${remainingDays}j restants sur ${dureeJours}j\n\n` +
          `Remboursé : ${fmtAr(refund)}\nRetenu : ${fmtAr(retained)}\n\nConfirmer ?`
        : 'Période entièrement consommée — aucun remboursement.\n\nConfirmer ?',
      [
        { text: 'Garder', style: 'cancel' },
        {
          text: 'Annuler l\'abonnement',
          style: 'destructive',
          onPress: () => doCancel(sub),
        },
      ],
    );
  };

  const doCancel = async (sub: TransportSubscription) => {
    setBusyId(sub.id);
    try {
      const res = await transportScolaireApi.cancelSubscription(sub.id);
      await load();
      void fetchBalance?.();
      const refund = res.data.refund;
      if (refund.amount > 0) {
        Alert.alert(
          'Annulé ✅',
          `${fmtAr(refund.amount)} recrédités sur votre wallet.${refund.retained > 0 ? ` ${fmtAr(refund.retained)} retenus.` : ''}`,
        );
      } else {
        Alert.alert('Annulé', 'Abonnement annulé.');
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message ?? 'Annulation échouée');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mes abonnements</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="card-outline" size={56} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucun abonnement</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Trouvez une école et abonnez vos enfants.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/transport-scolaire/schools')}
            style={[styles.cta, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.ctaText}>Trouver une école</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status];
            const childrenNames =
              item.studentLinks?.map((l) => `${l.student.prenom} ${l.student.nom.charAt(0)}.`).join(', ') ?? '—';
            const isBusy = busyId === item.id;
            return (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: item.status === 'CANCELLED' || item.status === 'EXPIRED' ? 0.6 : 1,
                  },
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.statusBadge, { backgroundColor: meta.color + '20' }]}>
                    <Ionicons name={meta.icon} size={12} color={meta.color} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: meta.color }}>
                      {meta.label}
                    </Text>
                  </View>
                  <Text style={[styles.code, { color: colors.textSecondary }]}>{item.codeAbonnement}</Text>
                </View>

                <Text style={[styles.routeName, { color: colors.text }]}>
                  {item.route?.nom ?? '—'}
                </Text>
                <Text style={[styles.schoolName, { color: colors.textSecondary }]}>
                  {item.route?.school?.nom} · {item.route?.school?.ville}
                </Text>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <InfoLine icon="people-outline" text={childrenNames} colors={colors} />
                <InfoLine
                  icon="pricetag-outline"
                  text={`${item.pricingPlan?.label ?? '—'} · ${fmtAr(item.prixApplique)}`}
                  colors={colors}
                />
                <InfoLine
                  icon="calendar-outline"
                  text={`${fmtDate(item.dateDebut)} → ${fmtDate(item.dateFin)}`}
                  colors={colors}
                />
                {item.pickupStop && (
                  <InfoLine
                    icon="location-outline"
                    text={`Arrêt : ${item.pickupStop.nom}${item.pickupStop.heurePassage ? ' (' + item.pickupStop.heurePassage + ')' : ''}`}
                    colors={colors}
                  />
                )}

                {/* Actions */}
                {item.status === 'PENDING_PAYMENT' && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={() => handleCancel(item)}
                      disabled={isBusy}
                      style={[styles.actionBtn, styles.actionSecondary, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.actionText, { color: colors.text }]}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handlePay(item)}
                      disabled={isBusy}
                      style={[styles.actionBtn, styles.actionPrimary, { backgroundColor: colors.primary }]}
                    >
                      {isBusy ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={[styles.actionText, { color: '#fff' }]}>Payer</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
                {item.status === 'ACTIVE' && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={() => handleCancel(item)}
                      disabled={isBusy}
                      style={[styles.actionBtn, styles.actionDanger, { borderColor: colors.error }]}
                    >
                      {isBusy ? (
                        <ActivityIndicator color={colors.error} size="small" />
                      ) : (
                        <Text style={[styles.actionText, { color: colors.error }]}>Annuler l'abonnement</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {item.status === 'CANCELLED' && item.refundedAmount != null && Number(item.refundedAmount) > 0 && (
                  <View style={[styles.refundBanner, { backgroundColor: '#3b82f615' }]}>
                    <Ionicons name="information-circle" size={14} color="#3b82f6" />
                    <Text style={[styles.refundText, { color: '#3b82f6' }]}>
                      Remboursé : {fmtAr(item.refundedAmount)}
                    </Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function InfoLine({
  icon, text, colors,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  text: string;
  colors: any;
}) {
  return (
    <View style={styles.infoLine}>
      <Ionicons name={icon} size={14} color={colors.textSecondary} />
      <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={2}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyDesc: { fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 20 },
  cta: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  ctaText: { color: '#fff', fontWeight: '600' },

  list: { padding: 16, gap: 10 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  cardTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  code: { fontSize: 11, fontFamily: 'Courier', letterSpacing: 0.5 },
  routeName: { fontSize: 16, fontWeight: '700' },
  schoolName: { fontSize: 12 },
  divider: { height: 1, marginVertical: 6 },

  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  infoText: { flex: 1, fontSize: 13 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  actionSecondary: { borderWidth: 1, backgroundColor: 'transparent' },
  actionPrimary: {},
  actionDanger: { borderWidth: 1, backgroundColor: 'transparent' },
  actionText: { fontSize: 14, fontWeight: '600' },

  refundBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    marginTop: 8, alignSelf: 'flex-start',
  },
  refundText: { fontSize: 11, fontWeight: '600' },
});

// app/(app)/taxi-brousse/my-reservations.tsx — Liste des réservations de l'utilisateur
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useBiometricGuard } from '../../../src/contexts/BiometricGuardContext';
import {
  taxiBrousseApi,
  Reservation,
} from '../../../src/services/taxiBrousseApi';

export default function MyReservations() {
  const router = useRouter();
  const { colors } = useTheme();
  const { requireBiometric } = useBiometricGuard();
  const [items, setItems] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await taxiBrousseApi.getMyReservations();
      setItems(response.data);
    } catch (e: any) {
      console.error(e);
      setError(
        e?.response?.data?.message ||
          'Impossible de charger vos réservations',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handlePay = async (id: string) => {
    const reservation = items.find(r => r.id === id);
    const reason = reservation
      ? `Confirmez le paiement de ${new Intl.NumberFormat('fr-FR').format(Number(reservation.prixPaye))} Ar`
      : 'Confirmez le paiement';
    const okBio = await requireBiometric(reason);
    if (!okBio) return;

    try {
      await taxiBrousseApi.payReservation(id, 'wallet');
      Alert.alert('Paiement réussi ✅', 'Votre réservation est confirmée');
      load();
    } catch (e: any) {
      Alert.alert(
        'Erreur',
        e?.response?.data?.message || 'Paiement impossible',
      );
    }
  };

  const handleCancel = (id: string) => {
    const reservation = items.find((r) => r.id === id);
    const isPaid = reservation?.statusPaiement === 'paye';
    const prix = Number(reservation?.prixPaye ?? 0);

    // Si payée : montre le preview du refund selon la politique 3-tiers
    // (mêmes seuils que le backend — purement informatif côté front)
    let title = 'Annuler la réservation';
    let message = 'Êtes-vous sûr ? Cette action est irréversible.';
    let destructiveLabel = 'Oui, annuler';

    if (isPaid && reservation?.voyage) {
      const departure = combineDateAndTime(
        reservation.voyage.dateDepart,
        reservation.voyage.heureDepart,
      );
      const hoursBefore =
        (departure.getTime() - Date.now()) / (1000 * 60 * 60);
      let refundAmount = 0;
      let refundLabel = '';
      if (hoursBefore > 24) {
        refundAmount = prix;
        refundLabel = `Vous serez remboursé intégralement : ${formatPrice(refundAmount)}`;
      } else if (hoursBefore > 12) {
        refundAmount = Math.round(prix * 0.5);
        refundLabel = `Remboursement partiel (50%) : ${formatPrice(refundAmount)}\nPénalité retenue : ${formatPrice(prix - refundAmount)}`;
      } else {
        refundLabel = `Annulation tardive (< 12h avant départ).\nAucun remboursement possible : ${formatPrice(prix)} retenus.`;
        destructiveLabel = 'Annuler quand même';
      }
      title = 'Confirmer l\'annulation';
      message = `${refundLabel}\n\nCette action est irréversible.`;
    }

    Alert.alert(title, message, [
      { text: 'Garder ma réservation', style: 'cancel' },
      {
        text: destructiveLabel,
        style: 'destructive',
        onPress: async () => {
          try {
            const res: any = await taxiBrousseApi.cancelReservation(id);
            const refund = res?.data?.refund;
            if (refund && refund.amount > 0) {
              Alert.alert(
                refund.percent === 100 ? 'Annulée ✅' : 'Annulée — refund partiel ⚠️',
                `${formatPrice(refund.amount)} recrédités sur votre wallet.${refund.retained > 0 ? ` ${formatPrice(refund.retained)} retenus.` : ''}`,
              );
            } else if (refund) {
              Alert.alert(
                'Annulée',
                `Aucun remboursement (annulation tardive). ${formatPrice(prix)} retenus.`,
              );
            } else {
              Alert.alert('Annulée', 'Réservation annulée');
            }
            load();
          } catch (e: any) {
            Alert.alert(
              'Erreur',
              e?.response?.data?.message || 'Annulation impossible',
            );
          }
        },
      },
    ]);
  };

  /** Combine date + heure "HH:MM" en Date — symétrique au backend. */
  const combineDateAndTime = (date: string, timeStr?: string): Date => {
    const base = new Date(date);
    if (!timeStr) return base;
    const match = /^(\d{1,2}):(\d{2})/.exec(timeStr.trim());
    if (!match) return base;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (Number.isNaN(h) || Number.isNaN(m)) return base;
    base.setHours(h, m, 0, 0);
    return base;
  };

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('fr-FR').format(n) + ' Ar';

  const renderItem = ({ item }: { item: Reservation }) => {
    const isPaid = item.statusPaiement === 'paye';
    const isCancelled = item.statusReservation === 'annulee';
    const voyage = item.voyage;

    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
          isCancelled && { opacity: 0.6 },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, statusBg(item.statusPaiement, item.statusReservation)]}>
            <Text style={styles.statusBadgeText}>
              {labelStatus(item.statusPaiement, item.statusReservation)}
            </Text>
          </View>
          <Text style={[styles.codeText, { color: colors.textSecondary }]}>
            {item.codeConfirmation}
          </Text>
        </View>

        {voyage && (
          <View style={styles.routeRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.routeCity, { color: colors.text }]}>
                {voyage.villeDepart ?? voyage.localisationDepart}
              </Text>
              <Text style={[styles.routeTime, { color: colors.textSecondary }]}>
                {voyage.heureDepart}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color="#1e40af" />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={[styles.routeCity, { color: colors.text }]}>
                {voyage.villeArrivee ?? voyage.localisationArrivee}
              </Text>
              <Text style={[styles.routeTime, { color: colors.textSecondary }]}>
                {voyage.heureArrivee}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {voyage?.dateDepart
                ? new Date(voyage.dateDepart).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="bookmark-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              Place {item.numPlace}
            </Text>
          </View>
          <Text style={[styles.amount, { color: colors.text }]}>
            {formatPrice(Number(item.prixPaye))}
          </Text>
        </View>

        {/* Actions — Annuler reste possible même après paiement (politique refund 3-tiers) */}
        {!isCancelled && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary, { borderColor: colors.border }]}
              onPress={() => handleCancel(item.id)}
            >
              <Text style={[styles.btnText, { color: colors.text }]}>Annuler</Text>
            </TouchableOpacity>
            {!isPaid && (
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => handlePay(item.id)}
              >
                <Ionicons name="wallet-outline" size={16} color="#fff" />
                <Text style={[styles.btnText, { color: '#fff' }]}>Payer</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {isPaid && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#3b82f6" />
            <Text style={styles.successText}>
              Payé · Présentez le code {item.codeConfirmation} au chauffeur
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Mes réservations
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/taxi-brousse' as any)}
          style={styles.iconBtn}
        >
          <Ionicons name="add" size={22} color="#1e40af" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="warning-outline" size={18} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1e40af"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bus-outline" size={56} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Aucune réservation
              </Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                Réservez votre 1er voyage taxi-brousse
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => router.push('/taxi-brousse' as any)}
              >
                <Text style={styles.emptyCtaText}>Rechercher un voyage</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function statusBg(paiement: string, reservation: string) {
  if (reservation === 'annulee') return { backgroundColor: '#9ca3af' };
  if (paiement === 'paye') return { backgroundColor: '#3b82f6' };
  return { backgroundColor: '#f59e0b' };
}

function labelStatus(paiement: string, reservation: string) {
  if (reservation === 'annulee') return 'ANNULÉE';
  if (paiement === 'paye') return 'PAYÉE';
  return 'À PAYER';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ef444415',
    borderWidth: 1,
    borderColor: '#ef4444',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  errorText: { color: '#ef4444', flex: 1, fontSize: 12 },

  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  codeText: { fontSize: 11, fontWeight: '600' },

  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  routeCity: { fontSize: 14, fontWeight: '700' },
  routeTime: { fontSize: 11, marginTop: 2 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11 },
  amount: { fontSize: 14, fontWeight: '800' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  btnPrimary: { backgroundColor: '#1e40af' },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1 },
  btnText: { fontSize: 13, fontWeight: '700' },

  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#3b82f615',
  },
  successText: { color: '#3b82f6', fontSize: 11, fontWeight: '600', flex: 1 },

  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyHint: { fontSize: 13 },
  emptyCta: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyCtaText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

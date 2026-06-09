// app/(app)/vehicle-rentals/my-bookings.tsx
// Liste des réservations de location de voiture de l'utilisateur.
// Statuts paiement : pending | paid | cancelled | refunded
// Statuts booking  : pending | confirmed | cancelled | completed
//
// Actions disponibles selon l'état :
//   - pending payment      → bouton Payer + bouton Annuler
//   - paid/confirmed       → bouton Annuler (avec preview du refund)
//   - cancelled/refunded   → lecture seule
//   - completed            → lecture seule

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import GradientHeader from '../../../src/components/GradientHeader';
import { vehicleRentalService, resolveAssetUrl } from '../../../src/services/api';

interface Booking {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  pricePerDay: string | number;
  deposit: string | number;
  totalAmount: string | number;
  withDriver: boolean;
  pickupCity: string;
  paymentStatus: 'pending' | 'paid' | 'cancelled' | 'refunded';
  bookingStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  paymentReference?: string | null;
  refundAmount?: string | number | null;
  confirmationCode: string;
  createdAt: string;
  paidAt?: string | null;
  cancelledAt?: string | null;
  listing: {
    id: string;
    vehicle: { brand: string; model: string; type: string; photos?: string[] | null };
    partner: { id: string; name: string; phone: string };
  };
}

const formatPrice = (n: number | string) =>
  Number(n).toLocaleString('fr-FR') + ' Ar';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export default function MyBookings() {
  const router = useRouter();
  const { colors } = useTheme();

  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await vehicleRentalService.myBookings();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pay = async (b: Booking) => {
    setBusyId(b.id);
    try {
      await vehicleRentalService.pay(b.id);
      Alert.alert('Paiement réussi', `Réservation ${b.confirmationCode} confirmée.`);
      await load(true);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Paiement refusé.');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Estime le refund preview à partir des heures restant avant `startDate`
   * — purement informatif (le backend tranche au moment du cancel).
   */
  const refundPreview = (b: Booking): { percent: number; amount: number } => {
    if (b.paymentStatus !== 'paid') return { percent: 0, amount: 0 };
    const hours = (new Date(b.startDate).getTime() - Date.now()) / (1000 * 60 * 60);
    const percent = hours >= 24 ? 100 : hours >= 12 ? 50 : 0;
    return { percent, amount: Math.round((Number(b.totalAmount) * percent) / 100) };
  };

  const cancel = (b: Booking) => {
    const { percent, amount } = refundPreview(b);
    const msg =
      b.paymentStatus === 'paid'
        ? `Vous serez remboursé de ${amount.toLocaleString('fr-FR')} Ar (${percent}%) selon notre politique d'annulation.`
        : 'Cette réservation est en attente de paiement — aucun remboursement nécessaire.';
    Alert.alert('Annuler la réservation', msg, [
      { text: 'Garder la réservation', style: 'cancel' },
      {
        text: 'Annuler',
        style: 'destructive',
        onPress: async () => {
          setBusyId(b.id);
          try {
            await vehicleRentalService.cancelBooking(b.id);
            await load(true);
          } catch (e: any) {
            Alert.alert('Erreur', e?.response?.data?.message || 'Annulation impossible.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const renderBooking = (b: Booking) => {
    const photo = b.listing.vehicle.photos?.[0];
    const { color: statusColor, label: statusLabel } = describeStatus(b, colors);
    const cancellable =
      b.bookingStatus !== 'cancelled' &&
      b.bookingStatus !== 'completed' &&
      // On ne ré-affiche pas "Annuler" si on est déjà en busy local
      busyId !== b.id;

    return (
      <View
        key={b.id}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.cardHeader}>
          {photo ? (
            <Image source={{ uri: resolveAssetUrl(photo) }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, { backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="car-sport-outline" size={28} color={colors.primary} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.vehicleName, { color: colors.text }]} numberOfLines={1}>
              {b.listing.vehicle.brand} {b.listing.vehicle.model}
            </Text>
            <Text style={[styles.partnerName, { color: colors.textSecondary }]} numberOfLines={1}>
              {b.listing.partner.name} · {b.pickupCity}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20`, marginTop: 4 }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.rowText, { color: colors.textSecondary }]}>
            {formatDate(b.startDate)} → {formatDate(b.endDate)}
          </Text>
          <Text style={[styles.rowMeta, { color: colors.text }]}>{b.days} j</Text>
        </View>

        <View style={styles.row}>
          <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.rowText, { color: colors.textSecondary }]}>Montant</Text>
          <Text style={[styles.rowMeta, { color: colors.text }]}>{formatPrice(b.totalAmount)}</Text>
        </View>

        {b.paymentStatus === 'refunded' && Number(b.refundAmount) > 0 && (
          <View style={styles.row}>
            <Ionicons name="return-up-back" size={14} color={colors.success} />
            <Text style={[styles.rowText, { color: colors.success }]}>Remboursé</Text>
            <Text style={[styles.rowMeta, { color: colors.success }]}>
              {formatPrice(b.refundAmount!)}
            </Text>
          </View>
        )}

        <View style={[styles.codeBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>Code de confirmation</Text>
          <Text style={[styles.codeValue, { color: colors.text }]}>{b.confirmationCode}</Text>
        </View>

        {/* Actions */}
        {b.paymentStatus === 'pending' && b.bookingStatus !== 'cancelled' && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={() => pay(b)}
              disabled={busyId === b.id}
            >
              {busyId === b.id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="card-outline" size={14} color="#fff" />
                  <Text style={styles.actionBtnText}>Payer {formatPrice(b.totalAmount)}</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtnOutline, { borderColor: colors.error }]}
              onPress={() => cancel(b)}
              disabled={busyId === b.id}
            >
              <Ionicons name="close" size={14} color={colors.error} />
              <Text style={[styles.actionBtnOutlineText, { color: colors.error }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}

        {b.paymentStatus === 'paid' && cancellable && (
          <TouchableOpacity
            style={[styles.actionBtnOutline, { borderColor: colors.error, marginTop: 10 }]}
            onPress={() => cancel(b)}
            disabled={busyId === b.id}
          >
            {busyId === b.id ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <>
                <Ionicons name="close" size={14} color={colors.error} />
                <Text style={[styles.actionBtnOutlineText, { color: colors.error }]}>
                  Annuler ({refundPreview(b).percent}% remboursé)
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader title="Mes réservations" subtitle="Locations de voiture" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="car-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Aucune réservation
              </Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                Découvrez les véhicules disponibles et réservez en quelques clics.
              </Text>
              <TouchableOpacity
                style={[styles.emptyCta, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/vehicle-rentals' as any)}
              >
                <Text style={styles.emptyCtaText}>Voir les annonces</Text>
              </TouchableOpacity>
            </View>
          ) : (
            items.map(renderBooking)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function describeStatus(
  b: Booking,
  colors: any,
): { color: string; label: string } {
  if (b.bookingStatus === 'cancelled') {
    return {
      color: colors.error,
      label: b.paymentStatus === 'refunded' ? 'Annulée — remboursée' : 'Annulée',
    };
  }
  if (b.bookingStatus === 'completed') return { color: colors.textSecondary, label: 'Terminée' };
  if (b.paymentStatus === 'paid') return { color: colors.success, label: 'Confirmée' };
  if (b.paymentStatus === 'pending') return { color: '#f59e0b', label: 'En attente de paiement' };
  return { color: colors.textSecondary, label: b.bookingStatus };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },

  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  emptyBox: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyHint: { fontSize: 13, textAlign: 'center', paddingHorizontal: 30, lineHeight: 18 },
  emptyCta: { marginTop: 12, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10 },
  emptyCtaText: { color: '#fff', fontWeight: '700' },

  card: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 10 },
  vehicleName: { fontSize: 15, fontWeight: '700' },
  partnerName: { fontSize: 12, marginTop: 2 },

  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  divider: { height: 1, marginVertical: 4 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowText: { fontSize: 12, flex: 1 },
  rowMeta: { fontSize: 12, fontWeight: '700' },

  codeBox: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codeLabel: { fontSize: 11 },
  codeValue: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  actionBtnOutlineText: { fontSize: 13, fontWeight: '700' },
});

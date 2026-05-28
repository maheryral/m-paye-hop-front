// app/(app)/taxi-brousse/voyage/[id].tsx — Détails voyage + sélection siège + paiement
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { useWallet } from '../../../../src/contexts/WalletContext';
import { useBiometricGuard } from '../../../../src/contexts/BiometricGuardContext';
import VoyageMap from '../../../../src/components/VoyageMap';
import SeatPlanView from '../../../../src/components/SeatPlanView';
import {
  taxiBrousseApi,
  VoyageSearchResult,
  SeatMap,
  Reservation,
} from '../../../../src/services/taxiBrousseApi';

export default function VoyageDetail() {
  const router = useRouter();
  const { colors } = useTheme();
  const { requireBiometric } = useBiometricGuard();
  const { balance, fetchBalance } = useWallet();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [voyage, setVoyage] = useState<VoyageSearchResult | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [booking, setBooking] = useState(false);
  const [paying, setPaying] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSeat = (n: number) =>
    setSelectedSeats((prev) =>
      prev.includes(n) ? prev.filter((s) => s !== n) : [...prev, n],
    );

  const totalPrice = voyage ? Number(voyage.prix) * selectedSeats.length : 0;

  const loadAll = useCallback(async () => {
    if (!id) return;
    try {
      const [voyageRes, seatsRes] = await Promise.all([
        taxiBrousseApi.getVoyage(id),
        taxiBrousseApi.getSeatMap(id),
      ]);
      setVoyage(voyageRes.data);
      setSeatMap(seatsRes.data);
    } catch (e: any) {
      console.error(e);
      setError(
        e?.response?.data?.message || 'Impossible de charger le voyage',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll();
    fetchBalance();
  }, [loadAll, fetchBalance]);

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('fr-FR').format(n) + ' Ar';

  const handleBookSeat = async () => {
    if (selectedSeats.length === 0 || !voyage) return;
    setBooking(true);
    try {
      const response = await taxiBrousseApi.createReservationBatch(
        voyage.id,
        selectedSeats,
      );
      setReservations(response.data);
      setShowConfirm(true);
    } catch (e: any) {
      Alert.alert(
        'Erreur',
        e?.response?.data?.message || 'Réservation impossible',
      );
    } finally {
      setBooking(false);
    }
  };

  const handlePay = async (
    mode: 'wallet' | 'cash' | 'mobile_money',
  ) => {
    if (reservations.length === 0) return;
    const total = reservations.reduce((s, r) => s + Number(r.prixPaye), 0);
    if (mode === 'wallet' && balance < total) {
      Alert.alert(
        'Solde insuffisant',
        `Solde: ${formatPrice(balance)}, requis: ${formatPrice(total)}. Rechargez votre wallet d'abord.`,
      );
      return;
    }
    if (mode === 'wallet') {
      const ok = await requireBiometric(
        `Confirmez le paiement de ${formatPrice(total)}`,
      );
      if (!ok) return;
    }
    setPaying(true);
    try {
      const ids = reservations.map((r) => r.id);
      await taxiBrousseApi.payReservationBatch(ids, mode);
      Alert.alert(
        'Paiement réussi ✅',
        `${reservations.length} place(s) confirmée(s) · ${formatPrice(total)}`,
        [
          {
            text: 'Voir mes réservations',
            onPress: () => {
              setShowConfirm(false);
              router.replace('/taxi-brousse/my-reservations' as any);
            },
          },
        ],
      );
      fetchBalance();
    } catch (e: any) {
      Alert.alert(
        'Paiement échoué',
        e?.response?.data?.message || 'Erreur lors du paiement',
      );
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  if (error || !voyage || !seatMap) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={[styles.errorText, { color: colors.text }]}>
            {error || 'Voyage introuvable'}
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtnError}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Voyage</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Route */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.routeRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.routeLabel, { color: colors.textSecondary }]}>DÉPART</Text>
              <Text style={[styles.routeCity, { color: colors.text }]}>
                {voyage.villeDepart}
              </Text>
              <Text style={[styles.routeTime, { color: '#1e40af' }]}>
                {voyage.heureDepart}
              </Text>
            </View>
            <View style={styles.busIconWrap}>
              <Ionicons name="bus" size={24} color="#1e40af" />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={[styles.routeLabel, { color: colors.textSecondary }]}>ARRIVÉE</Text>
              <Text style={[styles.routeCity, { color: colors.text }]}>
                {voyage.villeArrivee}
              </Text>
              <Text style={[styles.routeTime, { color: '#1e40af' }]}>
                {voyage.heureArrivee}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.text }]}>
                {new Date(voyage.dateDepart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="ribbon-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.text }]}>
                Classe {voyage.classe.type}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="car-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.text }]}>
                {voyage.voiture.marque ?? ''} {voyage.voiture.modele ?? ''} · {voyage.voiture.matricule}
              </Text>
            </View>
            {voyage.cooperative && (
              <View style={styles.infoItem}>
                <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.text }]}>
                  {voyage.cooperative.nom}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Prix */}
        <View style={[styles.priceCard, { borderColor: colors.border }]}>
          <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Prix par place</Text>
          <Text style={styles.priceValue}>{formatPrice(voyage.prix)}</Text>
        </View>

        {/* Carte du trajet */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 12 }]}>
          Itinéraire
        </Text>
        <View style={{ marginBottom: 16 }}>
          <VoyageMap
            departLat={voyage.latitudeDepart ?? voyage.cooperative?.gareRoutiere?.latitude}
            departLng={voyage.longitudeDepart ?? voyage.cooperative?.gareRoutiere?.longitude}
            departLabel={voyage.cooperative?.gareRoutiere?.nom || voyage.villeDepart}
            arriveeLat={voyage.latitudeArrivee}
            arriveeLng={voyage.longitudeArrivee}
            arriveeLabel={voyage.villeArrivee}
            villeDepart={voyage.villeDepart}
            villeArrivee={voyage.villeArrivee}
            distanceKm={voyage.distanceKm}
            height={220}
          />
        </View>

        {/* Sélection siège */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Sélectionnez vos places
          {selectedSeats.length > 0 ? ` (${selectedSeats.length})` : ''}
        </Text>
        <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
          {seatMap.availableCount} libres sur {seatMap.capacity} places
        </Text>

        <View style={[styles.seatMapCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SeatPlanView
            layout={seatMap.layout}
            seatPositions={seatMap.seatPositions}
            seats={seatMap.seats}
            selectedSeats={selectedSeats}
            onSelectSeat={toggleSeat}
            colors={colors}
          />
        </View>
      </ScrollView>

      {/* CTA bottom */}
      <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bottomLabel, { color: colors.textSecondary }]}>
            {selectedSeats.length > 0
              ? `Place(s) ${[...selectedSeats].sort((a, b) => a - b).join(', ')}`
              : 'Aucune place'}
          </Text>
          <Text style={[styles.bottomPrice, { color: colors.text }]}>
            {formatPrice(totalPrice)}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.bookBtn,
            (selectedSeats.length === 0 || booking) && { opacity: 0.5 },
          ]}
          disabled={selectedSeats.length === 0 || booking}
          onPress={handleBookSeat}
        >
          {booking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bookBtnText}>
              Réserver {selectedSeats.length > 0 ? `(${selectedSeats.length})` : ''}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal confirmation paiement */}
      <Modal visible={showConfirm} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalIcon}>
              <Ionicons name="checkmark-circle" size={42} color="#3b82f6" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {reservations.length} place(s) réservée(s) !
            </Text>
            <Text style={[styles.modalCode, { color: '#1e40af' }]}>
              Place(s) :{' '}
              {reservations
                .map((r) => r.numPlace)
                .sort((a, b) => a - b)
                .join(', ')}
            </Text>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
              Confirmez le paiement pour finaliser ·{' '}
              {formatPrice(
                reservations.reduce((s, r) => s + Number(r.prixPaye), 0),
              )}
            </Text>

            <Text style={[styles.modalSection, { color: colors.text }]}>
              Mode de paiement
            </Text>

            <TouchableOpacity
              style={[styles.payOption, { borderColor: colors.border }]}
              disabled={paying}
              onPress={() => handlePay('wallet')}
            >
              <View style={[styles.payIcon, { backgroundColor: '#1e40af20' }]}>
                <Ionicons name="wallet-outline" size={20} color="#1e40af" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.payTitle, { color: colors.text }]}>
                  Wallet M'Paye
                </Text>
                <Text style={[styles.paySubtitle, { color: colors.textSecondary }]}>
                  Solde : {formatPrice(balance)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.payOption, { borderColor: colors.border }]}
              disabled={paying}
              onPress={() => handlePay('cash')}
            >
              <View style={[styles.payIcon, { backgroundColor: '#f59e0b20' }]}>
                <Ionicons name="cash-outline" size={20} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.payTitle, { color: colors.text }]}>
                  Espèces à bord
                </Text>
                <Text style={[styles.paySubtitle, { color: colors.textSecondary }]}>
                  Paiement le jour du voyage
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            {paying && <ActivityIndicator color="#1e40af" style={{ marginTop: 12 }} />}

            <TouchableOpacity
              onPress={() => {
                setShowConfirm(false);
                router.back();
              }}
              style={{ marginTop: 16 }}
            >
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                Payer plus tard (24h max)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  backBtnError: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  card: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center' },
  routeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  routeCity: { fontSize: 16, fontWeight: '700' },
  routeTime: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  busIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e40af20',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },

  divider: { height: 1, backgroundColor: 'rgba(128,128,128,0.15)', marginVertical: 14 },

  infoGrid: { gap: 10 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13 },

  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e40af15',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  priceLabel: { fontSize: 12 },
  priceValue: { fontSize: 22, fontWeight: '800', color: '#1e40af' },

  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  sectionHint: { fontSize: 12, marginBottom: 12 },

  seatMapCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  driverIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  driverText: { fontSize: 11 },

  seatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  seat: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  seatReserved: { backgroundColor: '#9ca3af', borderColor: '#9ca3af' },
  seatSelected: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  seatText: { fontSize: 13, fontWeight: '700' },

  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 4 },
  legendText: { fontSize: 11 },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    gap: 14,
  },
  bottomLabel: { fontSize: 11, fontWeight: '600' },
  bottomPrice: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  bookBtn: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  bookBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalIcon: { alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  modalCode: { fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  modalText: { fontSize: 13, textAlign: 'center', marginBottom: 20 },
  modalSection: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  payOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  payIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  payTitle: { fontSize: 14, fontWeight: '700' },
  paySubtitle: { fontSize: 11, marginTop: 2 },
});

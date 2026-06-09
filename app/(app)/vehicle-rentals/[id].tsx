// app/(app)/vehicle-rentals/[id].tsx
// Détail d'une annonce de location. Phase 1 : lecture seule + CTA "Bientôt
// disponible" pour la réservation (qui viendra en phase 2).

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useTheme } from '../../../src/contexts/ThemeContext';
import GradientHeader from '../../../src/components/GradientHeader';
import { vehicleRentalService, resolveAssetUrl } from '../../../src/services/api';

const W = Dimensions.get('window').width;

interface ListingDetail {
  id: string;
  city: string;
  pricePerDay: number | string;
  withDriver: boolean;
  deposit: number | string;
  minDays: number;
  notes?: string | null;
  vehicle: {
    id: string;
    brand: string;
    model: string;
    year?: number | null;
    type: string;
    seats: number;
    hasAC: boolean;
    transmission: string;
    fuel: string;
    photos?: string[] | null;
    description?: string | null;
  };
  partner: {
    id: string;
    name: string;
    logoUrl?: string | null;
    phone: string;
    email?: string | null;
    city: string;
    /** Coords GPS optionnelles pour le pin sur la carte (Decimal stringifié). */
    latitude?: number | string | null;
    longitude?: number | string | null;
    description?: string | null;
  };
}

export default function VehicleRentalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const [data, setData] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);

  // === Booking ===
  // Le modal s'ouvre via le CTA "Réserver". Le flow est :
  //   1. choisir startDate + endDate
  //   2. POST /book → on récupère l'id booking + total
  //   3. POST /book/:id/pay → débit wallet, confirmation
  // On garde 2 phases pour qu'un user puisse voir le récap avant le débit.
  const todayMidnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>(todayMidnight);
  const [endDate, setEndDate] = useState<Date>(todayMidnight);
  const [pickingField, setPickingField] = useState<'start' | 'end' | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingTotal, setBookingTotal] = useState<number>(0);
  const [bookingDays, setBookingDays] = useState<number>(0);
  const [bookingConfirm, setBookingConfirm] = useState<string | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingPaid, setBookingPaid] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const openBooking = () => {
    // Réinitialise les dates à demain par défaut (start) et demain+minDays-1 (end).
    const tomorrow = new Date(todayMidnight);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDays = data?.minDays || 1;
    const endDefault = new Date(tomorrow);
    endDefault.setDate(endDefault.getDate() + Math.max(0, minDays - 1));
    setStartDate(tomorrow);
    setEndDate(endDefault);
    setBookingId(null);
    setBookingTotal(0);
    setBookingDays(0);
    setBookingConfirm(null);
    setBookingPaid(false);
    setBookingError(null);
    setBookingOpen(true);
  };

  const submitBooking = async () => {
    if (!data) return;
    setBookingBusy(true);
    setBookingError(null);
    try {
      const res = await vehicleRentalService.book(data.id, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      setBookingId(res.id);
      setBookingTotal(Number(res.totalAmount));
      setBookingDays(res.days);
      setBookingConfirm(res.confirmationCode);
    } catch (e: any) {
      setBookingError(
        e?.response?.data?.message || "Impossible de créer la réservation.",
      );
    } finally {
      setBookingBusy(false);
    }
  };

  const payBooking = async () => {
    if (!bookingId) return;
    setBookingBusy(true);
    setBookingError(null);
    try {
      await vehicleRentalService.pay(bookingId);
      setBookingPaid(true);
    } catch (e: any) {
      setBookingError(
        e?.response?.data?.message || 'Paiement refusé. Vérifiez votre solde.',
      );
    } finally {
      setBookingBusy(false);
    }
  };

  const onDateChange = (_e: any, picked?: Date) => {
    // iOS reste ouvert, Android se ferme automatiquement
    if (Platform.OS !== 'ios') setPickingField(null);
    if (!picked) return;
    const d = new Date(picked);
    d.setHours(0, 0, 0, 0);
    if (pickingField === 'start') {
      setStartDate(d);
      if (endDate < d) setEndDate(d);
    } else if (pickingField === 'end') {
      if (d < startDate) {
        Alert.alert('Date invalide', 'La fin doit être après le début.');
        return;
      }
      setEndDate(d);
    }
  };

  const computedDays = useMemo(
    () =>
      Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    [startDate, endDate],
  );
  const computedTotal = useMemo(
    () => (data ? Number(data.pricePerDay) * computedDays : 0),
    [data, computedDays],
  );

  useEffect(() => {
    if (!id) return;
    vehicleRentalService
      .detail(id)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  const formatPrice = (p: number | string) => Number(p).toLocaleString('fr-FR') + ' Ar';

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GradientHeader title="Location voiture" />
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GradientHeader title="Location voiture" />
        <View style={styles.loadingBox}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Annonce introuvable</Text>
          <TouchableOpacity onPress={() => router.back()} style={[styles.btnPrimary, { backgroundColor: colors.primary }]}>
            <Text style={styles.btnPrimaryText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const photos = data.vehicle.photos?.length ? data.vehicle.photos : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title={`${data.vehicle.brand} ${data.vehicle.model}`}
        subtitle={data.partner.name}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Carrousel photos / placeholder */}
        {photos.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPhotoIdx(Math.round(e.nativeEvent.contentOffset.x / W))}
            >
              {photos.map((p, i) => (
                <Image
                  key={i}
                  source={{ uri: resolveAssetUrl(p) }}
                  style={{ width: W, height: 220 }}
                />
              ))}
            </ScrollView>
            <View style={styles.dots}>
              {photos.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.5)' },
                  ]}
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={[styles.photoPlaceholder, { backgroundColor: `${colors.primary}15` }]}>
            <Ionicons name="car-sport-outline" size={72} color={colors.primary} />
          </View>
        )}

        <View style={styles.content}>
          {/* Prix + badge mode */}
          <View style={styles.priceRow}>
            <View>
              <Text style={[styles.price, { color: colors.text }]}>{formatPrice(data.pricePerDay)}</Text>
              <Text style={[styles.priceUnit, { color: colors.textSecondary }]}>par jour</Text>
            </View>
            {data.withDriver ? (
              <View style={[styles.modeBadge, { backgroundColor: `${colors.success}20` }]}>
                <Ionicons name="person" size={14} color={colors.success} />
                <Text style={[styles.modeBadgeText, { color: colors.success }]}>Avec chauffeur</Text>
              </View>
            ) : (
              <View style={[styles.modeBadge, { backgroundColor: `${colors.primary}20` }]}>
                <Ionicons name="key-outline" size={14} color={colors.primary} />
                <Text style={[styles.modeBadgeText, { color: colors.primary }]}>Self-drive</Text>
              </View>
            )}
          </View>

          {/* Specs grid */}
          <View style={[styles.specsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SpecRow icon="people-outline" label="Places" value={`${data.vehicle.seats}`} colors={colors} />
            <SpecRow
              icon={data.vehicle.transmission === 'automatic' ? 'sync-outline' : 'cog-outline'}
              label="Transmission"
              value={data.vehicle.transmission === 'automatic' ? 'Automatique' : 'Manuelle'}
              colors={colors}
            />
            <SpecRow icon="flame-outline" label="Carburant" value={data.vehicle.fuel} colors={colors} />
            <SpecRow icon="snow-outline" label="Climatisation" value={data.vehicle.hasAC ? 'Oui' : 'Non'} colors={colors} />
            {!!data.vehicle.year && (
              <SpecRow icon="calendar-outline" label="Année" value={String(data.vehicle.year)} colors={colors} />
            )}
            <SpecRow icon="location-outline" label="Prise en charge" value={data.city} colors={colors} />
            <SpecRow icon="time-outline" label="Durée min." value={`${data.minDays} jour(s)`} colors={colors} />
            {Number(data.deposit) > 0 && (
              <SpecRow
                icon="shield-outline"
                label="Caution"
                value={formatPrice(data.deposit)}
                colors={colors}
                isLast
              />
            )}
          </View>

          {/* Description véhicule */}
          {data.vehicle.description && (
            <View style={[styles.block, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.blockTitle, { color: colors.text }]}>À propos du véhicule</Text>
              <Text style={[styles.blockText, { color: colors.textSecondary }]}>{data.vehicle.description}</Text>
            </View>
          )}

          {/* Notes annonce */}
          {data.notes && (
            <View style={[styles.block, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.blockTitle, { color: colors.text }]}>Détails de l'annonce</Text>
              <Text style={[styles.blockText, { color: colors.textSecondary }]}>{data.notes}</Text>
            </View>
          )}

          {/* Partenaire */}
          <View style={[styles.block, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.blockTitle, { color: colors.text }]}>Partenaire</Text>
            <View style={styles.partnerRow}>
              {data.partner.logoUrl ? (
                <Image source={{ uri: resolveAssetUrl(data.partner.logoUrl) }} style={styles.partnerLogo} />
              ) : (
                <View style={[styles.partnerLogo, { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>
                    {data.partner.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.partnerName, { color: colors.text }]} numberOfLines={1}>
                  {data.partner.name}
                </Text>
                <Text style={[styles.partnerCity, { color: colors.textSecondary }]}>
                  {data.partner.city} · {data.partner.phone}
                </Text>
              </View>
            </View>
            {data.partner.description && (
              <Text style={[styles.partnerDesc, { color: colors.textSecondary }]}>
                {data.partner.description}
              </Text>
            )}
          </View>

          {/* Carte — affichée uniquement si le partenaire a des coords */}
          {data.partner.latitude != null && data.partner.longitude != null && (
            <View style={[styles.mapBlock, { borderColor: colors.border }]}>
              <View style={styles.mapHeader}>
                <Ionicons name="location" size={16} color={colors.primary} />
                <Text style={[styles.mapTitle, { color: colors.text }]}>
                  Lieu de prise en charge
                </Text>
              </View>
              <View style={styles.mapWrapper}>
                <MapView
                  provider={PROVIDER_DEFAULT}
                  style={styles.map}
                  initialRegion={{
                    latitude: Number(data.partner.latitude),
                    longitude: Number(data.partner.longitude),
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }}
                  // Désactive les gestes — la map est un aperçu, pas une nav.
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                >
                  <Marker
                    coordinate={{
                      latitude: Number(data.partner.latitude),
                      longitude: Number(data.partner.longitude),
                    }}
                    title={data.partner.name}
                    description={data.partner.city}
                  />
                </MapView>
              </View>
              <Text style={[styles.mapHint, { color: colors.textSecondary }]}>
                {data.partner.city} · contactez le partenaire pour les détails du point de rendez-vous.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* CTA bottom — placeholder pour phase 2 */}
      <View style={[styles.cta, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View>
          <Text style={[styles.ctaPriceLabel, { color: colors.textSecondary }]}>À partir de</Text>
          <Text style={[styles.ctaPrice, { color: colors.text }]}>{formatPrice(data.pricePerDay)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
          onPress={openBooking}
        >
          <Ionicons name="calendar" size={16} color="#fff" />
          <Text style={styles.ctaBtnText}>Réserver</Text>
        </TouchableOpacity>
      </View>

      {/* === Modal Booking === */}
      <Modal
        visible={bookingOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setBookingOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {bookingPaid ? 'Réservation confirmée' : bookingId ? 'Confirmer le paiement' : 'Réserver le véhicule'}
              </Text>
              <TouchableOpacity onPress={() => setBookingOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 480 }}>
              {/* Étape 1 — Choix des dates (avant création de la booking) */}
              {!bookingId && !bookingPaid && (
                <>
                  <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
                    Date de début
                  </Text>
                  <TouchableOpacity
                    style={[styles.dateBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => setPickingField('start')}
                  >
                    <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                    <Text style={[styles.dateBtnText, { color: colors.text }]}>
                      {startDate.toLocaleDateString('fr-FR', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Text>
                  </TouchableOpacity>

                  <Text style={[styles.modalLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                    Date de fin
                  </Text>
                  <TouchableOpacity
                    style={[styles.dateBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => setPickingField('end')}
                  >
                    <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                    <Text style={[styles.dateBtnText, { color: colors.text }]}>
                      {endDate.toLocaleDateString('fr-FR', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Text>
                  </TouchableOpacity>

                  <View style={[styles.summaryBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <SummaryRow label="Durée" value={`${computedDays} jour(s)`} colors={colors} />
                    <SummaryRow
                      label={`${formatPrice(data.pricePerDay)} × ${computedDays}`}
                      value={formatPrice(computedTotal)}
                      colors={colors}
                    />
                    {Number(data.deposit) > 0 && (
                      <SummaryRow
                        label="Caution à verser sur place"
                        value={formatPrice(data.deposit)}
                        colors={colors}
                      />
                    )}
                    <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                    <SummaryRow
                      label="Total à payer"
                      value={formatPrice(computedTotal)}
                      bold
                      colors={colors}
                    />
                  </View>

                  {data.minDays > 1 && computedDays < data.minDays && (
                    <Text style={[styles.warnText, { color: colors.error }]}>
                      ⚠ Durée minimum : {data.minDays} jour(s).
                    </Text>
                  )}
                </>
              )}

              {/* Étape 2 — Récap avant paiement */}
              {bookingId && !bookingPaid && (
                <View
                  style={[
                    styles.summaryBox,
                    { backgroundColor: colors.background, borderColor: colors.border, marginTop: 4 },
                  ]}
                >
                  <View style={styles.confirmBadge}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                    <Text style={[styles.confirmBadgeText, { color: colors.success }]}>
                      Réservation créée
                    </Text>
                  </View>
                  <Text style={[styles.confirmCode, { color: colors.text }]}>
                    {bookingConfirm}
                  </Text>
                  <Text style={[styles.confirmHint, { color: colors.textSecondary }]}>
                    {bookingDays} jour(s) · {data.city}
                  </Text>
                  <View style={[styles.summaryDivider, { backgroundColor: colors.border, marginVertical: 12 }]} />
                  <SummaryRow
                    label="Montant à débiter"
                    value={formatPrice(bookingTotal)}
                    bold
                    colors={colors}
                  />
                  <Text style={[styles.confirmHint, { color: colors.textSecondary, marginTop: 8 }]}>
                    Le montant sera prélevé sur votre wallet M'Paye.
                  </Text>
                </View>
              )}

              {/* Étape 3 — Succès */}
              {bookingPaid && (
                <View style={styles.successBox}>
                  <View style={[styles.successCircle, { backgroundColor: `${colors.success}25` }]}>
                    <Ionicons name="checkmark" size={36} color={colors.success} />
                  </View>
                  <Text style={[styles.successTitle, { color: colors.text }]}>Paiement confirmé !</Text>
                  <Text style={[styles.confirmCode, { color: colors.text, marginTop: 8 }]}>
                    {bookingConfirm}
                  </Text>
                  <Text style={[styles.confirmHint, { color: colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>
                    Présentez ce code au partenaire à la prise en charge.
                  </Text>
                </View>
              )}

              {bookingError && (
                <View style={[styles.errorBox, { backgroundColor: `${colors.error}15`, borderColor: colors.error }]}>
                  <Ionicons name="alert-circle" size={16} color={colors.error} />
                  <Text style={[styles.errorText, { color: colors.error }]}>{bookingError}</Text>
                </View>
              )}
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              {!bookingId && !bookingPaid && (
                <TouchableOpacity
                  style={[
                    styles.modalCta,
                    {
                      backgroundColor: colors.primary,
                      opacity: computedDays < data.minDays || bookingBusy ? 0.5 : 1,
                    },
                  ]}
                  onPress={submitBooking}
                  disabled={bookingBusy || computedDays < data.minDays}
                >
                  {bookingBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalCtaText}>Continuer ({formatPrice(computedTotal)})</Text>
                  )}
                </TouchableOpacity>
              )}

              {bookingId && !bookingPaid && (
                <>
                  <TouchableOpacity
                    style={[styles.modalCta, { backgroundColor: colors.primary, opacity: bookingBusy ? 0.5 : 1 }]}
                    onPress={payBooking}
                    disabled={bookingBusy}
                  >
                    {bookingBusy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalCtaText}>Payer {formatPrice(bookingTotal)}</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setBookingOpen(false)}
                    style={styles.modalCancel}
                  >
                    <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>
                      Annuler — réservation gardée en pending
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {bookingPaid && (
                <TouchableOpacity
                  style={[styles.modalCta, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setBookingOpen(false);
                    router.push('/vehicle-rentals/my-bookings' as any);
                  }}
                >
                  <Text style={styles.modalCtaText}>Voir mes réservations</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* DateTimePicker natif — rendu en dehors du Modal pour éviter les bugs Android */}
      {pickingField && (
        <DateTimePicker
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          value={pickingField === 'start' ? startDate : endDate}
          minimumDate={pickingField === 'start' ? todayMidnight : startDate}
          onChange={onDateChange}
        />
      )}
    </View>
  );
}

function SummaryRow({
  label,
  value,
  bold,
  colors,
}: {
  label: string;
  value: string;
  bold?: boolean;
  colors: any;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text
        style={{ color: bold ? colors.text : colors.textSecondary, fontSize: 13, fontWeight: bold ? '700' : '400' }}
      >
        {label}
      </Text>
      <Text
        style={{ color: colors.text, fontSize: bold ? 15 : 13, fontWeight: bold ? '700' : '600' }}
      >
        {value}
      </Text>
    </View>
  );
}

function SpecRow({
  icon,
  label,
  value,
  colors,
  isLast,
}: {
  icon: any;
  label: string;
  value: string;
  colors: any;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.specRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={styles.specRowLeft}>
        <Ionicons name={icon} size={16} color={colors.textSecondary} />
        <Text style={[styles.specRowLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.specRowValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 30 },
  errorTitle: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  btnPrimary: { marginTop: 14, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10 },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },

  photoPlaceholder: { width: '100%', height: 220, alignItems: 'center', justifyContent: 'center' },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: -18 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  content: { padding: 16, paddingBottom: 100 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  price: { fontSize: 26, fontWeight: '800' },
  priceUnit: { fontSize: 13, marginTop: 2 },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  modeBadgeText: { fontSize: 12, fontWeight: '700' },

  specsCard: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, marginBottom: 14 },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  specRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  specRowLabel: { fontSize: 13 },
  specRowValue: { fontSize: 13, fontWeight: '600' },

  block: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
  blockTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  blockText: { fontSize: 13, lineHeight: 19 },

  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  partnerLogo: { width: 44, height: 44, borderRadius: 10 },
  partnerName: { fontSize: 14, fontWeight: '700' },
  partnerCity: { fontSize: 12, marginTop: 2 },
  partnerDesc: { fontSize: 12, lineHeight: 18, marginTop: 10 },

  // === Carte (lieu de prise en charge) ===
  // borderRadius sur le wrapper + overflow:hidden pour que la map respecte
  // les coins arrondis (sinon les tuiles débordent).
  mapBlock: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  mapHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  mapTitle: { fontSize: 14, fontWeight: '700' },
  mapWrapper: {
    height: 180,
    borderRadius: 10,
    overflow: 'hidden',
  },
  map: { width: '100%', height: '100%' },
  mapHint: { fontSize: 11, marginTop: 10, lineHeight: 15 },

  cta: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderTopWidth: 1,
  },
  ctaPriceLabel: { fontSize: 11 },
  ctaPrice: { fontSize: 18, fontWeight: '700' },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  ctaBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // === Modal Booking ===
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 18,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', flex: 1 },
  modalLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },

  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  dateBtnText: { fontSize: 14, fontWeight: '600' },

  summaryBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryDivider: { height: 1, marginVertical: 8 },

  warnText: { fontSize: 12, marginTop: 8, fontWeight: '600' },

  confirmBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  confirmBadgeText: { fontSize: 13, fontWeight: '700' },
  confirmCode: { fontSize: 22, fontWeight: '800', letterSpacing: 2, marginTop: 8 },
  confirmHint: { fontSize: 12 },

  successBox: { alignItems: 'center', paddingVertical: 20, gap: 4 },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: 16, fontWeight: '700', marginTop: 6 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { fontSize: 12, flex: 1, lineHeight: 17 },

  modalActions: { marginTop: 14, gap: 10 },
  modalCta: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCtaText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modalCancel: { alignItems: 'center', paddingVertical: 6 },
  modalCancelText: { fontSize: 12, fontWeight: '600' },
});

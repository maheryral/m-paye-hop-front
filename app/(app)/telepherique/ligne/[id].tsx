// app/(app)/telepherique/ligne/[id].tsx — Détail ligne + achat ticket
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { useBiometricGuard } from '../../../../src/contexts/BiometricGuardContext';
import {
  telepheriqueApi,
  TLPLigne,
  TLPStation,
  TLPTarif,
} from '../../../../src/services/telepheriqueApi';

const BLUE_GRADIENT: [string, string] = ['#2563eb', '#1e40af'];
const BLUE_GRADIENT_LIGHT: [string, string] = ['#1e3a8a', '#3b82f6'];

export default function LigneDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { requireBiometric } = useBiometricGuard();

  const [ligne, setLigne] = useState<TLPLigne | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tarifId, setTarifId] = useState<string | null>(null);
  const [departId, setDepartId] = useState<string | null>(null);
  const [arriveeId, setArriveeId] = useState<string | null>(null);

  const [buying, setBuying] = useState(false);
  const [payMode, setPayMode] = useState<'wallet' | 'cash' | null>(null);
  const [paying, setPaying] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const res = await telepheriqueApi.getLigne(id);
      setLigne(res.data);
      if (res.data.tarifs && res.data.tarifs.length > 0 && !tarifId) {
        setTarifId(res.data.tarifs[0].id);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [id, tarifId]);

  useEffect(() => {
    load();
  }, [load]);

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('fr-FR').format(n) + ' Ar';

  const selectedTarif = ligne?.tarifs?.find((t) => t.id === tarifId) || null;
  const selectedDepart = ligne?.stations?.find((s) => s.id === departId) || null;
  const selectedArrivee = ligne?.stations?.find((s) => s.id === arriveeId) || null;

  const canBuy =
    tarifId &&
    departId &&
    arriveeId &&
    departId !== arriveeId &&
    ligne?.statut === 'actif';

  const handleBuy = async () => {
    if (!canBuy || !ligne) return;
    setBuying(true);
    try {
      const res = await telepheriqueApi.createTicket({
        ligneId: ligne.id,
        tarifId: tarifId!,
        stationDepartId: departId!,
        stationArriveeId: arriveeId!,
      });
      setCreatedTicketId(res.data.id);
      setShowPayModal(true);
    } catch (e: any) {
      Alert.alert(
        'Erreur',
        e?.response?.data?.message || 'Impossible de créer le ticket',
      );
    } finally {
      setBuying(false);
    }
  };

  const handlePay = async (mode: 'wallet' | 'cash') => {
    if (!createdTicketId) return;
    if (mode === 'wallet' && selectedTarif) {
      const ok = await requireBiometric(
        `Confirmez le paiement de ${formatPrice(Number(selectedTarif.prix))}`,
      );
      if (!ok) return;
    }
    setPayMode(mode);
    setPaying(true);
    try {
      const res = await telepheriqueApi.payTicket(createdTicketId, mode);
      setShowPayModal(false);
      Alert.alert(
        'Paiement réussi ✅',
        `Ticket ${res.data.codeQR} valide jusqu'au ${new Date(res.data.dateValidite).toLocaleString('fr-FR')}`,
        [
          {
            text: 'Voir mes tickets',
            onPress: () => router.push('/telepherique/my-tickets' as any),
          },
          { text: 'OK', style: 'cancel' },
        ],
      );
      // Reset
      setCreatedTicketId(null);
      setDepartId(null);
      setArriveeId(null);
    } catch (e: any) {
      Alert.alert(
        'Échec du paiement',
        e?.response?.data?.message || 'Paiement impossible',
      );
    } finally {
      setPaying(false);
      setPayMode(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      </SafeAreaView>
    );
  }

  if (!ligne) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.center}>
          <Text style={{ color: colors.text }}>{error || 'Ligne introuvable'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const accent = '#1e40af'; // thème bleu sombre — couleur de ligne ignorée

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <LinearGradient
        colors={BLUE_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: '#fff' }]} numberOfLines={1}>
              {ligne.code} · {ligne.nom}
            </Text>
            <View style={styles.iconBtn} />
          </View>

          <View style={styles.heroMeta}>
            {ligne.description && (
              <Text style={styles.heroDesc}>{ligne.description}</Text>
            )}
            <View style={styles.heroMetaRow}>
              {ligne.horaireOuverture && (
                <Text style={styles.heroMetaText}>
                  🕐 {ligne.horaireOuverture} - {ligne.horaireFermeture}
                </Text>
              )}
              {ligne.longueurKm != null && (
                <Text style={styles.heroMetaText}>📏 {ligne.longueurKm} km</Text>
              )}
              {ligne.dureeMinutes != null && (
                <Text style={styles.heroMetaText}>⏱ {ligne.dureeMinutes} min</Text>
              )}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>

        {/* Sélection tarif */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Choisissez un tarif
        </Text>
        <View style={styles.tarifsGrid}>
          {ligne.tarifs?.map((t) => {
            const isSelected = tarifId === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.tarifCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  isSelected && { borderColor: accent, borderWidth: 2 },
                ]}
                onPress={() => setTarifId(t.id)}
              >
                <Text style={[styles.tarifType, { color: accent }]}>{t.type}</Text>
                <Text style={[styles.tarifLibelle, { color: colors.text }]}>
                  {t.libelle}
                </Text>
                <Text style={[styles.tarifPrix, { color: colors.text }]}>
                  {formatPrice(Number(t.prix))}
                </Text>
                <Text style={[styles.tarifValid, { color: colors.textSecondary }]}>
                  valide {t.validiteHeures}h
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sélection trajet */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Trajet
        </Text>
        <View
          style={[
            styles.tripCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
            DÉPART
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {ligne.stations?.map((s) => (
              <StationPill
                key={`d-${s.id}`}
                station={s}
                selected={departId === s.id}
                accent={accent}
                onPress={() => setDepartId(s.id)}
                colors={colors}
              />
            ))}
          </ScrollView>

          <View style={styles.arrowDown}>
            <Ionicons name="arrow-down" size={20} color={accent} />
          </View>

          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
            ARRIVÉE
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {ligne.stations?.map((s) => (
              <StationPill
                key={`a-${s.id}`}
                station={s}
                selected={arriveeId === s.id}
                disabled={s.id === departId}
                accent={accent}
                onPress={() => setArriveeId(s.id)}
                colors={colors}
              />
            ))}
          </ScrollView>
        </View>

        {/* Récap */}
        {canBuy && selectedTarif && (
          <View
            style={[
              styles.recap,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.recapRow}>
              <Text style={[styles.recapLabel, { color: colors.textSecondary }]}>
                Tarif
              </Text>
              <Text style={[styles.recapValue, { color: colors.text }]}>
                {selectedTarif.libelle}
              </Text>
            </View>
            <View style={styles.recapRow}>
              <Text style={[styles.recapLabel, { color: colors.textSecondary }]}>
                Trajet
              </Text>
              <Text style={[styles.recapValue, { color: colors.text }]}>
                {selectedDepart?.nom} → {selectedArrivee?.nom}
              </Text>
            </View>
            <View style={[styles.recapRow, { marginTop: 8 }]}>
              <Text style={[styles.recapLabel, { color: colors.textSecondary }]}>
                Total
              </Text>
              <Text style={[styles.recapTotal, { color: accent }]}>
                {formatPrice(Number(selectedTarif.prix))}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bouton acheter (sticky) */}
      <View
        style={[
          styles.footer,
          { backgroundColor: colors.background, borderTopColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={handleBuy}
          disabled={!canBuy || buying}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={canBuy ? BLUE_GRADIENT_LIGHT : ['#9ca3af', '#9ca3af']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buyBtn}
          >
            {buying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="ticket" size={18} color="#fff" />
                <Text style={styles.buyBtnText}>
                  {canBuy
                    ? `Acheter • ${formatPrice(Number(selectedTarif?.prix ?? 0))}`
                    : 'Choisissez tarif & trajet'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Modal paiement */}
      <Modal visible={showPayModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Mode de paiement
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Total à payer : {formatPrice(Number(selectedTarif?.prix ?? 0))}
            </Text>

            <TouchableOpacity
              style={[styles.payOption, { borderColor: accent }]}
              onPress={() => handlePay('wallet')}
              disabled={paying}
            >
              <Ionicons name="wallet" size={28} color={accent} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.payOptionTitle, { color: colors.text }]}>
                  Wallet M'Paye
                </Text>
                <Text style={[styles.payOptionDesc, { color: colors.textSecondary }]}>
                  Paiement immédiat depuis votre solde
                </Text>
              </View>
              {paying && payMode === 'wallet' && (
                <ActivityIndicator color={accent} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.payOption, { borderColor: colors.border }]}
              onPress={() => handlePay('cash')}
              disabled={paying}
            >
              <Ionicons name="cash" size={28} color="#f59e0b" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.payOptionTitle, { color: colors.text }]}>
                  Espèces
                </Text>
                <Text style={[styles.payOptionDesc, { color: colors.textSecondary }]}>
                  À la station
                </Text>
              </View>
              {paying && payMode === 'cash' && (
                <ActivityIndicator color="#f59e0b" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => {
                if (!paying) setShowPayModal(false);
              }}
            >
              <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>
                Annuler
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StationPill({
  station,
  selected,
  disabled,
  accent,
  onPress,
  colors,
}: {
  station: TLPStation;
  selected: boolean;
  disabled?: boolean;
  accent: string;
  onPress: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      style={[
        pillStyles.pill,
        { backgroundColor: colors.background, borderColor: colors.border },
        selected && { backgroundColor: accent, borderColor: accent },
        disabled && { opacity: 0.3 },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          pillStyles.text,
          { color: colors.text },
          selected && { color: '#fff', fontWeight: '700' },
        ]}
        numberOfLines={1}
      >
        {station.ordre}. {station.nom}
      </Text>
    </TouchableOpacity>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginVertical: 4,
  },
  text: { fontSize: 12, fontWeight: '500' },
});

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
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 8 },

  headerGradient: {
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
  },
  heroMeta: { paddingHorizontal: 20, paddingTop: 4 },
  heroDesc: { color: '#e2e8f0', fontSize: 13, marginBottom: 10 },
  heroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  heroMetaText: { color: '#cbd5e1', fontSize: 12 },

  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },

  tarifsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  tarifCard: {
    minWidth: '47%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  tarifType: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  tarifLibelle: { fontSize: 13, fontWeight: '600' },
  tarifPrix: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  tarifValid: { fontSize: 10 },

  tripCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  formLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, marginTop: 6 },
  arrowDown: { alignItems: 'center', marginVertical: 6 },

  recap: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recapLabel: { fontSize: 12 },
  recapValue: { fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  recapTotal: { fontSize: 18, fontWeight: '800' },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    borderTopWidth: 1,
  },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  buyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    gap: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#9ca3af',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalSubtitle: { fontSize: 13, marginBottom: 8 },
  payOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  payOptionTitle: { fontSize: 14, fontWeight: '700' },
  payOptionDesc: { fontSize: 11, marginTop: 2 },
  modalClose: { alignItems: 'center', paddingVertical: 12 },
  modalCloseText: { fontSize: 14, fontWeight: '600' },
});

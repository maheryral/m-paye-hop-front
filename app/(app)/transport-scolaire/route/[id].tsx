// app/(app)/transport-scolaire/route/[id].tsx
// Détail route + flow d'abonnement :
//   1. User voit infos route (école, horaires, arrêts, plans)
//   2. Sélectionne un plan tarifaire
//   3. Sélectionne 1..N enfants (selon plan.min/maxStudents)
//   4. Choisit son arrêt de pickup
//   5. Confirme → POST /subscriptions → redirect vers paiement

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import {
  transportScolaireApi,
  type RoutePricingPlan,
  type Student,
  type TransportRoutePublic,
  type TransportStop,
} from '../../../../src/services/transportScolaireApi';

const DAYS_LABEL: Record<string, string> = {
  MON: 'Lun', TUE: 'Mar', WED: 'Mer', THU: 'Jeu', FRI: 'Ven', SAT: 'Sam', SUN: 'Dim',
};

export default function RouteDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id: rid } = useLocalSearchParams<{ id: string }>();
  const routeId = Array.isArray(rid) ? rid[0] : rid;

  const [route, setRoute] = useState<TransportRoutePublic | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // État du flow d'abonnement
  const [selectedPlan, setSelectedPlan] = useState<RoutePricingPlan | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [showSubModal, setShowSubModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!routeId) return;
    (async () => {
      try {
        const [r, s] = await Promise.all([
          transportScolaireApi.getRoute(routeId),
          transportScolaireApi.listStudents(),
        ]);
        setRoute(r.data);
        setStudents((s.data ?? []).filter((x) => x.isActive));
      } catch (e: any) {
        Alert.alert('Erreur', e?.response?.data?.message ?? 'Chargement échoué');
      } finally {
        setLoading(false);
      }
    })();
  }, [routeId]);

  const openSubscriptionFlow = (plan: RoutePricingPlan) => {
    if (students.length === 0) {
      Alert.alert(
        'Aucun enfant',
        'Ajoutez d\'abord un enfant dans "Mes enfants" pour souscrire.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Ajouter', onPress: () => router.push('/transport-scolaire/students') },
        ],
      );
      return;
    }
    setSelectedPlan(plan);
    setSelectedStudentIds(new Set());
    setSelectedStopId(null);
    setShowSubModal(true);
  };

  const toggleStudent = (sid: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(sid)) next.delete(sid);
    else next.add(sid);
    setSelectedStudentIds(next);
  };

  const canSubmit = useMemo(() => {
    if (!selectedPlan) return false;
    const count = selectedStudentIds.size;
    return count >= selectedPlan.minStudents && count <= selectedPlan.maxStudents;
  }, [selectedPlan, selectedStudentIds]);

  const handleSubscribe = async () => {
    if (!routeId || !selectedPlan || !canSubmit) return;
    setSubmitting(true);
    try {
      const res = await transportScolaireApi.createSubscription({
        routeId,
        pricingPlanId: selectedPlan.id,
        studentIds: Array.from(selectedStudentIds),
        pickupStopId: selectedStopId ?? undefined,
      });
      const sub = res.data;
      setShowSubModal(false);

      // Propose le paiement immédiat
      Alert.alert(
        'Abonnement créé ✅',
        `Code : ${sub.codeAbonnement}\nMontant : ${Number(sub.prixApplique).toLocaleString('fr-FR')} Ar\n\nVoulez-vous payer maintenant ?`,
        [
          {
            text: 'Plus tard',
            style: 'cancel',
            onPress: () => router.push('/transport-scolaire/my-subscriptions'),
          },
          {
            text: 'Payer',
            onPress: async () => {
              try {
                await transportScolaireApi.paySubscription(sub.id);
                Alert.alert('Paiement réussi ✅', 'Abonnement activé !', [
                  { text: 'OK', onPress: () => router.push('/transport-scolaire/my-subscriptions') },
                ]);
              } catch (e: any) {
                Alert.alert(
                  'Paiement échoué',
                  e?.response?.data?.message ?? 'Réessayez depuis Mes abonnements.',
                  [{ text: 'OK', onPress: () => router.push('/transport-scolaire/my-subscriptions') }],
                );
              }
            },
          },
        ],
      );
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message ?? 'Création échouée');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }
  if (!route) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Route introuvable</Text>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backCta, { backgroundColor: colors.primary }]}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const jours = (route.joursDesservis ?? []).map((d) => DAYS_LABEL[d] ?? d).join(' · ');
  const capacityLeft = route.capaciteRestante ?? Math.max(0, route.capaciteMax - (route._count?.subscriptions ?? 0));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {route.nom}
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero école */}
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          {route.school?.logoUrl ? (
            <Image source={{ uri: route.school.logoUrl }} style={styles.heroLogo} />
          ) : (
            <View style={[styles.heroLogo, { backgroundColor: '#ffffff20', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="school" size={28} color="#fff" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.heroSchoolName}>{route.school?.nom ?? '—'}</Text>
            <Text style={styles.heroCity}>{route.school?.ville ?? ''}</Text>
          </View>
        </View>

        {/* Infos route */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <InfoRow icon="time-outline" label="Horaires" value={`${route.heureDepartMatin ?? '—'} → ${route.heureRetourSoir ?? '—'}`} colors={colors} />
          <InfoRow icon="calendar-outline" label="Jours" value={jours || 'Non précisé'} colors={colors} />
          <InfoRow
            icon="people-outline"
            label="Capacité"
            value={`${capacityLeft} place(s) restante(s) / ${route.capaciteMax}`}
            colors={colors}
            danger={capacityLeft === 0}
          />
        </View>

        {/* Arrêts */}
        {route.stops.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Arrêts ({route.stops.length})</Text>
            {route.stops.map((stop, idx) => (
              <View key={stop.id} style={styles.stopRow}>
                <View style={[styles.stopDot, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stopDotText}>{stop.ordre}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stopName, { color: colors.text }]}>{stop.nom}</Text>
                  {stop.heurePassage && (
                    <Text style={[styles.stopTime, { color: colors.textSecondary }]}>{stop.heurePassage}</Text>
                  )}
                </View>
                {idx < route.stops.length - 1 && <View style={[styles.stopLine, { backgroundColor: colors.border }]} />}
              </View>
            ))}
          </View>
        )}

        {/* Plans tarifaires */}
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: 4 }]}>
            Formules disponibles
          </Text>
          {route.pricingPlans.length === 0 ? (
            <View style={[styles.emptyPlans, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                Aucune formule active pour cette route.
              </Text>
            </View>
          ) : (
            route.pricingPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onPress={() => openSubscriptionFlow(plan)}
                colors={colors}
                disabled={capacityLeft === 0}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal flow d'abonnement */}
      <Modal
        visible={showSubModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSubModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowSubModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Confirmer l'abonnement</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
              {/* Plan choisi */}
              {selectedPlan && (
                <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Formule</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedPlan.label}</Text>
                  <Text style={[styles.summaryPrice, { color: colors.primary }]}>
                    {Number(selectedPlan.prix).toLocaleString('fr-FR')} Ar
                  </Text>
                  <Text style={[styles.summaryHint, { color: colors.textSecondary }]}>
                    {selectedPlan.minStudents === selectedPlan.maxStudents
                      ? `${selectedPlan.minStudents} enfant${selectedPlan.minStudents > 1 ? 's' : ''}`
                      : `${selectedPlan.minStudents} à ${selectedPlan.maxStudents} enfants`}
                    {' · '}
                    {selectedPlan.dureeJours} jour{selectedPlan.dureeJours > 1 ? 's' : ''}
                  </Text>
                </View>
              )}

              {/* Sélection enfants */}
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: 4, marginBottom: 8 }]}>
                  Enfant(s) à abonner
                </Text>
                {students.map((s) => {
                  const selected = selectedStudentIds.has(s.id);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => toggleStudent(s.id)}
                      style={[
                        styles.studentRow,
                        {
                          backgroundColor: colors.card,
                          borderColor: selected ? colors.primary : colors.border,
                          borderWidth: selected ? 2 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.checkBox,
                          { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' },
                        ]}
                      >
                        {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.studentName, { color: colors.text }]}>
                          {s.prenom} {s.nom}
                        </Text>
                        {s.classe && (
                          <Text style={[styles.studentMeta, { color: colors.textSecondary }]}>{s.classe}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Choix de l'arrêt */}
              {route.stops.length > 0 && (
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: 4, marginBottom: 8 }]}>
                    Arrêt de prise en charge
                  </Text>
                  <View style={[styles.stopList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <StopPickItem
                      label="Pas d'arrêt précis"
                      sub="Voir avec le chauffeur"
                      selected={selectedStopId === null}
                      onPress={() => setSelectedStopId(null)}
                      colors={colors}
                    />
                    {route.stops.map((stop) => (
                      <StopPickItem
                        key={stop.id}
                        label={`${stop.ordre}. ${stop.nom}`}
                        sub={stop.heurePassage ?? undefined}
                        selected={selectedStopId === stop.id}
                        onPress={() => setSelectedStopId(stop.id)}
                        colors={colors}
                      />
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={[styles.modalFooter, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
              <TouchableOpacity
                onPress={handleSubscribe}
                disabled={!canSubmit || submitting}
                style={[
                  styles.submitBtn,
                  { backgroundColor: canSubmit ? colors.primary : colors.border, opacity: submitting ? 0.6 : 1 },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {canSubmit
                      ? `Confirmer (${selectedStudentIds.size} enfant${selectedStudentIds.size > 1 ? 's' : ''})`
                      : selectedPlan
                        ? `Sélectionner ${selectedPlan.minStudents}${
                            selectedPlan.maxStudents !== selectedPlan.minStudents ? ` à ${selectedPlan.maxStudents}` : ''
                          } enfant(s)`
                        : 'Sélectionner'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sub-components ────────────

function InfoRow({
  icon, label, value, colors, danger,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  colors: any;
  danger?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={danger ? colors.error : colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: danger ? colors.error : colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function PlanCard({
  plan, onPress, colors, disabled,
}: {
  plan: RoutePricingPlan;
  onPress: () => void;
  colors: any;
  disabled?: boolean;
}) {
  const dureeLabel =
    plan.category === 'MONTHLY'
      ? `${plan.dureeJours / 30 || 1} mois`
      : plan.category === 'QUARTERLY'
        ? `${plan.dureeJours / 90 || 1} trimestre`
        : plan.category === 'PER_TRIP'
          ? '1 trajet'
          : `${plan.dureeJours} jour(s)`;

  const fratrie = plan.maxStudents > 1;

  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.planCard,
        {
          backgroundColor: colors.card,
          borderColor: fratrie ? colors.primary : colors.border,
          borderWidth: fratrie ? 2 : 1,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {fratrie && (
        <View style={[styles.fratrieBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.fratrieBadgeText}>FRATRIE</Text>
        </View>
      )}
      <Text style={[styles.planLabel, { color: colors.text }]}>{plan.label}</Text>
      {plan.description && (
        <Text style={[styles.planDesc, { color: colors.textSecondary }]} numberOfLines={2}>
          {plan.description}
        </Text>
      )}
      <View style={styles.planFooter}>
        <Text style={[styles.planPrice, { color: colors.primary }]}>
          {Number(plan.prix).toLocaleString('fr-FR')} Ar
        </Text>
        <Text style={[styles.planMeta, { color: colors.textSecondary }]}>
          {dureeLabel}
          {' · '}
          {plan.minStudents === plan.maxStudents
            ? `${plan.minStudents} enfant`
            : `${plan.minStudents}-${plan.maxStudents} enfants`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function StopPickItem({
  label, sub, selected, onPress, colors,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.stopPickRow, { borderBottomColor: colors.border }]}>
      <View
        style={[
          styles.radio,
          { borderColor: selected ? colors.primary : colors.border },
        ]}
      >
        {selected && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.stopPickLabel, { color: colors.text }]}>{label}</Text>
        {sub && <Text style={[styles.stopPickSub, { color: colors.textSecondary }]}>{sub}</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle: { fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 16 },
  backCta: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  scroll: { padding: 16, gap: 16, paddingBottom: 40 },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
  },
  heroLogo: { width: 56, height: 56, borderRadius: 14 },
  heroSchoolName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  heroCity: { color: '#ffffffcc', fontSize: 12, marginTop: 2 },

  infoCard: { borderRadius: 14, borderWidth: 1, padding: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  infoLabel: { fontSize: 11 },
  infoValue: { fontSize: 14, fontWeight: '500', marginTop: 2 },

  section: { borderRadius: 14, borderWidth: 1, padding: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6, position: 'relative' },
  stopDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stopDotText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stopName: { fontSize: 14, fontWeight: '500' },
  stopTime: { fontSize: 11, marginTop: 1 },
  stopLine: { position: 'absolute', left: 13, top: 28, bottom: -12, width: 2 },

  emptyPlans: { padding: 16, borderRadius: 14, borderWidth: 1 },
  planCard: {
    padding: 16,
    borderRadius: 14,
    marginTop: 10,
    position: 'relative',
  },
  fratrieBadge: {
    position: 'absolute',
    top: -10,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fratrieBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  planLabel: { fontSize: 15, fontWeight: '700' },
  planDesc: { fontSize: 12, marginTop: 4 },
  planFooter: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  planPrice: { fontSize: 22, fontWeight: '800' },
  planMeta: { fontSize: 11 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { height: '90%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },

  summaryCard: { padding: 16, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  summaryPrice: { fontSize: 28, fontWeight: '800', marginVertical: 6 },
  summaryHint: { fontSize: 12, textAlign: 'center' },

  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  checkBox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  studentName: { fontSize: 14, fontWeight: '600' },
  studentMeta: { fontSize: 11, marginTop: 1 },

  stopList: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  stopPickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderBottomWidth: 1,
  },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  stopPickLabel: { fontSize: 14 },
  stopPickSub: { fontSize: 11, marginTop: 1 },

  modalFooter: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
  },
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

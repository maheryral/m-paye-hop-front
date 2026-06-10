// app/(app)/tontines/[id].tsx
//
// Détail d'une tontine. Affichage différent selon le rôle de l'user :
//   - Organisateur : voit le code partageable, peut inviter d'autres
//     membres via phone/email, peut annuler tant que pending.
//   - Membre simple : voit l'état, peut quitter tant que pending.
//
// Quand la tontine est 'active', on affiche l'ordre tiré au sort et les
// rounds prévus.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useAuth } from '../../../src/contexts/AuthContext';
import GradientHeader from '../../../src/components/GradientHeader';
import { tontineService } from '../../../src/services/api';

interface TontineMember {
  id: string;
  userId: string;
  status: 'invited' | 'joined' | 'declined' | 'left';
  orderInCycle?: number | null;
  joinedAt?: string | null;
}

interface TontineRound {
  id: string;
  roundNumber: number;
  scheduledDate: string;
  beneficiaryUserId: string;
  status: string;
}

interface Tontine {
  id: string;
  name: string;
  description?: string | null;
  organizerId: string;
  monthlyAmount: string | number;
  totalMembers: number;
  cycleDay: number;
  startDate?: string | null;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  inviteCode: string;
  members: TontineMember[];
  rounds: TontineRound[];
}

const formatPrice = (n: string | number) => Number(n).toLocaleString('fr-FR') + ' Ar';
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Couleur + label localisé pour un statut de round. */
function roundStatusMeta(status: string, colors: any): { color: string; label: string } {
  switch (status) {
    case 'paid':
      return { color: colors.success, label: 'Payé' };
    case 'collecting':
      return { color: '#3b82f6', label: 'En cours' };
    case 'incomplete':
      return { color: colors.error, label: 'Incomplet' };
    case 'upcoming':
    default:
      return { color: '#f59e0b', label: 'À venir' };
  }
}

/** Couleur d'une contribution selon son statut. */
function contributionStatusMeta(
  status: string,
  colors: any,
): { color: string; icon: any; label: string } {
  switch (status) {
    case 'paid':
      return { color: colors.success, icon: 'checkmark-circle' as const, label: 'Payée' };
    case 'failed':
      return { color: colors.error, icon: 'close-circle' as const, label: 'Échec' };
    case 'late':
      return { color: '#f59e0b', icon: 'time' as const, label: 'En retard' };
    case 'pending':
    default:
      return { color: colors.textSecondary, icon: 'ellipse-outline' as const, label: 'En attente' };
  }
}

export default function TontineDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();

  const [data, setData] = useState<Tontine | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteIds, setInviteIds] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);

  // Rounds Phase 2 : on charge la liste complète des rounds en parallèle
  // (le `tontine.rounds` du detail est limité à 3 côté backend pour preview).
  type RoundContribution = {
    id: string;
    status: 'pending' | 'paid' | 'failed' | 'late';
    amount: string | number;
    paidAt?: string | null;
    member: { id: string; userId: string };
  };
  type RoundFull = TontineRound & {
    totalCollected: string | number;
    paidOutAt?: string | null;
    contributions: RoundContribution[];
  };
  const [rounds, setRounds] = useState<RoundFull[]>([]);
  const [openRound, setOpenRound] = useState<RoundFull | null>(null);
  const [retryBusy, setRetryBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const t = await tontineService.detail(id);
      setData(t);
      // Si tontine active, on charge aussi la liste complète des rounds
      // pour pouvoir afficher ceux qui sont 'paid' / 'incomplete' avec leur historique.
      if (t.status === 'active' || t.status === 'completed') {
        try {
          const all = await tontineService.listRounds(id);
          setRounds(Array.isArray(all) ? all : []);
        } catch {
          setRounds([]);
        }
      } else {
        setRounds([]);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  /** Relance manuelle d'un round 'incomplete' (organisateur uniquement). */
  const handleRetryRound = async () => {
    if (!openRound || !data) return;
    setRetryBusy(true);
    try {
      await tontineService.retryRound(data.id, openRound.id);
      setOpenRound(null);
      await load();
      Alert.alert('Relance effectuée', 'Les paiements ont été retentés.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Relance impossible.');
    } finally {
      setRetryBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const isOrganizer = data?.organizerId === user?.id;
  const joinedCount = data?.members.filter((m) => m.status === 'joined').length ?? 0;
  const myOrder = data?.members.find((m) => m.userId === user?.id)?.orderInCycle;

  // === Actions ===

  const handleShareCode = async () => {
    if (!data) return;
    const message = `Rejoignez la tontine "${data.name}" sur M'Paye !\n\nCode : ${data.inviteCode}\nCotisation : ${formatPrice(data.monthlyAmount)}/mois\nMembres : ${data.totalMembers}`;
    try {
      await Share.share({ message, title: 'Invitation tontine M\'Paye' });
    } catch {
      /* user cancelled */
    }
  };

  const handleCopyCode = async () => {
    if (!data) return;
    await Clipboard.setStringAsync(data.inviteCode);
    Alert.alert('Copié', `Code "${data.inviteCode}" copié dans le presse-papier.`);
  };

  const handleInvite = async () => {
    if (!data) return;
    const ids = inviteIds
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) return;

    setInviteBusy(true);
    try {
      const res = await tontineService.invite(data.id, ids);
      setInviteOpen(false);
      setInviteIds('');
      await load();
      const parts: string[] = [];
      if (res.invited.length) parts.push(`${res.invited.length} invité(s).`);
      if (res.alreadyMember.length) parts.push(`${res.alreadyMember.length} déjà membre(s).`);
      if (res.notFound.length) parts.push(`${res.notFound.length} non trouvé(s) sur M'Paye.`);
      Alert.alert('Invitations envoyées', parts.join('\n') || 'Aucun envoi.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Invitation impossible.');
    } finally {
      setInviteBusy(false);
    }
  };

  const handleLeave = () => {
    Alert.alert(
      'Quitter la tontine',
      'Vous ne pourrez pas rejoindre à nouveau sans nouvelle invitation. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: async () => {
            try {
              await tontineService.leave(data!.id);
              router.replace('/tontines' as any);
            } catch (e: any) {
              Alert.alert('Erreur', e?.response?.data?.message || 'Impossible.');
            }
          },
        },
      ],
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Annuler la tontine',
      'Cette action est définitive. Tous les membres seront notifiés.',
      [
        { text: 'Garder', style: 'cancel' },
        {
          text: 'Annuler la tontine',
          style: 'destructive',
          onPress: async () => {
            try {
              await tontineService.cancel(data!.id);
              router.replace('/tontines' as any);
            } catch (e: any) {
              Alert.alert('Erreur', e?.response?.data?.message || 'Impossible.');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GradientHeader title="Tontine" />
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GradientHeader title="Tontine" />
        <View style={styles.loadingBox}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.text }]}>Tontine introuvable</Text>
        </View>
      </View>
    );
  }

  const statusLabel =
    data.status === 'active'
      ? 'En cours'
      : data.status === 'completed'
      ? 'Terminée'
      : data.status === 'cancelled'
      ? 'Annulée'
      : 'Recrutement';
  const statusColor =
    data.status === 'active'
      ? colors.success
      : data.status === 'completed'
      ? colors.textSecondary
      : data.status === 'cancelled'
      ? colors.error
      : '#f59e0b';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader title={data.name} subtitle={isOrganizer ? 'Vous êtes organisateur' : 'Membre'} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Statut */}
          <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            <View style={styles.bigAmountRow}>
              <Text style={[styles.bigAmount, { color: colors.text }]}>
                {formatPrice(data.monthlyAmount)}
              </Text>
              <Text style={[styles.bigUnit, { color: colors.textSecondary }]}>/mois/membre</Text>
            </View>
            <Text style={[styles.headerMeta, { color: colors.textSecondary }]}>
              Pot mensuel :{' '}
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {formatPrice(Number(data.monthlyAmount) * data.totalMembers)}
              </Text>
              {' '}· Cycle le {data.cycleDay} du mois
            </Text>
            {data.description && (
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {data.description}
              </Text>
            )}
          </View>

          {/* Code d'invitation — visible uniquement pendant le recrutement */}
          {data.status === 'pending' && (
            <View style={[styles.codeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>
                Code d'invitation
              </Text>
              <Text style={[styles.codeValue, { color: colors.text }]}>{data.inviteCode}</Text>
              <Text style={[styles.codeHint, { color: colors.textSecondary }]}>
                {data.totalMembers - joinedCount > 0
                  ? `Encore ${data.totalMembers - joinedCount} place(s) disponible(s)`
                  : 'Quota atteint — démarrage imminent'}
              </Text>
              <View style={styles.codeActions}>
                <TouchableOpacity
                  style={[styles.codeBtn, { backgroundColor: colors.primary, flex: 1 }]}
                  onPress={handleShareCode}
                >
                  <Ionicons name="share-outline" size={16} color="#fff" />
                  <Text style={styles.codeBtnText}>Partager</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.codeBtnOutline, { borderColor: colors.border }]}
                  onPress={handleCopyCode}
                >
                  <Ionicons name="copy-outline" size={16} color={colors.text} />
                  <Text style={[styles.codeBtnOutlineText, { color: colors.text }]}>Copier</Text>
                </TouchableOpacity>
              </View>
              {isOrganizer && (
                <TouchableOpacity
                  style={[styles.inviteByContactBtn, { borderColor: colors.primary }]}
                  onPress={() => setInviteOpen(true)}
                >
                  <Ionicons name="person-add-outline" size={14} color={colors.primary} />
                  <Text style={[styles.inviteByContactText, { color: colors.primary }]}>
                    Inviter par téléphone / email
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Mon ordre dans le cycle */}
          {data.status === 'active' && myOrder && (
            <View style={[styles.myOrderCard, { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }]}>
              <Ionicons name="trophy" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.myOrderTitle, { color: colors.text }]}>
                  Vous recevrez le pot au round {myOrder}
                </Text>
                <Text style={[styles.myOrderHint, { color: colors.textSecondary }]}>
                  {formatPrice(Number(data.monthlyAmount) * data.totalMembers)} en attente
                </Text>
              </View>
            </View>
          )}

          {/* Membres */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Membres ({joinedCount}/{data.totalMembers})
          </Text>
          <View style={[styles.membersList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {data.members
              .filter((m) => m.status === 'invited' || m.status === 'joined')
              .sort((a, b) => (a.orderInCycle ?? 999) - (b.orderInCycle ?? 999))
              .map((m, idx, arr) => (
                <View
                  key={m.id}
                  style={[
                    styles.memberRow,
                    idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={[styles.memberAvatar, { backgroundColor: colors.primary }]}>
                    {m.orderInCycle ? (
                      <Text style={styles.memberOrder}>{m.orderInCycle}</Text>
                    ) : (
                      <Ionicons name="person" size={14} color="#fff" />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.memberId, { color: colors.text }]} numberOfLines={1}>
                      {m.userId === user?.id ? 'Vous' : `Membre #${m.userId.slice(-6)}`}
                      {m.userId === data.organizerId && (
                        <Text style={[styles.organizerBadge, { color: colors.primary }]}> · Organisateur</Text>
                      )}
                    </Text>
                    <Text
                      style={[
                        styles.memberStatus,
                        { color: m.status === 'joined' ? colors.success : '#f59e0b' },
                      ]}
                    >
                      {m.status === 'joined' ? '✓ A rejoint' : '⏳ En attente'}
                    </Text>
                  </View>
                </View>
              ))}
          </View>

          {/* Rounds (Phase 2) — liste complète avec status. Clic → modal détail */}
          {(data.status === 'active' || data.status === 'completed') && rounds.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Rounds ({rounds.filter((r) => r.status === 'paid').length}/{rounds.length} payés)
              </Text>
              <View style={[styles.roundsList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {rounds.map((r, idx, arr) => {
                  const meta = roundStatusMeta(r.status, colors);
                  return (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => setOpenRound(r)}
                      style={[
                        styles.roundRow,
                        idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                      ]}
                    >
                      <View style={[styles.roundNumber, { backgroundColor: `${meta.color}20` }]}>
                        <Text style={[styles.roundNumberText, { color: meta.color }]}>
                          #{r.roundNumber}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.roundDate, { color: colors.text }]}>
                          {formatDate(r.scheduledDate)}
                        </Text>
                        <Text style={[styles.roundBeneficiary, { color: colors.textSecondary }]} numberOfLines={1}>
                          Bénéficiaire :{' '}
                          {r.beneficiaryUserId === user?.id ? 'Vous' : `#${r.beneficiaryUserId.slice(-6)}`}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <View style={[styles.roundStatusPill, { backgroundColor: `${meta.color}20` }]}>
                          <Text style={[styles.roundStatusText, { color: meta.color }]}>
                            {meta.label}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Actions */}
          {data.status === 'pending' && (
            <View style={styles.dangerActions}>
              {isOrganizer ? (
                <TouchableOpacity
                  style={[styles.dangerBtn, { borderColor: colors.error }]}
                  onPress={handleCancel}
                >
                  <Ionicons name="trash-outline" size={14} color={colors.error} />
                  <Text style={[styles.dangerText, { color: colors.error }]}>
                    Annuler la tontine
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.dangerBtn, { borderColor: colors.error }]}
                  onPress={handleLeave}
                >
                  <Ionicons name="exit-outline" size={14} color={colors.error} />
                  <Text style={[styles.dangerText, { color: colors.error }]}>Quitter</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* === Modal détail d'un round (contributions par membre) === */}
      <Modal
        visible={!!openRound}
        transparent
        animationType="slide"
        onRequestClose={() => setOpenRound(null)}
      >
        {openRound && (
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>
                  Round #{openRound.roundNumber}
                </Text>
                <TouchableOpacity onPress={() => setOpenRound(null)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
                {formatDate(openRound.scheduledDate)} · Bénéficiaire :{' '}
                {openRound.beneficiaryUserId === user?.id
                  ? 'Vous'
                  : `#${openRound.beneficiaryUserId.slice(-6)}`}
              </Text>

              {/* Récap collecté / objectif */}
              <View
                style={{
                  marginVertical: 12,
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <View>
                  <Text style={[styles.contribStatusText, { color: colors.textSecondary }]}>
                    Collecté
                  </Text>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
                    {formatPrice(openRound.totalCollected)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.contribStatusText, { color: colors.textSecondary }]}>
                    Objectif
                  </Text>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
                    {formatPrice(Number(data.monthlyAmount) * openRound.contributions.length)}
                  </Text>
                </View>
              </View>

              <ScrollView style={{ maxHeight: 320 }}>
                <Text
                  style={[styles.modalHint, { color: colors.text, fontWeight: '700', marginBottom: 4 }]}
                >
                  Cotisations
                </Text>
                {openRound.contributions.map((c, idx, arr) => {
                  const m = contributionStatusMeta(c.status, colors);
                  return (
                    <View
                      key={c.id}
                      style={[
                        styles.contribRow,
                        idx < arr.length - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        },
                      ]}
                    >
                      <Ionicons name={m.icon} size={18} color={m.color} />
                      <Text style={[styles.contribLabel, { color: colors.text }]} numberOfLines={1}>
                        {c.member.userId === user?.id
                          ? 'Vous'
                          : `Membre #${c.member.userId.slice(-6)}`}
                      </Text>
                      <Text style={[styles.contribStatusText, { color: m.color }]}>
                        {m.label}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Bouton retry — organisateur uniquement, seulement si incomplete */}
              {isOrganizer && openRound.status === 'incomplete' && (
                <TouchableOpacity
                  style={[styles.retryBtn, { backgroundColor: colors.primary, opacity: retryBusy ? 0.5 : 1 }]}
                  onPress={handleRetryRound}
                  disabled={retryBusy}
                >
                  {retryBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="refresh" size={16} color="#fff" />
                      <Text style={styles.retryBtnText}>Relancer les paiements</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </Modal>

      {/* Modal Inviter par phone/email */}
      <Modal
        visible={inviteOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Inviter des membres</Text>
              <TouchableOpacity onPress={() => setInviteOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
              Téléphones ou emails séparés par des virgules. Les contacts non-inscrits
              recevront le code à utiliser après leur inscription.
            </Text>
            <TextInput
              style={[
                styles.modalTextarea,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
              ]}
              placeholder="0341234567, 0349876543, jean@example.com..."
              placeholderTextColor={colors.textSecondary}
              value={inviteIds}
              onChangeText={setInviteIds}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.modalCta, { backgroundColor: colors.primary, opacity: inviteBusy ? 0.5 : 1 }]}
              onPress={handleInvite}
              disabled={inviteBusy}
            >
              {inviteBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalCtaText}>Envoyer les invitations</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 14 },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 16, fontWeight: '600' },

  headerCard: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  bigAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 6 },
  bigAmount: { fontSize: 26, fontWeight: '800' },
  bigUnit: { fontSize: 12 },
  headerMeta: { fontSize: 12, marginTop: 2 },
  description: { fontSize: 13, marginTop: 8, lineHeight: 18 },

  codeCard: { padding: 16, borderRadius: 14, borderWidth: 1, alignItems: 'center', gap: 6 },
  codeLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  codeValue: { fontSize: 28, fontWeight: '800', letterSpacing: 3 },
  codeHint: { fontSize: 11 },
  codeActions: { flexDirection: 'row', gap: 10, marginTop: 10, width: '100%' },
  codeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10 },
  codeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  codeBtnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, borderWidth: 1 },
  codeBtnOutlineText: { fontSize: 13, fontWeight: '600' },
  inviteByContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    width: '100%',
  },
  inviteByContactText: { fontSize: 12, fontWeight: '700' },

  myOrderCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  myOrderTitle: { fontSize: 13, fontWeight: '700' },
  myOrderHint: { fontSize: 11, marginTop: 2 },

  sectionTitle: { fontSize: 14, fontWeight: '700', marginTop: 4 },

  membersList: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  memberAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  memberOrder: { color: '#fff', fontWeight: '800', fontSize: 12 },
  memberId: { fontSize: 13, fontWeight: '600' },
  organizerBadge: { fontSize: 11, fontWeight: '700' },
  memberStatus: { fontSize: 11, marginTop: 2 },

  roundsList: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  roundRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  roundNumber: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(127,127,127,0.12)', alignItems: 'center', justifyContent: 'center' },
  roundNumberText: { fontSize: 12, fontWeight: '800' },
  roundDate: { fontSize: 13, fontWeight: '600' },
  roundBeneficiary: { fontSize: 11, marginTop: 2 },
  roundStatusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  roundStatusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  // Modal round detail
  contribRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  contribLabel: { fontSize: 13, fontWeight: '600', flex: 1 },
  contribStatusText: { fontSize: 11, fontWeight: '700' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 14,
  },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  dangerActions: { marginTop: 10 },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  dangerText: { fontSize: 13, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalHint: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  modalTextarea: { minHeight: 90, borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 14, textAlignVertical: 'top', marginBottom: 14 },
  modalCta: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalCtaText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

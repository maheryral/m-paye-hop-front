// app/(app)/tontines/index.tsx
//
// Mes tontines — affichage en 2 sections :
//   - Invitations en attente (tontines où je suis 'invited')
//   - Mes tontines actives (tontines où je suis 'joined')
//
// CTA principal : "Créer une tontine" + "Rejoindre avec un code".

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import GradientHeader from '../../../src/components/GradientHeader';
import { tontineService } from '../../../src/services/api';

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
  members: Array<{
    id: string;
    userId: string;
    status: 'invited' | 'joined' | 'declined' | 'left';
    orderInCycle?: number | null;
  }>;
  myMembership?: {
    status: 'invited' | 'joined';
    orderInCycle?: number | null;
    joinedAt?: string | null;
  };
}

const formatPrice = (n: string | number) => Number(n).toLocaleString('fr-FR') + ' Ar';

export default function MyTontines() {
  const router = useRouter();
  const { colors } = useTheme();

  const [items, setItems] = useState<Tontine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await tontineService.list();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // === Actions ===

  const handleAccept = async (id: string) => {
    try {
      await tontineService.accept(id);
      await load(true);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || "Impossible d'accepter.");
    }
  };

  const handleDecline = (id: string) => {
    Alert.alert('Refuser l\'invitation', 'Voulez-vous vraiment refuser ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Refuser',
        style: 'destructive',
        onPress: async () => {
          try {
            await tontineService.decline(id);
            await load(true);
          } catch (e: any) {
            Alert.alert('Erreur', e?.response?.data?.message || 'Échec.');
          }
        },
      },
    ]);
  };

  const handleJoinByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoinBusy(true);
    try {
      await tontineService.joinByCode(code);
      setJoinOpen(false);
      setJoinCode('');
      await load(true);
      Alert.alert('Bienvenue', 'Vous avez rejoint la tontine.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Code invalide.');
    } finally {
      setJoinBusy(false);
    }
  };

  // === Render ===

  const invitations = items.filter((t) => t.myMembership?.status === 'invited');
  const active = items.filter((t) => t.myMembership?.status === 'joined');

  const renderTontineCard = (t: Tontine, isInvite = false) => {
    const joinedCount = t.members.filter((m) => m.status === 'joined').length;
    const progress = (joinedCount / t.totalMembers) * 100;
    const statusColor =
      t.status === 'active'
        ? colors.success
        : t.status === 'completed'
        ? colors.textSecondary
        : t.status === 'cancelled'
        ? colors.error
        : '#f59e0b';
    const statusLabel =
      t.status === 'active'
        ? 'En cours'
        : t.status === 'completed'
        ? 'Terminée'
        : t.status === 'cancelled'
        ? 'Annulée'
        : 'Recrutement';

    return (
      <TouchableOpacity
        key={t.id}
        activeOpacity={0.85}
        onPress={() => !isInvite && router.push(`/tontines/${t.id}` as any)}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.icon, { backgroundColor: `${colors.primary}20` }]}>
            <Ionicons name="people" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {t.name}
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
              <Text style={[styles.dotSeparator, { color: colors.textSecondary }]}>·</Text>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {joinedCount}/{t.totalMembers} membres
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.amountRow}>
          <Text style={[styles.amountValue, { color: colors.text }]}>
            {formatPrice(t.monthlyAmount)}
          </Text>
          <Text style={[styles.amountUnit, { color: colors.textSecondary }]}>/ mois</Text>
        </View>

        {/* Barre de progression de recrutement (uniquement si pending) */}
        {t.status === 'pending' && (
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%`, backgroundColor: colors.primary },
              ]}
            />
          </View>
        )}

        {/* Pot et ordre (uniquement si active) */}
        {t.status === 'active' && t.myMembership?.orderInCycle && (
          <View style={[styles.infoBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name="trophy-outline" size={14} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Vous recevrez le pot au round{' '}
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {t.myMembership.orderInCycle}/{t.totalMembers}
              </Text>
            </Text>
          </View>
        )}

        {/* Actions d'invitation */}
        {isInvite && (
          <View style={styles.inviteActions}>
            <TouchableOpacity
              style={[styles.inviteBtn, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={() => handleAccept(t.id)}
            >
              <Ionicons name="checkmark" size={14} color="#fff" />
              <Text style={styles.inviteBtnText}>Accepter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.inviteBtnOutline, { borderColor: colors.error }]}
              onPress={() => handleDecline(t.id)}
            >
              <Ionicons name="close" size={14} color={colors.error} />
              <Text style={[styles.inviteBtnOutlineText, { color: colors.error }]}>Refuser</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title="Mes tontines"
        subtitle="Épargne collective"
        rightIcon="add"
        onRightPress={() => router.push('/tontines/new' as any)}
      />

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
          {/* CTA "Rejoindre avec un code" — visible en haut, pas en bouton noyé */}
          <TouchableOpacity
            style={[styles.joinBar, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setJoinOpen(true)}
          >
            <View style={[styles.joinIcon, { backgroundColor: `${colors.primary}20` }]}>
              <Ionicons name="enter-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.joinTitle, { color: colors.text }]}>
                Rejoindre une tontine
              </Text>
              <Text style={[styles.joinHint, { color: colors.textSecondary }]}>
                Saisissez le code partagé par l'organisateur
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <>
              {invitations.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    📨 Invitations ({invitations.length})
                  </Text>
                  {invitations.map((t) => renderTontineCard(t, true))}
                </View>
              )}

              {active.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Mes tontines ({active.length})
                  </Text>
                  {active.map((t) => renderTontineCard(t, false))}
                </View>
              )}

              {invitations.length === 0 && active.length === 0 && (
                <View style={styles.emptyBox}>
                  <Ionicons name="people-outline" size={56} color={colors.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    Aucune tontine
                  </Text>
                  <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                    Créez votre première tontine pour épargner en groupe, ou
                    rejoignez-en une avec un code d'invitation.
                  </Text>
                  <TouchableOpacity
                    style={[styles.emptyCta, { backgroundColor: colors.primary }]}
                    onPress={() => router.push('/tontines/new' as any)}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text style={styles.emptyCtaText}>Créer une tontine</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Modal Rejoindre avec code */}
      <Modal
        visible={joinOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setJoinOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Rejoindre une tontine
              </Text>
              <TouchableOpacity onPress={() => setJoinOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Code d'invitation
            </Text>
            <TextInput
              style={[
                styles.codeInput,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
              ]}
              placeholder="TONT-XXXXXX"
              placeholderTextColor={colors.textSecondary}
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.joinCtaBtn, { backgroundColor: colors.primary, opacity: joinBusy || !joinCode ? 0.5 : 1 }]}
              onPress={handleJoinByCode}
              disabled={joinBusy || !joinCode}
            >
              {joinBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.joinCtaText}>Rejoindre</Text>
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
  content: { padding: 16, paddingBottom: 32 },

  joinBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 18,
  },
  joinIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  joinTitle: { fontSize: 14, fontWeight: '700' },
  joinHint: { fontSize: 11, marginTop: 2 },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },

  card: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  dotSeparator: { fontSize: 11 },
  metaText: { fontSize: 11 },

  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  amountValue: { fontSize: 20, fontWeight: '800' },
  amountUnit: { fontSize: 12 },

  progressBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(127,127,127,0.18)', overflow: 'hidden' },
  progressFill: { height: '100%' },

  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10, borderWidth: 1 },
  infoText: { fontSize: 12, flex: 1 },

  inviteActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  inviteBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  inviteBtnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  inviteBtnOutlineText: { fontSize: 13, fontWeight: '700' },

  loadingBox: { paddingVertical: 60, alignItems: 'center' },

  emptyBox: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyHint: { fontSize: 13, textAlign: 'center', paddingHorizontal: 30, lineHeight: 18 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10 },
  emptyCtaText: { color: '#fff', fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  codeInput: { height: 56, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 20, letterSpacing: 4, fontWeight: '700', textAlign: 'center', marginBottom: 14 },
  joinCtaBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  joinCtaText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

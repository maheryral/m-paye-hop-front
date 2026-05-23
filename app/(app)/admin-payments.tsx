// app/(app)/admin-payments.tsx — Écran admin pour valider/rejeter les demandes de dépôt/retrait
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
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSocket } from '../../src/contexts/SocketContext';
import GradientHeader from '../../src/components/GradientHeader';
import { paymentApi, PaymentRequest } from '../../src/services/paymentApi';

export default function AdminPayments() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { onNotification } = useSocket();
  const [items, setItems] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [rejectModal, setRejectModal] = useState<{ id: string; ref: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin = (user as any)?.role === 'ADMIN';

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    try {
      const res = filter === 'pending' ? await paymentApi.listPending() : await paymentApi.listAll();
      setItems(res.data);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Chargement impossible');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh auto à chaque nouvelle demande
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onNotification(() => load());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleApprove = (r: PaymentRequest) => {
    Alert.alert(
      'Approuver',
      `Crédité/débité ${Number(r.amount).toLocaleString('fr-FR')} Ar pour ${r.user?.prenom} ${r.user?.nom} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Approuver',
          onPress: async () => {
            setBusyId(r.id);
            try {
              await paymentApi.approve(r.id);
              load();
            } catch (e: any) {
              Alert.alert('Erreur', e?.response?.data?.message || 'Approval échoué');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) {
      Alert.alert('Erreur', 'Saisissez la raison du rejet');
      return;
    }
    setBusyId(rejectModal.id);
    try {
      await paymentApi.reject(rejectModal.id, rejectReason.trim());
      setRejectModal(null);
      setRejectReason('');
      load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Rejet échoué');
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GradientHeader title="Accès refusé" />
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={48} color={colors.textSecondary} />
          <Text style={[styles.deniedText, { color: colors.text }]}>
            Seuls les administrateurs peuvent accéder à cette page.
          </Text>
        </View>
      </View>
    );
  }

  const renderItem = ({ item: r }: { item: PaymentRequest }) => {
    const isPending = r.status === 'PENDING';
    const amount = Number(r.amount);
    const meta = STATUS[r.status];
    const detailsStr = r.details ? Object.entries(r.details).map(([k, v]) => `${k}: ${v}`).join(' · ') : '';

    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {r.user?.prenom} {r.user?.nom}
            </Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
              {r.user?.email}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: meta.color + '20' }]}>
            <Text style={{ color: meta.color, fontSize: 10, fontWeight: '700' }}>
              {r.status}
            </Text>
          </View>
        </View>

        <View style={styles.cardMid}>
          <View style={styles.row}>
            <Text style={[styles.muted, { color: colors.textSecondary }]}>
              {r.type === 'DEPOSIT' ? '⬇️ Dépôt' : '⬆️ Retrait'} · {r.method}
            </Text>
            <Text style={[styles.amount, { color: colors.text }]}>
              {amount.toLocaleString('fr-FR')} Ar
            </Text>
          </View>
          <Text style={[styles.muted, { color: colors.textSecondary, marginTop: 4 }]}>
            Réf : {r.reference}
          </Text>
          {detailsStr ? (
            <Text style={[styles.muted, { color: colors.textSecondary, marginTop: 4 }]}>
              {detailsStr}
            </Text>
          ) : null}
          {r.rejectionReason && (
            <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
              Rejet : {r.rejectionReason}
            </Text>
          )}
        </View>

        {isPending && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.rejectBtn]}
              disabled={busyId === r.id}
              onPress={() => { setRejectModal({ id: r.id, ref: r.reference }); setRejectReason(''); }}
            >
              <Ionicons name="close" size={16} color="#fff" />
              <Text style={styles.btnText}>Rejeter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.approveBtn]}
              disabled={busyId === r.id}
              onPress={() => handleApprove(r)}
            >
              {busyId === r.id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.btnText}>Approuver</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title="Validation paiements"
        subtitle={`${items.length} demande${items.length > 1 ? 's' : ''}`}
      />

      {/* Filtres */}
      <View style={[styles.filterRow, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'pending' && { backgroundColor: '#1e40af' }]}
          onPress={() => setFilter('pending')}
        >
          <Text style={{ color: filter === 'pending' ? '#fff' : colors.text, fontWeight: '600' }}>
            En attente
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && { backgroundColor: '#1e40af' }]}
          onPress={() => setFilter('all')}
        >
          <Text style={{ color: filter === 'all' ? '#fff' : colors.text, fontWeight: '600' }}>
            Toutes
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e40af" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Aucune demande {filter === 'pending' ? 'en attente' : 'pour le moment'}
              </Text>
            </View>
          }
        />
      )}

      {/* Modal rejet */}
      <Modal visible={!!rejectModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Rejeter {rejectModal?.ref}
            </Text>
            <Text style={[styles.muted, { color: colors.textSecondary, marginBottom: 10 }]}>
              Saisissez la raison (visible par le user)
            </Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Ex : justificatif manquant"
              placeholderTextColor={colors.textSecondary}
              multiline
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.border, flex: 1 }]}
                onPress={() => setRejectModal(null)}
              >
                <Text style={{ color: colors.text, fontWeight: '600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.rejectBtn, { flex: 1 }]}
                onPress={handleReject}
              >
                <Text style={styles.btnText}>Confirmer rejet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const STATUS: Record<string, { color: string }> = {
  PENDING: { color: '#f59e0b' },
  PROCESSING: { color: '#3b82f6' },
  APPROVED: { color: '#10b981' },
  REJECTED: { color: '#ef4444' },
  CANCELLED: { color: '#9ca3af' },
  EXPIRED: { color: '#9ca3af' },
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 },
  deniedText: { textAlign: 'center', fontSize: 14 },
  emptyText: { fontSize: 13 },

  filterRow: { flexDirection: 'row', padding: 8, gap: 8 },
  filterBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
  },

  card: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  userName: { fontSize: 14, fontWeight: '700' },
  userEmail: { fontSize: 11 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  cardMid: { paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.15)' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { fontSize: 11 },
  amount: { fontSize: 16, fontWeight: '800' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 10,
  },
  approveBtn: { backgroundColor: '#10b981' },
  rejectBtn: { backgroundColor: '#ef4444' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalCard: {
    padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  modalInput: {
    borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 80,
  },
});

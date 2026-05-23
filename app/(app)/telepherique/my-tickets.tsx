// app/(app)/telepherique/my-tickets.tsx — Mes tickets téléphérique
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
import { telepheriqueApi, TLPTicket } from '../../../src/services/telepheriqueApi';

export default function MyTickets() {
  const router = useRouter();
  const { colors } = useTheme();
  const { requireBiometric } = useBiometricGuard();

  const [items, setItems] = useState<TLPTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await telepheriqueApi.getMyTickets();
      setItems(res.data);
    } catch (e: any) {
      console.error(e?.response?.data || e?.message);
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
    const ticket = items.find(t => t.id === id);
    const reason = ticket
      ? `Confirmez le paiement de ${new Intl.NumberFormat('fr-FR').format(Number(ticket.prixPaye))} Ar`
      : 'Confirmez le paiement';
    const okBio = await requireBiometric(reason);
    if (!okBio) return;

    try {
      await telepheriqueApi.payTicket(id, 'wallet');
      Alert.alert('Paiement réussi ✅', 'Votre ticket est valide');
      load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Paiement impossible');
    }
  };

  const handleCancel = (id: string) => {
    Alert.alert('Annuler', 'Annuler ce ticket ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        style: 'destructive',
        onPress: async () => {
          try {
            await telepheriqueApi.cancelTicket(id);
            load();
          } catch (e: any) {
            Alert.alert('Erreur', e?.response?.data?.message || 'Annulation impossible');
          }
        },
      },
    ]);
  };

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('fr-FR').format(n) + ' Ar';

  const renderItem = ({ item }: { item: TLPTicket }) => {
    const isPaid = item.statusPaiement === 'paye';
    const isUsed = item.statusTicket === 'utilise';
    const isExpired = item.statusTicket === 'expire' ||
      new Date(item.dateValidite) < new Date();
    const isCancelled = item.statusTicket === 'annule' || item.statusPaiement === 'annule';
    const accent = item.ligne?.couleur || '#1e40af';

    let badgeBg = '#f59e0b';
    let badgeText = 'À PAYER';
    if (isCancelled) {
      badgeBg = '#9ca3af';
      badgeText = 'ANNULÉ';
    } else if (isUsed) {
      badgeBg = '#6366f1';
      badgeText = 'UTILISÉ';
    } else if (isExpired) {
      badgeBg = '#ef4444';
      badgeText = 'EXPIRÉ';
    } else if (isPaid) {
      badgeBg = '#3b82f6';
      badgeText = 'VALIDE';
    }

    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
          (isCancelled || isExpired || isUsed) && { opacity: 0.7 },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.lineDot, { backgroundColor: accent }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.lineCode, { color: accent }]}>
              {item.ligne?.code}
            </Text>
            <Text style={[styles.lineName, { color: colors.text }]} numberOfLines={1}>
              {item.ligne?.nom}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
            <Text style={styles.statusText}>{badgeText}</Text>
          </View>
        </View>

        <View style={styles.routeRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.routeLabel, { color: colors.textSecondary }]}>
              Départ
            </Text>
            <Text style={[styles.routeName, { color: colors.text }]} numberOfLines={1}>
              {item.stationDepart?.nom}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={accent} />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={[styles.routeLabel, { color: colors.textSecondary }]}>
              Arrivée
            </Text>
            <Text style={[styles.routeName, { color: colors.text }]} numberOfLines={1}>
              {item.stationArrivee?.nom}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="pricetag-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {item.tarif?.libelle}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              Valide jusqu'au {new Date(item.dateValidite).toLocaleDateString('fr-FR')}
            </Text>
          </View>
          <Text style={[styles.amount, { color: colors.text }]}>
            {formatPrice(Number(item.prixPaye))}
          </Text>
        </View>

        {isPaid && !isUsed && !isExpired && (
          <View style={[styles.qrBanner, { backgroundColor: accent + '15', borderColor: accent }]}>
            <Ionicons name="qr-code" size={28} color={accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.qrLabel, { color: colors.textSecondary }]}>
                Code à présenter
              </Text>
              <Text style={[styles.qrCode, { color: accent }]}>
                {item.codeQR}
              </Text>
            </View>
          </View>
        )}

        {!isPaid && !isCancelled && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary, { borderColor: colors.border }]}
              onPress={() => handleCancel(item.id)}
            >
              <Text style={[styles.btnText, { color: colors.text }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: accent }]}
              onPress={() => handlePay(item.id)}
            >
              <Ionicons name="wallet-outline" size={16} color="#fff" />
              <Text style={[styles.btnText, { color: '#fff' }]}>Payer</Text>
            </TouchableOpacity>
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
          Mes tickets
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/telepherique' as any)}
          style={styles.iconBtn}
        >
          <Ionicons name="add" size={22} color="#1e40af" />
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
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e40af" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="ticket-outline" size={56} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Aucun ticket
              </Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                Achetez votre 1er ticket téléphérique
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => router.push('/telepherique' as any)}
              >
                <Text style={styles.emptyCtaText}>Voir les lignes</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
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

  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  lineDot: { width: 8, height: 36, borderRadius: 4 },
  lineCode: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  lineName: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  routeLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  routeName: { fontSize: 13, fontWeight: '600', marginTop: 2 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11 },
  amount: { fontSize: 14, fontWeight: '800', marginLeft: 'auto' },

  qrBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  qrLabel: { fontSize: 10, fontWeight: '600' },
  qrCode: { fontSize: 13, fontWeight: '800', letterSpacing: 1, marginTop: 2 },

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
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1 },
  btnText: { fontSize: 13, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
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

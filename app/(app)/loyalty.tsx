// app/(app)/loyalty.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useWallet } from '../../src/contexts/WalletContext';
import {
  merchantApi,
  type LoyaltyAccountSummary,
  type LoyaltyAccountDetail,
} from '../../src/services/merchantApi';

const HISTORY_LABEL: Record<string, string> = {
  EARN: 'Points gagnés',
  WELCOME: 'Bonus de bienvenue',
  REDEEM: 'Échange',
  ADJUST: 'Ajustement',
};

export default function Loyalty() {
  const { colors } = useTheme();
  const { fetchBalance } = useWallet();
  const [accounts, setAccounts] = useState<LoyaltyAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [detail, setDetail] = useState<LoyaltyAccountDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [redeemPts, setRedeemPts] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await merchantApi.myLoyalty();
      setAccounts(Array.isArray(r.data) ? r.data : []);
    } catch (e: any) {
      console.error('loyalty load:', e?.response?.data || e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (merchantId: string) => {
    setDetailBusy(true);
    setRedeemPts('');
    try {
      const r = await merchantApi.getLoyaltyAccount(merchantId);
      setDetail(r.data);
    } finally {
      setDetailBusy(false);
    }
  };

  const redeem = async () => {
    if (!detail) return;
    const pts = Number(redeemPts);
    if (!pts || pts <= 0) {
      Alert.alert('Erreur', 'Nombre de points invalide');
      return;
    }
    setBusy(true);
    try {
      const r = await merchantApi.redeemLoyalty(detail.merchantId, pts);
      await fetchBalance();
      Alert.alert('Échange réussi', `Ar ${r.data.creditedAmount} crédités sur votre wallet.`);
      await openDetail(detail.merchantId);
      load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Échec de l’échange');
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const canRedeem =
    detail?.program.exists &&
    detail?.program.isActive &&
    (detail?.program.pointValue ?? 0) > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {accounts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="gift-outline" size={42} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Aucun point pour le moment. Payez chez des marchands partenaires
              pour cumuler des points.
            </Text>
          </View>
        ) : (
          accounts.map((a) => (
            <TouchableOpacity
              key={a.merchantId}
              style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => openDetail(a.merchantId)}
            >
              {a.merchantLogo ? (
                <Image source={{ uri: a.merchantLogo }} style={styles.logo} />
              ) : (
                <View style={[styles.logo, { backgroundColor: `${colors.primary}20`, alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="gift" size={20} color={colors.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.merchantName, { color: colors.text }]} numberOfLines={1}>
                  {a.merchantName}
                </Text>
                {a.estimatedValue > 0 ? (
                  <Text style={[styles.sub, { color: colors.textSecondary }]}>
                    ≈ Ar {fmt(a.estimatedValue)}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.points, { color: colors.primary }]}>{a.points}</Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>points</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal détail / échange */}
      <Modal
        visible={!!detail || detailBusy}
        animationType="slide"
        transparent
        onRequestClose={() => setDetail(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            {detailBusy || !detail ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: 40 }} />
            ) : (
              <>
                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={1}>
                    {detail.merchantName || 'Marchand'}
                  </Text>
                  <TouchableOpacity onPress={() => setDetail(null)}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.balanceWrap}>
                  <Text style={[styles.bigPoints, { color: colors.primary }]}>{detail.points}</Text>
                  <Text style={[styles.sub, { color: colors.textSecondary }]}>points disponibles</Text>
                  {detail.program.pointValue > 0 ? (
                    <Text style={[styles.sub, { color: colors.textSecondary }]}>
                      ≈ Ar {fmt(detail.points * detail.program.pointValue)}
                    </Text>
                  ) : null}
                </View>

                {canRedeem ? (
                  <View style={[styles.redeemBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.sub, { color: colors.textSecondary }]}>
                      Échanger contre un crédit wallet
                      {detail.program.minRedeemPoints > 0
                        ? ` (min. ${detail.program.minRedeemPoints})`
                        : ''}
                    </Text>
                    <View style={styles.redeemRow}>
                      <TextInput
                        style={[styles.redeemInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                        keyboardType="numeric"
                        placeholder="Points"
                        placeholderTextColor={colors.textSecondary}
                        value={redeemPts}
                        onChangeText={setRedeemPts}
                      />
                      <TouchableOpacity
                        style={[styles.redeemBtn, { backgroundColor: colors.primary }]}
                        onPress={redeem}
                        disabled={busy}
                      >
                        {busy ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.redeemBtnText}>Échanger</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                    {Number(redeemPts) > 0 ? (
                      <Text style={[styles.sub, { color: colors.textSecondary }]}>
                        = Ar {fmt(Number(redeemPts) * detail.program.pointValue)} crédités
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                <Text style={[styles.histTitle, { color: colors.textSecondary }]}>Historique</Text>
                {detail.history.length === 0 ? (
                  <Text style={[styles.sub, { color: colors.textSecondary, textAlign: 'center', paddingVertical: 12 }]}>
                    Aucun mouvement
                  </Text>
                ) : (
                  <ScrollView style={{ maxHeight: 220 }}>
                    {detail.history.map((h) => (
                      <View key={h.id} style={[styles.histRow, { borderTopColor: colors.border }]}>
                        <View>
                          <Text style={[styles.histLabel, { color: colors.text }]}>
                            {HISTORY_LABEL[h.type] ?? h.type}
                          </Text>
                          <Text style={[styles.histDate, { color: colors.textSecondary }]}>
                            {new Date(h.createdAt).toLocaleString('fr-FR')}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.histPts,
                            { color: h.points >= 0 ? '#10b981' : '#f59e0b' },
                          ]}
                        >
                          {h.points >= 0 ? '+' : ''}
                          {h.points}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 60, paddingHorizontal: 30 },
  emptyText: { fontSize: 13, textAlign: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  logo: { width: 44, height: 44, borderRadius: 12 },
  merchantName: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12 },
  points: { fontSize: 20, fontWeight: '800' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 10 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, marginRight: 8 },
  balanceWrap: { alignItems: 'center', gap: 2, paddingVertical: 10 },
  bigPoints: { fontSize: 40, fontWeight: '800' },
  redeemBox: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  redeemRow: { flexDirection: 'row', gap: 8 },
  redeemInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  redeemBtn: { paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  redeemBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  histTitle: { fontSize: 12, marginTop: 8 },
  histRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1 },
  histLabel: { fontSize: 14 },
  histDate: { fontSize: 10, marginTop: 2 },
  histPts: { fontSize: 15, fontWeight: '700' },
});

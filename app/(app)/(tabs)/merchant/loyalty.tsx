// app/(app)/(tabs)/merchant/loyalty.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientHeader from '../../../../src/components/GradientHeader';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import {
  merchantApi,
  type LoyaltyMerchantView,
  type LoyaltyMember,
} from '../../../../src/services/merchantApi';

export default function MerchantLoyalty() {
  const { colors } = useTheme();
  const [view, setView] = useState<LoyaltyMerchantView | null>(null);
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [isActive, setIsActive] = useState(true);
  const [earnRate, setEarnRate] = useState('');
  const [pointValue, setPointValue] = useState('');
  const [welcomeBonus, setWelcomeBonus] = useState('');
  const [minRedeem, setMinRedeem] = useState('');

  const load = useCallback(async () => {
    try {
      const [v, m] = await Promise.all([
        merchantApi.getLoyalty(),
        merchantApi.getLoyaltyMembers(),
      ]);
      setView(v.data);
      setMembers(Array.isArray(m.data) ? m.data : []);
      const p = v.data.program;
      setIsActive(p.isActive);
      setEarnRate(p.earnRate ? String(p.earnRate) : '');
      setPointValue(p.pointValue ? String(p.pointValue) : '');
      setWelcomeBonus(p.welcomeBonus ? String(p.welcomeBonus) : '');
      setMinRedeem(p.minRedeemPoints ? String(p.minRedeemPoints) : '');
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

  const save = async () => {
    setSaving(true);
    try {
      await merchantApi.updateLoyalty({
        isActive,
        earnRate: earnRate ? Number(earnRate) : 0,
        pointValue: pointValue ? Number(pointValue) : 0,
        welcomeBonus: welcomeBonus ? Number(welcomeBonus) : 0,
        minRedeemPoints: minRedeem ? Number(minRedeem) : 0,
      });
      Alert.alert('Succès', 'Programme de fidélité enregistré.');
      load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Échec de l’enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));
  const samplePoints = Math.floor(10000 * (Number(earnRate) || 0));

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Fidélité" />
      <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
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
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{view?.stats.members ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Membres</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{view?.stats.pointsIssued ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Points émis</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{view?.stats.pointsOutstanding ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>En circulation</Text>
        </View>
      </View>

      {/* Config */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Configuration</Text>

        <View style={styles.switchRow}>
          <Text style={[styles.label, { color: colors.text }]}>Programme activé</Text>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ false: '#767577', true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          Points par Ar dépensé (ex: 0.01 = 1 pt / 100 Ar)
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          value={earnRate}
          onChangeText={setEarnRate}
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Valeur d'un point (Ar)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          value={pointValue}
          onChangeText={setPointValue}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Bonus bienvenue</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              value={welcomeBonus}
              onChangeText={setWelcomeBonus}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Min. échange</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              value={minRedeem}
              onChangeText={setMinRedeem}
            />
          </View>
        </View>

        <Text style={[styles.preview, { color: colors.textSecondary }]}>
          Aperçu : un achat de Ar 10 000 rapporte {samplePoints} points
          {Number(pointValue) > 0
            ? ` (≈ Ar ${fmt(samplePoints * Number(pointValue))})`
            : ''}
          .
        </Text>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={save}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Enregistrer le programme</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Members */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Clients fidèles</Text>
        {members.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            Aucun membre pour le moment.
          </Text>
        ) : (
          members.map((m) => (
            <View key={m.id} style={[styles.memberRow, { borderTopColor: colors.border }]}>
              <View style={[styles.memberAvatar, { backgroundColor: `${colors.primary}20` }]}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  {m.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                  {m.name}
                </Text>
                <Text style={[styles.memberSub, { color: colors.textSecondary }]}>
                  Dépensé : Ar {fmt(m.lifetimeSpend)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.memberPts, { color: colors.primary }]}>{m.points} pts</Text>
                <Text style={[styles.memberSub, { color: colors.textSecondary }]}>{m.totalEarned} gagnés</Text>
              </View>
            </View>
          ))
        )}
      </View>
      <View style={{ height: 30 }} />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, marginTop: 2, textAlign: 'center' },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 14, fontWeight: '500' },
  fieldLabel: { fontSize: 12, marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  row: { flexDirection: 'row', gap: 12 },
  preview: { fontSize: 12, marginTop: 4 },
  saveBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  empty: { fontSize: 13, paddingVertical: 12, textAlign: 'center' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  memberName: { fontSize: 14, fontWeight: '600' },
  memberSub: { fontSize: 11, marginTop: 2 },
  memberPts: { fontSize: 14, fontWeight: '700' },
});

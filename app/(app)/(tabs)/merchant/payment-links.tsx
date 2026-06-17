// app/(app)/(tabs)/merchant/payment-links.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Modal,
  ActivityIndicator,
  Alert,
  Share,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientHeader from '../../../../src/components/GradientHeader';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import {
  merchantApi,
  type PaymentLink,
  type PaymentLinkDetail,
  type PaymentLinkStatus,
  type Store,
} from '../../../../src/services/merchantApi';

const STATUS: Record<PaymentLinkStatus, { color: string; label: string }> = {
  ACTIVE: { color: '#10b981', label: 'Actif' },
  PAID: { color: '#3b82f6', label: 'Payé' },
  EXPIRED: { color: '#f59e0b', label: 'Expiré' },
  CANCELLED: { color: '#ef4444', label: 'Annulé' },
};

export default function MerchantPaymentLinks() {
  const { colors } = useTheme();
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('MGA');
  const [currencies, setCurrencies] = useState<string[]>(['MGA']);
  const [storeId, setStoreId] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [reusable, setReusable] = useState(false);
  const [busy, setBusy] = useState(false);

  const [detail, setDetail] = useState<PaymentLinkDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await merchantApi.listPaymentLinks();
      setLinks(Array.isArray(r.data) ? r.data : []);
    } catch (e: any) {
      console.error('payment-links load:', e?.response?.data || e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    merchantApi
      .getFxCurrencies()
      .then((r) => {
        if (Array.isArray(r.data) && r.data.length) setCurrencies(r.data);
      })
      .catch(() => {});
    merchantApi
      .getStores()
      .then((r) => setStores(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, [load]);

  const create = async () => {
    const amt = amount.trim() === '' ? undefined : Number(amount);
    if (amt != null && (Number.isNaN(amt) || amt <= 0)) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    setBusy(true);
    try {
      await merchantApi.createPaymentLink({
        label: label || undefined,
        amount: amt,
        currency,
        storeId: storeId || undefined,
        reusable,
      });
      setShowForm(false);
      setLabel('');
      setAmount('');
      setCurrency('MGA');
      setStoreId('');
      setReusable(false);
      load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Échec de la création');
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (id: string) => {
    setDetailBusy(true);
    setCopied(false);
    try {
      const r = await merchantApi.getPaymentLink(id);
      setDetail(r.data);
    } finally {
      setDetailBusy(false);
    }
  };

  const cancel = async (id: string) => {
    Alert.alert('Annuler le lien', 'Confirmer l’annulation de ce lien ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        style: 'destructive',
        onPress: async () => {
          await merchantApi.cancelPaymentLink(id);
          setDetail(null);
          load();
        },
      },
    ]);
  };

  const copy = async (url: string) => {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const share = async (link: PaymentLink | PaymentLinkDetail) => {
    try {
      await Share.share({
        message: `Payez ${
          link.openAmount ? '' : link.amount + ' Ar '
        }via M'Paye : ${link.payUrl}`,
      });
    } catch {
      // annulé
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

  const amtLabel = (l: {
    openAmount: boolean;
    amount: number | null;
    devise: string;
  }) =>
    l.openAmount
      ? 'Montant libre'
      : l.devise === 'MGA'
        ? `Ar ${fmt(l.amount ?? 0)}`
        : `${l.amount} ${l.devise}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader title="Liens de paiement" />
      <ScrollView
        showsVerticalScrollIndicator={false}
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
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newBtnText}>Nouveau lien de paiement</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: 40 }}
          />
        ) : links.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="link-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Aucun lien. Créez-en un pour encaisser à distance.
            </Text>
          </View>
        ) : (
          links.map((l) => {
            const st = STATUS[l.status];
            return (
              <TouchableOpacity
                key={l.id}
                style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => openDetail(l.id)}
              >
                <View style={[styles.itemIcon, { backgroundColor: `${colors.primary}20` }]}>
                  <Ionicons name="link" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                    {l.label || 'Lien de paiement'}
                  </Text>
                  <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
                    {amtLabel(l)}
                    {l.reusable ? ' · réutilisable' : ''}
                    {l.paidCount > 0 ? ` · ${l.paidCount} paiement(s)` : ''}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: `${st.color}20` }]}>
                  <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Modal création */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Nouveau lien</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="Libellé (ex: Facture #1024)"
              placeholderTextColor={colors.textSecondary}
              value={label}
              onChangeText={setLabel}
            />
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Montant (laisser vide = montant libre)
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            {currencies.length > 1 && (
              <>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>Devise</Text>
                <View style={styles.currencyRow}>
                  {currencies.map((c) => {
                    const active = c === currency;
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.currencyChip,
                          { borderColor: colors.border },
                          active && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => setCurrency(c)}
                      >
                        <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>
                          {c}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {currency !== 'MGA' && (
                  <Text style={[styles.hint, { color: colors.textSecondary }]}>
                    Le client paiera l'équivalent en Ariary au taux du jour ; vous êtes réglé en MGA.
                  </Text>
                )}
              </>
            )}
            {stores.length > 0 && (
              <>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>Boutique (optionnel)</Text>
                <View style={styles.currencyRow}>
                  <TouchableOpacity
                    style={[
                      styles.currencyChip,
                      { borderColor: colors.border },
                      storeId === '' && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setStoreId('')}
                  >
                    <Text style={{ color: storeId === '' ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>
                      Aucune
                    </Text>
                  </TouchableOpacity>
                  {stores.map((s) => {
                    const active = s.id === storeId;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[
                          styles.currencyChip,
                          { borderColor: colors.border },
                          active && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => setStoreId(s.id)}
                      >
                        <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>
                          {s.name}
                          {s.geofenceEnabled ? ' 📍' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {(() => {
                  const sel = stores.find((s) => s.id === storeId);
                  return sel?.geofenceEnabled ? (
                    <Text style={[styles.hint, { color: colors.textSecondary }]}>
                      Paiement restreint aux clients présents à {sel.name} (rayon {sel.geofenceRadius ?? 200} m).
                    </Text>
                  ) : null;
                })()}
              </>
            )}
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>
                Réutilisable (plusieurs paiements)
              </Text>
              <Switch
                value={reusable}
                onValueChange={setReusable}
                trackColor={{ false: '#767577', true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={create}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Créer le lien</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal détail / partage */}
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
                    {detail.label || 'Lien de paiement'}
                  </Text>
                  <TouchableOpacity onPress={() => setDetail(null)}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.qrWrap}>
                  <View style={styles.qrBox}>
                    <QRCode value={detail.payUrl} size={170} />
                  </View>
                  <Text style={[styles.detailAmount, { color: colors.text }]}>
                    {amtLabel(detail)}
                  </Text>
                  {detail.devise !== 'MGA' && (
                    <Text style={[styles.collected, { color: colors.textSecondary }]}>
                      réglé en Ariary au taux du jour
                    </Text>
                  )}
                  <View style={[styles.badge, { backgroundColor: `${STATUS[detail.status].color}20` }]}>
                    <Text style={[styles.badgeText, { color: STATUS[detail.status].color }]}>
                      {STATUS[detail.status].label}
                    </Text>
                  </View>
                </View>

                {detail.paidCount > 0 && (
                  <Text style={[styles.collected, { color: colors.textSecondary }]}>
                    {detail.paidCount} paiement(s) · Ar {fmt(detail.totalCollected)} encaissés
                  </Text>
                )}

                <View style={styles.detailActions}>
                  <TouchableOpacity
                    style={[styles.outlineBtn, { borderColor: colors.border }]}
                    onPress={() => copy(detail.payUrl)}
                  >
                    <Ionicons
                      name={copied ? 'checkmark' : 'copy-outline'}
                      size={18}
                      color={colors.text}
                    />
                    <Text style={{ color: colors.text }}>{copied ? 'Copié' : 'Copier'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.outlineBtn, { borderColor: colors.border }]}
                    onPress={() => share(detail)}
                  >
                    <Ionicons name="share-outline" size={18} color={colors.text} />
                    <Text style={{ color: colors.text }}>Partager</Text>
                  </TouchableOpacity>
                </View>

                {(detail.status === 'ACTIVE' || detail.status === 'EXPIRED') && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => cancel(detail.id)}
                  >
                    <Ionicons name="ban-outline" size={16} color="#ef4444" />
                    <Text style={styles.cancelText}>Annuler le lien</Text>
                  </TouchableOpacity>
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
  container: { flex: 1, padding: 16 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  newBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 50 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingHorizontal: 30 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  itemIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '600' },
  itemSub: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, marginRight: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  hint: { fontSize: 12 },
  currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  currencyChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  switchLabel: { fontSize: 14, flex: 1 },
  primaryBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  qrWrap: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  qrBox: { backgroundColor: '#fff', padding: 12, borderRadius: 16 },
  detailAmount: { fontSize: 22, fontWeight: '800' },
  collected: { fontSize: 12, textAlign: 'center' },
  detailActions: { flexDirection: 'row', gap: 12 },
  outlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  cancelText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
});

// app/(app)/(tabs)/merchant/products.tsx
// 📦 Catalogue produits + gestion stock pour le merchant
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Switch,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { useLocale } from '../../../../src/contexts/LocaleContext';
import GradientHeader from '../../../../src/components/GradientHeader';
import { merchantApi } from '../../../../src/services/merchantApi';

interface Product {
  id: string;
  sku?: string;
  name: string;
  description?: string;
  category?: string;
  price: number | string;
  currency: string;
  taxRate: number | string;
  trackStock: boolean;
  stockQuantity: number;
  lowStockAlert: number;
  isActive: boolean;
  imageUrl?: string;
}

const EMPTY_FORM = {
  name: '',
  sku: '',
  description: '',
  category: '',
  price: '',
  taxRate: '0',
  trackStock: false,
  stockQuantity: '0',
  lowStockAlert: '5',
  isActive: true,
};

export default function MerchantProducts() {
  const { colors } = useTheme();
  const { formatCurrency } = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'lowStock'>('all');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const params: any = {};
      if (filter === 'active') params.active = true;
      if (filter === 'lowStock') params.lowStock = true;
      const res = await merchantApi.listProducts(params);
      setProducts(res.data || []);
    } catch (e: any) {
      console.error('Erreur catalogue:', e?.response?.data || e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      sku: p.sku || '',
      description: p.description || '',
      category: p.category || '',
      price: String(p.price),
      taxRate: String(p.taxRate),
      trackStock: p.trackStock,
      stockQuantity: String(p.stockQuantity),
      lowStockAlert: String(p.lowStockAlert),
      isActive: p.isActive,
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      Alert.alert('Erreur', 'Le nom est requis');
      return;
    }
    const price = parseFloat(form.price);
    if (!price || price < 0) {
      Alert.alert('Erreur', 'Prix invalide');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku?.trim() || undefined,
        description: form.description?.trim() || undefined,
        category: form.category?.trim() || undefined,
        price,
        taxRate: parseFloat(form.taxRate) || 0,
        trackStock: form.trackStock,
        stockQuantity: parseInt(form.stockQuantity, 10) || 0,
        lowStockAlert: parseInt(form.lowStockAlert, 10) || 5,
        isActive: form.isActive,
      };
      if (editingId) {
        await merchantApi.updateProduct(editingId, payload);
      } else {
        await merchantApi.createProduct(payload);
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Échec sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const remove = (p: Product) => {
    Alert.alert(
      'Supprimer ce produit ?',
      `"${p.name}" sera définitivement retiré.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await merchantApi.deleteProduct(p.id);
              load();
            } catch (e: any) {
              Alert.alert('Erreur', e?.response?.data?.message || 'Échec');
            }
          },
        },
      ],
    );
  };

  const adjustStock = (p: Product, delta: number) => {
    merchantApi
      .adjustStock(p.id, delta)
      .then(() => load())
      .catch((e: any) => Alert.alert('Erreur', e?.response?.data?.message || 'Échec'));
  };

  const stats = useMemo(() => {
    const active = products.filter((p) => p.isActive).length;
    const low = products.filter(
      (p) => p.trackStock && p.stockQuantity <= p.lowStockAlert,
    ).length;
    const totalValue = products.reduce(
      (s, p) => s + Number(p.price) * (p.trackStock ? p.stockQuantity : 1),
      0,
    );
    return { active, low, totalValue };
  }, [products]);

  const renderItem = ({ item: p }: { item: Product }) => {
    const isLow = p.trackStock && p.stockQuantity <= p.lowStockAlert;
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
          !p.isActive && { opacity: 0.55 },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>
              {p.name}
            </Text>
            <View style={styles.metaRow}>
              {p.sku && (
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  SKU: {p.sku}
                </Text>
              )}
              {p.category && (
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  · {p.category}
                </Text>
              )}
              {Number(p.taxRate) > 0 && (
                <Text style={[styles.metaText, { color: '#f59e0b' }]}>
                  · TVA {p.taxRate}%
                </Text>
              )}
            </View>
          </View>
          <Text style={[styles.productPrice, { color: '#1e40af' }]}>
            {formatCurrency(Number(p.price))}
          </Text>
        </View>

        {/* Stock control si activé */}
        {p.trackStock && (
          <View style={[styles.stockRow, { borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.stockBtn, { backgroundColor: '#ef444415' }]}
              onPress={() => adjustStock(p, -1)}
              disabled={p.stockQuantity <= 0}
            >
              <Ionicons name="remove" size={16} color="#ef4444" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[styles.stockValue, { color: isLow ? '#ef4444' : colors.text }]}>
                {p.stockQuantity} en stock
              </Text>
              {isLow && (
                <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '700' }}>
                  ⚠️ Stock bas
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.stockBtn, { backgroundColor: '#10b98115' }]}
              onPress={() => adjustStock(p, 1)}
            >
              <Ionicons name="add" size={16} color="#10b981" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#1e40af' }]}
            onPress={() => openEdit(p)}
          >
            <Ionicons name="create-outline" size={14} color="#fff" />
            <Text style={styles.actionText}>Modifier</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
            onPress={() => remove(p)}
          >
            <Ionicons name="trash-outline" size={14} color="#fff" />
            <Text style={styles.actionText}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title="Catalogue produits"
        subtitle={`${products.length} produit${products.length > 1 ? 's' : ''}`}
        rightIcon="add"
        onRightPress={openCreate}
      />

      {/* Stats card */}
      <LinearGradient
        colors={['#2563eb', '#1e40af']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statsCard}
      >
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Actifs</Text>
          <Text style={styles.statValue}>{stats.active}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Stock bas</Text>
          <Text style={[styles.statValue, { color: stats.low > 0 ? '#fbbf24' : '#fff' }]}>
            {stats.low}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Valeur stock</Text>
          <Text style={[styles.statValue, { fontSize: 14 }]}>
            {formatCurrency(stats.totalValue)}
          </Text>
        </View>
      </LinearGradient>

      {/* Filtres */}
      <View style={styles.filterRow}>
        {(['all', 'active', 'lowStock'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterBtn,
              { borderColor: colors.border },
              filter === f && { backgroundColor: '#1e40af', borderColor: '#1e40af' },
            ]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={{
                color: filter === f ? '#fff' : colors.textSecondary,
                fontWeight: '600',
                fontSize: 12,
              }}
            >
              {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : 'Stock bas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Liste */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1e40af" />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor="#1e40af"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color={colors.textSecondary} />
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                Aucun produit
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Crée ton premier produit pour démarrer ton catalogue
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={openCreate}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  Nouveau produit
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Modal create/edit */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingId ? 'Modifier le produit' : 'Nouveau produit'}
            </Text>

            <ScrollView style={{ maxHeight: 480 }}>
              <Field label="Nom *" value={form.name} onChange={(t) => setForm({ ...form, name: t })} colors={colors} />
              <Field label="SKU (optionnel)" value={form.sku} onChange={(t) => setForm({ ...form, sku: t })} colors={colors} />
              <Field label="Catégorie" value={form.category} onChange={(t) => setForm({ ...form, category: t })} colors={colors} />
              <Field label="Description" value={form.description} onChange={(t) => setForm({ ...form, description: t })} multiline colors={colors} />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Prix (Ar) *" value={form.price} onChange={(t) => setForm({ ...form, price: t.replace(/[^\d.]/g, '') })} keyboardType="numeric" colors={colors} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="TVA (%)" value={form.taxRate} onChange={(t) => setForm({ ...form, taxRate: t.replace(/[^\d.]/g, '') })} keyboardType="numeric" colors={colors} />
                </View>
              </View>

              <View style={[styles.toggleRow, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Suivi du stock</Text>
                <Switch
                  value={form.trackStock}
                  onValueChange={(v) => setForm({ ...form, trackStock: v })}
                  trackColor={{ false: '#767577', true: '#1e40af' }}
                />
              </View>

              {form.trackStock && (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Quantité actuelle" value={form.stockQuantity} onChange={(t) => setForm({ ...form, stockQuantity: t.replace(/[^\d]/g, '') })} keyboardType="numeric" colors={colors} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Alerte stock bas" value={form.lowStockAlert} onChange={(t) => setForm({ ...form, lowStockAlert: t.replace(/[^\d]/g, '') })} keyboardType="numeric" colors={colors} />
                  </View>
                </View>
              )}

              <View style={[styles.toggleRow, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Produit actif</Text>
                <Switch
                  value={form.isActive}
                  onValueChange={(v) => setForm({ ...form, isActive: v })}
                  trackColor={{ false: '#767577', true: '#10b981' }}
                />
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.border + '60' }]}
                onPress={() => setShowModal(false)}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#1e40af' }]}
                onPress={save}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    {editingId ? 'Mettre à jour' : 'Créer'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  multiline,
  colors,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  multiline?: boolean;
  colors: any;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.background,
            height: multiline ? 70 : undefined,
            textAlignVertical: multiline ? 'top' : 'auto',
          },
        ]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor={colors.textSecondary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  statsCard: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },

  filterRow: { flexDirection: 'row', gap: 8, padding: 12 },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },

  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  productName: { fontSize: 14, fontWeight: '700' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 4 },
  metaText: { fontSize: 11 },
  productPrice: { fontSize: 16, fontWeight: '800' },

  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginVertical: 6,
  },
  stockBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  stockValue: { fontSize: 13, fontWeight: '700' },

  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 8, borderRadius: 8,
  },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 12 },

  empty: { alignItems: 'center', padding: 40, gap: 10 },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e40af',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    marginTop: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#9ca3af',
    borderRadius: 2, alignSelf: 'center', marginBottom: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, marginBottom: 4 },
  fieldInput: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14,
  },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderTopWidth: 1,
  },
  modalBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12,
  },
});

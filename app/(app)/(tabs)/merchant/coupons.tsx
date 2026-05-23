// app/(app)/(tabs)/merchant/coupons.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { merchantApi } from '../../../../src/services/merchantApi';

interface Coupon {
  id: string;
  code: string;
  name?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchase?: number;
  maxDiscount?: number;
  validFrom: string;
  validUntil: string;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
  description?: string;
}

export default function MerchantCoupons() {
  const { colors } = useTheme();
  
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: '',
    minPurchase: '',
    maxDiscount: '',
    validFrom: '',
    validUntil: '',
    usageLimit: '',
    description: '',
  });

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const response = await merchantApi.getCoupons();
      setCoupons(response.data || []);
    } catch (error: any) {
      Alert.alert('Erreur', error?.response?.data?.message || 'Impossible de charger les coupons');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCoupons();
  }, []);

  const handleCreateCoupon = () => {
    setEditingCoupon(null);
    setFormData({
      code: '',
      discountType: 'percentage',
      discountValue: '',
      minPurchase: '',
      maxDiscount: '',
      validFrom: '',
      validUntil: '',
      usageLimit: '',
      description: '',
    });
    setModalVisible(true);
  };

  const handleEditCoupon = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue.toString(),
      minPurchase: coupon.minPurchase?.toString() || '',
      maxDiscount: coupon.maxDiscount?.toString() || '',
      validFrom: coupon.validFrom.split('T')[0],
      validUntil: coupon.validUntil.split('T')[0],
      usageLimit: coupon.usageLimit?.toString() || '',
      description: coupon.description || '',
    });
    setModalVisible(true);
  };

  const handleSaveCoupon = async () => {
    if (!formData.code.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un code');
      return;
    }
    if (!formData.discountValue || parseFloat(formData.discountValue) <= 0) {
      Alert.alert('Erreur', 'Veuillez saisir une valeur de réduction valide');
      return;
    }
    if (!formData.validFrom || !formData.validUntil) {
      Alert.alert('Erreur', 'Veuillez saisir les dates de validité');
      return;
    }

    try {
      const payload: any = {
        code: formData.code.toUpperCase(),
        discountType: formData.discountType,
        discountValue: parseFloat(formData.discountValue),
        minPurchase: formData.minPurchase ? parseFloat(formData.minPurchase) : undefined,
        maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : undefined,
        validFrom: formData.validFrom,
        validUntil: formData.validUntil,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : undefined,
        description: formData.description || undefined,
      };

      if (editingCoupon) {
        const response = await merchantApi.updateCoupon(editingCoupon.id, payload);
        const updated = response.data;
        setCoupons(coupons.map(c => c.id === editingCoupon.id ? updated : c));
        Alert.alert('Succès', 'Coupon modifié avec succès');
      } else {
        const response = await merchantApi.createCoupon(payload);
        const created = response.data;
        setCoupons([created, ...coupons]);
        Alert.alert('Succès', 'Coupon créé avec succès');
      }
      setModalVisible(false);
    } catch (error: any) {
      Alert.alert('Erreur', error?.response?.data?.message || 'Une erreur est survenue');
    }
  };

  const handleDeleteCoupon = (coupon: Coupon) => {
    Alert.alert(
      'Supprimer le coupon',
      `Êtes-vous sûr de vouloir supprimer le coupon "${coupon.code}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await merchantApi.deleteCoupon(coupon.id);
              setCoupons(coupons.filter(c => c.id !== coupon.id));
              Alert.alert('Succès', 'Coupon supprimé');
            } catch (error: any) {
              Alert.alert('Erreur', error?.response?.data?.message || 'Impossible de supprimer');
            }
          },
        },
      ]
    );
  };

  const handleToggleActive = async (coupon: Coupon) => {
    try {
      const newActive = !coupon.isActive;
      await merchantApi.toggleCoupon(coupon.id, newActive);
      const updatedCoupons = coupons.map(c =>
        c.id === coupon.id ? { ...c, isActive: newActive } : c
      );
      setCoupons(updatedCoupons);
      Alert.alert('Succès', coupon.isActive ? 'Coupon désactivé' : 'Coupon activé');
    } catch (error: any) {
      Alert.alert('Erreur', error?.response?.data?.message || 'Impossible de modifier le statut');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-MG', { style: 'currency', currency: 'MGA' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const isExpired = (validUntil: string) => {
    return new Date(validUntil) < new Date();
  };

  const getDiscountText = (coupon: Coupon) => {
    if (coupon.discountType === 'percentage') {
      let text = `${coupon.discountValue}%`;
      if (coupon.maxDiscount) {
        text += ` (max ${formatCurrency(coupon.maxDiscount)})`;
      }
      return text;
    }
    return formatCurrency(coupon.discountValue);
  };

  const renderCouponCard = ({ item }: { item: Coupon }) => {
    const expired = isExpired(item.validUntil);
    const isActive = item.isActive && !expired;

    return (
      <View style={[styles.couponCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.couponCode, { color: colors.primary }]}>{item.code}</Text>
            <View style={styles.cardBadges}>
              <View style={[styles.badge, { backgroundColor: `${colors.primary}20` }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  {item.discountType === 'percentage' ? 'Pourcentage' : 'Montant fixe'}
                </Text>
              </View>
              {expired && (
                <View style={[styles.badge, { backgroundColor: '#ef444420' }]}>
                  <Text style={[styles.badgeText, { color: '#ef4444' }]}>Expiré</Text>
                </View>
              )}
              {!expired && !item.isActive && (
                <View style={[styles.badge, { backgroundColor: '#f59e0b20' }]}>
                  <Text style={[styles.badgeText, { color: '#f59e0b' }]}>Désactivé</Text>
                </View>
              )}
            </View>
          </View>
          <Switch
            value={isActive}
            onValueChange={() => handleToggleActive(item)}
            trackColor={{ false: '#767577', true: colors.primary }}
            thumbColor={isActive ? '#fff' : '#f4f3f4'}
          />
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.discountValue, { color: colors.success }]}>
            {getDiscountText(item)}
          </Text>
          {item.description && (
            <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
          )}
          
          <View style={styles.detailsGrid}>
            {item.minPurchase && (
              <View style={styles.detailItem}>
                <Ionicons name="cart-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  Min: {formatCurrency(item.minPurchase)}
                </Text>
              </View>
            )}
            {item.usageLimit && (
              <View style={styles.detailItem}>
                <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  Utilisé: {item.usedCount}/{item.usageLimit}
                </Text>
              </View>
            )}
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                Du {formatDate(item.validFrom)} au {formatDate(item.validUntil)}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          <TouchableOpacity onPress={() => handleEditCoupon(item)} style={styles.footerButton}>
            <Ionicons name="create-outline" size={18} color={colors.warning} />
            <Text style={[styles.footerButtonText, { color: colors.warning }]}>Modifier</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteCoupon(item)} style={styles.footerButton}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={[styles.footerButtonText, { color: colors.error }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const CouponModal = () => (
    <Modal
      visible={modalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingCoupon ? 'Modifier le coupon' : 'Nouveau coupon'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Code du coupon *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="EX: PROMO10"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="characters"
                value={formData.code}
                onChangeText={(text) => setFormData({ ...formData, code: text.toUpperCase() })}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={[styles.label, { color: colors.text }]}>Type de réduction *</Text>
                <View style={styles.typeButtons}>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      formData.discountType === 'percentage' && { backgroundColor: colors.primary }
                    ]}
                    onPress={() => setFormData({ ...formData, discountType: 'percentage' })}
                  >
                    <Text style={[styles.typeButtonText, formData.discountType === 'percentage' && { color: '#fff' }]}>
                      Pourcentage
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      formData.discountType === 'fixed' && { backgroundColor: colors.primary }
                    ]}
                    onPress={() => setFormData({ ...formData, discountType: 'fixed' })}
                  >
                    <Text style={[styles.typeButtonText, formData.discountType === 'fixed' && { color: '#fff' }]}>
                      Montant fixe
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={[styles.label, { color: colors.text }]}>
                  Valeur {formData.discountType === 'percentage' ? '(%)' : '(Ar)'} *
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder={formData.discountType === 'percentage' ? '10' : '5000'}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={formData.discountValue}
                  onChangeText={(text) => setFormData({ ...formData, discountValue: text })}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={[styles.label, { color: colors.text }]}>Montant minimum (Ar)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={formData.minPurchase}
                  onChangeText={(text) => setFormData({ ...formData, minPurchase: text })}
                />
              </View>

              {formData.discountType === 'percentage' && (
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={[styles.label, { color: colors.text }]}>Réduction max (Ar)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    placeholder="Illimité"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={formData.maxDiscount}
                    onChangeText={(text) => setFormData({ ...formData, maxDiscount: text })}
                  />
                </View>
              )}
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={[styles.label, { color: colors.text }]}>Date de début *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.validFrom}
                  onChangeText={(text) => setFormData({ ...formData, validFrom: text })}
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={[styles.label, { color: colors.text }]}>Date de fin *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.validUntil}
                  onChangeText={(text) => setFormData({ ...formData, validUntil: text })}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Limite d'utilisation</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="Illimité"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={formData.usageLimit}
                onChangeText={(text) => setFormData({ ...formData, usageLimit: text })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="Description du coupon..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSaveCoupon}
            >
              <Text style={styles.saveButtonText}>
                {editingCoupon ? 'Modifier' : 'Créer'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading && coupons.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Coupons</Text>
        <TouchableOpacity onPress={handleCreateCoupon} style={styles.addButton}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={[styles.statsBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>{coupons.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.success }]}>{coupons.filter(c => c.isActive && !isExpired(c.validUntil)).length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Actifs</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.warning }]}>{coupons.filter(c => !c.isActive).length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Inactifs</Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={coupons}
        keyExtractor={(item) => item.id}
        renderItem={renderCouponCard}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={coupons.length === 0 ? styles.emptyList : styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="pricetag-outline" size={60} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucun coupon</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Cliquez sur le bouton + pour créer votre premier coupon
            </Text>
          </View>
        )}
      />

      <CouponModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  addButton: { padding: 4 },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  statLabel: { fontSize: 12 },
  statDivider: { width: 1, height: 30 },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  emptyList: { flex: 1 },
  couponCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  couponCode: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  cardBadges: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: '500' },
  cardBody: { gap: 8, marginBottom: 12 },
  discountValue: { fontSize: 24, fontWeight: 'bold' },
  description: { fontSize: 13 },
  detailsGrid: { gap: 6, marginTop: 4 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  footerButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  footerButtonText: { fontSize: 13, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  textArea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  halfWidth: { flex: 1 },
  typeButtons: { flexDirection: 'row', gap: 10 },
  typeButton: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F0F0F0', alignItems: 'center' },
  typeButtonText: { fontSize: 13, fontWeight: '500' },
  saveButton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { fontSize: 18, fontWeight: '500', marginTop: 16 },
  emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
});
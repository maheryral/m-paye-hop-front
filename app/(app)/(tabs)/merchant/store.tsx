// app/(app)/(tabs)/merchant/store.tsx
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { merchantApi } from '../../../../src/services/merchantApi';

interface Store {
  id: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  qrCode?: string;
}

export default function MerchantStore() {
  const { colors } = useTheme();
  
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    description: '',
  });
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    setLoading(true);
    try {
      const response = await merchantApi.getStores();
      setStores(response.data as Store[]);
    } catch (error: any) {
      console.error('Erreur:', error?.response?.data || error?.message);
      Alert.alert(
        'Erreur',
        error?.response?.data?.message || 'Impossible de charger les boutiques',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStores();
  }, []);

  const handleAddStore = () => {
    setEditingStore(null);
    setFormData({ name: '', address: '', phone: '', email: '', description: '' });
    setModalVisible(true);
  };

  const handleEditStore = (store: Store) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      address: store.address,
      phone: store.phone,
      email: store.email || '',
      description: store.description || '',
    });
    setModalVisible(true);
  };

  const handleSaveStore = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir le nom de la boutique');
      return;
    }
    if (!formData.address.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir l\'adresse');
      return;
    }
    if (!formData.phone.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir le téléphone');
      return;
    }

    try {
      if (editingStore) {
        const { data } = await merchantApi.updateStore(editingStore.id, {
          name: formData.name,
          address: formData.address,
          phone: formData.phone,
          email: formData.email || undefined,
        } as any);
        setStores(stores.map(s => (s.id === editingStore.id ? (data as Store) : s)));
        Alert.alert('Succès', 'Boutique modifiée avec succès');
      } else {
        const { data } = await merchantApi.createStore({
          name: formData.name,
          address: formData.address,
          phone: formData.phone,
        });
        setStores([data as Store, ...stores]);
        Alert.alert('Succès', 'Boutique ajoutée avec succès');
      }
      setModalVisible(false);
    } catch (error: any) {
      Alert.alert(
        'Erreur',
        error?.response?.data?.message || 'Une erreur est survenue',
      );
    }
  };

  const handleDeleteStore = (store: Store) => {
    Alert.alert(
      'Supprimer la boutique',
      `Êtes-vous sûr de vouloir supprimer "${store.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await merchantApi.deleteStore(store.id);
              setStores(stores.filter(s => s.id !== store.id));
              Alert.alert('Succès', 'Boutique supprimée');
            } catch (error: any) {
              Alert.alert(
                'Erreur',
                error?.response?.data?.message || 'Impossible de supprimer',
              );
            }
          },
        },
      ]
    );
  };

  const handleToggleActive = async (store: Store) => {
    try {
      const { data } = await merchantApi.updateStore(store.id, {
        isActive: !store.isActive,
      } as any);
      setStores(stores.map(s => (s.id === store.id ? (data as Store) : s)));
      Alert.alert('Succès', store.isActive ? 'Boutique désactivée' : 'Boutique activée');
    } catch (error: any) {
      Alert.alert(
        'Erreur',
        error?.response?.data?.message || 'Impossible de modifier le statut',
      );
    }
  };

  const handleShowQR = (store: Store) => {
    setSelectedStore(store);
    setShowQRModal(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const renderStoreCard = ({ item }: { item: Store }) => (
    <View style={[styles.storeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={styles.storeInfo}>
          <View style={[styles.storeIcon, { backgroundColor: `${colors.primary}20` }]}>
            <Ionicons name="storefront-outline" size={24} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.storeName, { color: colors.text }]}>{item.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: item.isActive ? '#3b82f620' : '#ef444420' }]}>
              <View style={[styles.statusDot, { backgroundColor: item.isActive ? '#3b82f6' : '#ef4444' }]} />
              <Text style={[styles.statusText, { color: item.isActive ? '#3b82f6' : '#ef4444' }]}>
                {item.isActive ? 'Actif' : 'Inactif'}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => handleShowQR(item)} style={styles.actionIcon}>
            <Ionicons name="qr-code-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleEditStore(item)} style={styles.actionIcon}>
            <Ionicons name="create-outline" size={20} color={colors.warning} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteStore(item)} style={styles.actionIcon}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.detailItem}>
          <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.address}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>{item.phone}</Text>
        </View>
        {item.email && (
          <View style={styles.detailItem}>
            <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>{item.email}</Text>
          </View>
        )}
        {item.description && (
          <View style={styles.detailItem}>
            <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={2}>
              {item.description}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          Créée le {formatDate(item.createdAt)}
        </Text>
        <TouchableOpacity onPress={() => handleToggleActive(item)}>
          <Text style={[styles.toggleText, { color: item.isActive ? colors.error : colors.success }]}>
            {item.isActive ? 'Désactiver' : 'Activer'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const StoreModal = () => (
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
              {editingStore ? 'Modifier la boutique' : 'Nouvelle boutique'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Nom de la boutique *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="Ex: Boutique Principale"
                placeholderTextColor={colors.textSecondary}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Adresse *</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="Adresse complète"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Téléphone *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="+261 XX XXX XXXX"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Email (optionnel)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="contact@boutique.com"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Description (optionnel)</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="Description de la boutique..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSaveStore}
            >
              <Text style={styles.saveButtonText}>
                {editingStore ? 'Modifier' : 'Ajouter'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const QRModal = () => (
    <Modal
      visible={showQRModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowQRModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.qrModalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>QR Code boutique</Text>
            <TouchableOpacity onPress={() => setShowQRModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {selectedStore && (
            <View style={styles.qrContainer}>
              <View style={[styles.qrBox, { backgroundColor: colors.background }]}>
                <Ionicons name="qr-code" size={180} color={colors.primary} />
              </View>
              <Text style={[styles.qrStoreName, { color: colors.text }]}>{selectedStore.name}</Text>
              <Text style={[styles.qrStoreAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                {selectedStore.address}
              </Text>
              <TouchableOpacity style={[styles.shareButton, { backgroundColor: colors.primary }]}>
                <Ionicons name="share-outline" size={20} color="#fff" />
                <Text style={styles.shareButtonText}>Partager le QR code</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  if (loading && stores.length === 0) {
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mes boutiques</Text>
        <TouchableOpacity onPress={handleAddStore} style={styles.addButton}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={[styles.statsBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>{stores.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Boutiques</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.success }]}>{stores.filter(s => s.isActive).length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Actives</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.warning }]}>{stores.filter(s => !s.isActive).length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Inactives</Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={stores}
        keyExtractor={(item) => item.id}
        renderItem={renderStoreCard}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={stores.length === 0 ? styles.emptyList : styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="storefront-outline" size={60} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucune boutique</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Cliquez sur le bouton + pour ajouter votre première boutique
            </Text>
          </View>
        )}
      />

      <StoreModal />
      <QRModal />
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
  storeCard: {
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
  storeInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  storeIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  storeName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, gap: 4, alignSelf: 'flex-start' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '500' },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionIcon: { padding: 8 },
  cardBody: { gap: 8, marginBottom: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { flex: 1, fontSize: 13 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  footerText: { fontSize: 11 },
  toggleText: { fontSize: 12, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  qrModalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  textArea: { height: 80, textAlignVertical: 'top' },
  saveButton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  qrContainer: { alignItems: 'center', padding: 20 },
  qrBox: { padding: 20, borderRadius: 16, marginBottom: 20 },
  qrStoreName: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  qrStoreAddress: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  shareButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, gap: 8 },
  shareButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { fontSize: 18, fontWeight: '500', marginTop: 16 },
  emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
});
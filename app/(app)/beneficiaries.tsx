// app/(app)/beneficiaries.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import GradientHeader from '../../src/components/GradientHeader';
import { useAuth } from '../../src/contexts/AuthContext';
import { beneficiaryService } from '../../src/services/api';

interface Beneficiary {
  id: string;
  name: string;
  phone: string;
  email?: string;
  isFavorite: boolean;
  lastAmount?: number;
  lastDate?: string;
}

export default function Beneficiaries() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadBeneficiaries();
  }, []);

  const loadBeneficiaries = async () => {
    try {
      setLoading(true);
      const data = await beneficiaryService.list();
      setBeneficiaries(data);
    } catch (error: any) {
      console.error('Erreur chargement bénéficiaires:', error?.response?.data || error?.message);
      Alert.alert(
        'Erreur',
        error?.response?.data?.message || 'Impossible de charger les bénéficiaires',
      );
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Le nom est requis';
    if (!formData.phone.trim()) errors.phone = 'Le numéro de téléphone est requis';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email invalide';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddBeneficiary = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const created = await beneficiaryService.create({
        name: formData.name.trim(),
        phone: formData.phone.replace(/\s/g, ''),
        email: formData.email?.trim() || undefined,
      });
      setBeneficiaries([created, ...beneficiaries]);
      resetForm();
      Alert.alert('Succès', 'Bénéficiaire ajouté avec succès');
    } catch (error: any) {
      Alert.alert(
        'Erreur',
        error?.response?.data?.message || "Erreur lors de l'ajout",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateBeneficiary = async () => {
    if (!editingBeneficiary || !validateForm()) return;
    setSubmitting(true);
    try {
      const updated = await beneficiaryService.update(editingBeneficiary.id, {
        name: formData.name.trim(),
        phone: formData.phone.replace(/\s/g, ''),
        email: formData.email?.trim() || undefined,
      });
      setBeneficiaries(
        beneficiaries.map(b => (b.id === updated.id ? updated : b)),
      );
      resetForm();
      Alert.alert('Succès', 'Bénéficiaire modifié avec succès');
    } catch (error: any) {
      Alert.alert(
        'Erreur',
        error?.response?.data?.message || 'Erreur lors de la modification',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBeneficiary = async (id: string) => {
    try {
      await beneficiaryService.remove(id);
      setBeneficiaries(beneficiaries.filter(b => b.id !== id));
      setShowDeleteConfirm(null);
    } catch (error: any) {
      Alert.alert(
        'Erreur',
        error?.response?.data?.message || 'Erreur lors de la suppression',
      );
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const updated = await beneficiaryService.toggleFavorite(id);
      setBeneficiaries(beneficiaries.map(b => (b.id === id ? updated : b)));
    } catch (error: any) {
      Alert.alert('Erreur', error?.response?.data?.message || 'Action impossible');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', email: '' });
    setFormErrors({});
    setEditingBeneficiary(null);
    setShowAddModal(false);
  };

  const openEditModal = (beneficiary: Beneficiary) => {
    setEditingBeneficiary(beneficiary);
    setFormData({
      name: beneficiary.name,
      phone: beneficiary.phone,
      email: beneficiary.email || '',
    });
    setShowAddModal(true);
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`;
    }
    return phone;
  };

  const filteredBeneficiaries = beneficiaries.filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.phone.includes(searchTerm) ||
    (b.email && b.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const isRecent = (b: Beneficiary) =>
    !!b.lastDate && Date.now() - new Date(b.lastDate).getTime() < SEVEN_DAYS_MS;
  const favorites = filteredBeneficiaries.filter(b => b.isFavorite);
  const recents = filteredBeneficiaries.filter(b => isRecent(b) && !b.isFavorite);
  const others = filteredBeneficiaries.filter(b => !b.isFavorite && !isRecent(b));

  const renderBeneficiaryCard = ({ item }: { item: Beneficiary }) => (
    <View style={[styles.beneficiaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.beneficiaryInfo}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.beneficiaryDetails}>
          <View style={styles.beneficiaryNameRow}>
            <Text style={[styles.beneficiaryName, { color: colors.text }]}>{item.name}</Text>
            <TouchableOpacity onPress={() => handleToggleFavorite(item.id)}>
              <Ionicons
                name={item.isFavorite ? 'star' : 'star-outline'}
                size={16}
                color={item.isFavorite ? '#f59e0b' : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          <Text style={[styles.beneficiaryPhone, { color: colors.textSecondary }]}>
            {formatPhone(item.phone)}
          </Text>
          {item.email && (
            <Text style={[styles.beneficiaryEmail, { color: colors.textSecondary }]}>
              {item.email}
            </Text>
          )}
          {item.lastAmount && (
            <Text style={[styles.lastTransfer, { color: colors.success }]}>
              Dernier transfert: {item.lastAmount.toLocaleString()} Ar
            </Text>
          )}
        </View>
      </View>
      <View style={styles.beneficiaryActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push({ pathname: '/transfers', params: { toPhone: item.phone } } as any)}
        >
          <Ionicons name="send-outline" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Envoyer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: `${colors.textSecondary}20` }]}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="create-outline" size={18} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: `${colors.error}20` }]}
          onPress={() => setShowDeleteConfirm(item.id)}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title="Bénéficiaires"
        rightIcon="add"
        onRightPress={() => setShowAddModal(true)}
      />

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Rechercher..."
          placeholderTextColor={colors.textSecondary}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{beneficiaries.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>{favorites.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Favoris</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{recents.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Récents</Text>
        </View>
      </View>

      {/* Lists */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {favorites.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Favoris</Text>
                <FlatList
                  data={favorites}
                  keyExtractor={(item) => item.id}
                  renderItem={renderBeneficiaryCard}
                  scrollEnabled={false}
                />
              </View>
            )}
            {recents.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Récents</Text>
                <FlatList
                  data={recents}
                  keyExtractor={(item) => item.id}
                  renderItem={renderBeneficiaryCard}
                  scrollEnabled={false}
                />
              </View>
            )}
            {others.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Tous les bénéficiaires</Text>
                <FlatList
                  data={others}
                  keyExtractor={(item) => item.id}
                  renderItem={renderBeneficiaryCard}
                  scrollEnabled={false}
                />
              </View>
            )}
            {filteredBeneficiaries.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Aucun bénéficiaire trouvé
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingBeneficiary ? 'Modifier' : 'Ajouter'} un bénéficiaire
              </Text>
              <TouchableOpacity onPress={resetForm}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Nom complet *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="Jean Dupont"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                />
                {formErrors.name && <Text style={styles.errorText}>{formErrors.name}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Téléphone *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="032 12 345 67"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  keyboardType="phone-pad"
                />
                {formErrors.phone && <Text style={styles.errorText}>{formErrors.phone}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email (optionnel)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="jean@email.com"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {formErrors.email && <Text style={styles.errorText}>{formErrors.email}</Text>}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                  onPress={resetForm}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.text }]}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.submitButton, { backgroundColor: colors.primary }]}
                  onPress={editingBeneficiary ? handleUpdateBeneficiary : handleAddBeneficiary}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>{editingBeneficiary ? 'Modifier' : 'Ajouter'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={!!showDeleteConfirm} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModal, { backgroundColor: colors.card }]}>
            <Ionicons name="alert-circle" size={48} color={colors.error} />
            <Text style={[styles.confirmTitle, { color: colors.text }]}>Confirmer la suppression</Text>
            <Text style={[styles.confirmText, { color: colors.textSecondary }]}>
              Êtes-vous sûr de vouloir supprimer ce bénéficiaire ?
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelConfirmButton, { borderColor: colors.border }]}
                onPress={() => setShowDeleteConfirm(null)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.deleteConfirmButton, { backgroundColor: colors.error }]}
                onPress={() => showDeleteConfirm && handleDeleteBeneficiary(showDeleteConfirm)}
              >
                <Text style={styles.deleteButtonText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  beneficiaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  beneficiaryInfo: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  beneficiaryDetails: {
    flex: 1,
    gap: 2,
  },
  beneficiaryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  beneficiaryName: {
    fontSize: 15,
    fontWeight: '600',
  },
  beneficiaryPhone: {
    fontSize: 12,
  },
  beneficiaryEmail: {
    fontSize: 11,
  },
  lastTransfer: {
    fontSize: 11,
    marginTop: 2,
  },
  beneficiaryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 60,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalForm: {
    padding: 20,
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
  },
  submitButton: {},
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmModal: {
    width: '80%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  confirmText: {
    fontSize: 14,
    textAlign: 'center',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelConfirmButton: {
    borderWidth: 1,
  },
  deleteConfirmButton: {},
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
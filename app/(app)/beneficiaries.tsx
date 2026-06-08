// app/(app)/beneficiaries.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  RefreshControl,
  Animated,
  Share,
  Image,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import QRCode from 'react-native-qrcode-svg';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import GradientHeader from '../../src/components/GradientHeader';
import { useAuth } from '../../src/contexts/AuthContext';
import { beneficiaryService, resolveAssetUrl } from '../../src/services/api';

interface Beneficiary {
  id: string;
  name: string;
  phone: string;
  email?: string;
  isFavorite: boolean;
  lastAmount?: number;
  lastDate?: string;
  /** Note privée libre. */
  note?: string | null;
  /** Vrai si ce contact a un compte M'Paye (lookup backend par phone/email). */
  isMpayUser?: boolean;
  /** URL relative ou absolue de la photo (servie par /uploads/avatars/...). */
  avatarUrl?: string | null;
}

export default function Beneficiaries() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Options de tri
  type SortKey = 'recent' | 'alpha' | 'amount';
  const [sortKey, setSortKey] = useState<SortKey>('recent');

  // Pagination locale pour la section "Tous"
  const PAGE_SIZE = 50;
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    note: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Menu contextuel (long-press)
  const [actionMenu, setActionMenu] = useState<Beneficiary | null>(null);

  // Modal de partage QR — payload = deeplink scheme mpaye://contact?phone=...&name=...
  // Si un autre user M'Paye le scanne, l'app peut router directement vers l'écran d'envoi
  // pré-rempli ; à défaut, le bouton Share envoie le texte brut.
  const [qrShareTarget, setQrShareTarget] = useState<Beneficiary | null>(null);

  const buildContactPayload = (b: Beneficiary) =>
    `mpaye://contact?phone=${encodeURIComponent(b.phone)}&name=${encodeURIComponent(b.name)}`;

  /**
   * Choisit une image dans la galerie (ratio carré, qualité 0.7) puis l'upload
   * sur l'API. Optimistic update : on remplace immédiatement l'avatar dans la
   * liste avec la version renvoyée par le backend.
   */
  const handlePickAvatar = async (b: Beneficiary) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission requise',
        "Autorise M'Paye à accéder à tes photos pour changer l'avatar.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    try {
      const updated = await beneficiaryService.uploadAvatar(b.id, {
        uri: asset.uri,
        name: asset.fileName || 'avatar.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
      setBeneficiaries((prev) =>
        prev.map((x) => (x.id === updated.id ? updated : x)),
      );
    } catch (e: any) {
      Alert.alert(
        'Erreur',
        e?.response?.data?.message || "Impossible d'envoyer la photo.",
      );
    }
  };

  const handleRemoveAvatar = async (b: Beneficiary) => {
    try {
      const updated = await beneficiaryService.removeAvatar(b.id);
      setBeneficiaries((prev) =>
        prev.map((x) => (x.id === updated.id ? updated : x)),
      );
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Action impossible.');
    }
  };

  const handleShareContact = async (b: Beneficiary) => {
    try {
      await Share.share({
        message: `${b.name}\n${b.phone}${b.email ? `\n${b.email}` : ''}\n\nAjouter sur M'Paye : ${buildContactPayload(b)}`,
        title: `Contact M'Paye — ${b.name}`,
      });
    } catch (e) {
      // partage annulé : silent
    }
  };

  // Refs Swipeable : permettent de fermer un swipe ouvert quand on en ouvre un autre,
  // ou après une action (toggle favori).
  const swipeRefs = useRef<Record<string, Swipeable | null>>({});
  const openSwipeIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadBeneficiaries();
  }, []);

  const loadBeneficiaries = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await beneficiaryService.list();
      setBeneficiaries(data);
    } catch (error: any) {
      console.error('Erreur chargement bénéficiaires:', error?.response?.data || error?.message);
      if (!silent) {
        Alert.alert(
          'Erreur',
          error?.response?.data?.message || 'Impossible de charger les bénéficiaires',
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
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
        note: formData.note?.trim() || undefined,
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
        note: formData.note?.trim() || undefined,
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
    setFormData({ name: '', phone: '', email: '', note: '' });
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
      note: beneficiary.note || '',
    });
    setShowAddModal(true);
    setActionMenu(null);
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`;
    }
    return phone;
  };

  const filteredBeneficiaries = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return beneficiaries;
    return beneficiaries.filter(b =>
      b.name.toLowerCase().includes(term) ||
      b.phone.includes(searchTerm) ||
      (b.email && b.email.toLowerCase().includes(term))
    );
  }, [beneficiaries, searchTerm]);

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const isRecent = (b: Beneficiary) =>
    !!b.lastDate && Date.now() - new Date(b.lastDate).getTime() < SEVEN_DAYS_MS;

  /** Tri appliqué aux sections "Récents" et "Tous" selon le sortKey choisi. */
  const sortBy = (list: Beneficiary[]): Beneficiary[] => {
    const arr = [...list];
    if (sortKey === 'alpha') {
      arr.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
    } else if (sortKey === 'amount') {
      arr.sort((a, b) => (b.lastAmount ?? 0) - (a.lastAmount ?? 0));
    } else {
      // 'recent' : lastDate desc, sinon name
      arr.sort((a, b) => {
        const ta = a.lastDate ? new Date(a.lastDate).getTime() : 0;
        const tb = b.lastDate ? new Date(b.lastDate).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
      });
    }
    return arr;
  };

  const favorites = sortBy(filteredBeneficiaries.filter(b => b.isFavorite));
  const recents = sortBy(filteredBeneficiaries.filter(b => isRecent(b) && !b.isFavorite));
  const othersAll = sortBy(filteredBeneficiaries.filter(b => !b.isFavorite && !isRecent(b)));
  // Pagination locale uniquement sur "Tous" (Favoris + Récents généralement courts)
  const others = othersAll.slice(0, displayCount);
  const hasMoreOthers = othersAll.length > displayCount;

  /**
   * Action affichée quand l'utilisateur tire la carte vers la droite (révèle le côté gauche).
   * Toggle favori — l'icône change en fonction de l'état courant.
   */
  const renderLeftAction = (item: Beneficiary) => (_progress: Animated.AnimatedInterpolation<number>) => (
    <View style={[styles.swipeAction, styles.swipeFavorite, { backgroundColor: '#f59e0b' }]}>
      <Ionicons name={item.isFavorite ? 'star-outline' : 'star'} size={22} color="#fff" />
      <Text style={styles.swipeActionLabel}>{item.isFavorite ? 'Retirer' : 'Favori'}</Text>
    </View>
  );

  /**
   * Action affichée quand l'utilisateur tire vers la gauche (révèle le côté droit).
   * Suppression — déclenche la modale de confirmation, jamais directement.
   */
  const renderRightAction = (_item: Beneficiary) => (_progress: Animated.AnimatedInterpolation<number>) => (
    <View style={[styles.swipeAction, styles.swipeDelete, { backgroundColor: colors.error }]}>
      <Ionicons name="trash-outline" size={22} color="#fff" />
      <Text style={styles.swipeActionLabel}>Supprimer</Text>
    </View>
  );

  const renderBeneficiaryCard = ({ item }: { item: Beneficiary }) => (
    <Swipeable
      ref={(ref) => {
        swipeRefs.current[item.id] = ref;
      }}
      renderLeftActions={renderLeftAction(item)}
      renderRightActions={renderRightAction(item)}
      leftThreshold={56}
      rightThreshold={56}
      friction={2}
      onSwipeableWillOpen={() => {
        if (openSwipeIdRef.current && openSwipeIdRef.current !== item.id) {
          swipeRefs.current[openSwipeIdRef.current]?.close();
        }
        openSwipeIdRef.current = item.id;
      }}
      onSwipeableOpen={(direction) => {
        if (direction === 'left') {
          handleToggleFavorite(item.id);
          swipeRefs.current[item.id]?.close();
          openSwipeIdRef.current = null;
        } else if (direction === 'right') {
          swipeRefs.current[item.id]?.close();
          openSwipeIdRef.current = null;
          setShowDeleteConfirm(item.id);
        }
      }}
    >
    <TouchableOpacity
      activeOpacity={0.95}
      onLongPress={() => setActionMenu(item)}
      delayLongPress={300}
      style={[styles.beneficiaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.beneficiaryInfo}>
        {item.avatarUrl ? (
          <Image
            source={{ uri: resolveAssetUrl(item.avatarUrl) }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.beneficiaryDetails}>
          <View style={styles.beneficiaryNameRow}>
            <Text style={[styles.beneficiaryName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            {item.isMpayUser && (
              <View style={[styles.mpayBadge, { backgroundColor: `${colors.primary}1A`, borderColor: `${colors.primary}55` }]}>
                <Ionicons name="checkmark-circle" size={11} color={colors.primary} />
                <Text style={[styles.mpayBadgeText, { color: colors.primary }]}>Sur M'Paye</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => handleToggleFavorite(item.id)} hitSlop={6}>
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
            <Text style={[styles.beneficiaryEmail, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.email}
            </Text>
          )}
          {!!item.note && (
            <View style={styles.noteRow}>
              <Ionicons name="bookmark" size={10} color={colors.textSecondary} />
              <Text style={[styles.noteText, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.note}
              </Text>
            </View>
          )}
          {item.lastAmount && (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/history',
                  params: { q: item.name },
                } as any)
              }
              hitSlop={6}
            >
              <Text style={[styles.lastTransfer, { color: colors.success }]}>
                Dernier transfert : {item.lastAmount.toLocaleString()} Ar →
              </Text>
            </TouchableOpacity>
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
    </TouchableOpacity>
    </Swipeable>
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

      {/* Tri */}
      {!loading && beneficiaries.length > 0 && (
        <View style={styles.sortRow}>
          {([
            { key: 'recent' as const, label: 'Récents', icon: 'time-outline' as const },
            { key: 'alpha' as const, label: 'A → Z', icon: 'text-outline' as const },
            { key: 'amount' as const, label: 'Montant', icon: 'cash-outline' as const },
          ]).map((opt) => {
            const active = sortKey === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setSortKey(opt.key)}
                style={[
                  styles.sortChip,
                  {
                    backgroundColor: active ? colors.primary + '20' : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Ionicons name={opt.icon} size={13} color={active ? colors.primary : colors.textSecondary} />
                <Text style={[styles.sortChipText, { color: active ? colors.primary : colors.textSecondary, fontWeight: active ? '700' : '500' }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Lists */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadBeneficiaries(true);
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {favorites.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  ⭐ Favoris ({favorites.length})
                </Text>
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
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  🕐 Récents ({recents.length})
                </Text>
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
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Tous les bénéficiaires ({othersAll.length})
                </Text>
                <FlatList
                  data={others}
                  keyExtractor={(item) => item.id}
                  renderItem={renderBeneficiaryCard}
                  scrollEnabled={false}
                />
                {/* Pagination locale : bouton "Voir plus" si > PAGE_SIZE */}
                {hasMoreOthers && (
                  <TouchableOpacity
                    onPress={() => setDisplayCount((c) => c + PAGE_SIZE)}
                    style={[styles.loadMoreBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                      Voir plus ({othersAll.length - displayCount} restants)
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            )}
            {filteredBeneficiaries.length === 0 && beneficiaries.length === 0 && (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconCircle, { backgroundColor: `${colors.primary}15` }]}>
                  <Ionicons name="people-outline" size={48} color={colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  Aucun bénéficiaire
                </Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Ajoutez vos contacts pour leur envoyer de l'argent en un clic.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyCta, { backgroundColor: colors.primary }]}
                  onPress={() => setShowAddModal(true)}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.emptyCtaText}>Ajouter mon premier bénéficiaire</Text>
                </TouchableOpacity>
              </View>
            )}
            {filteredBeneficiaries.length === 0 && beneficiaries.length > 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Aucun résultat pour "{searchTerm}"
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

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  Note privée (optionnel)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.inputMultiline,
                    { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
                  ]}
                  placeholder='Ex : "Loyer Tonton", "Frère Antsirabe"'
                  placeholderTextColor={colors.textSecondary}
                  value={formData.note}
                  onChangeText={(text) => setFormData({ ...formData, note: text })}
                  multiline
                  numberOfLines={2}
                  maxLength={500}
                />
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                  Visible uniquement par vous.
                </Text>
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

      {/* Menu contextuel (long-press) */}
      <Modal
        visible={!!actionMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setActionMenu(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActionMenu(null)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={[styles.menuSheet, { backgroundColor: colors.card }]}>
            {actionMenu && (
              <>
                <View style={styles.menuHeader}>
                  {actionMenu.avatarUrl ? (
                    <Image
                      source={{ uri: resolveAssetUrl(actionMenu.avatarUrl) }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                      <Text style={styles.avatarText}>{actionMenu.name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.beneficiaryName, { color: colors.text }]} numberOfLines={1}>
                      {actionMenu.name}
                    </Text>
                    <Text style={[styles.beneficiaryPhone, { color: colors.textSecondary }]}>
                      {formatPhone(actionMenu.phone)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    const target = actionMenu;
                    setActionMenu(null);
                    router.push({ pathname: '/transfers', params: { toPhone: target.phone } } as any);
                  }}
                >
                  <Ionicons name="send-outline" size={20} color={colors.primary} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Envoyer de l'argent</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    const target = actionMenu;
                    setActionMenu(null);
                    router.push({ pathname: '/history', params: { q: target.name } } as any);
                  }}
                >
                  <Ionicons name="time-outline" size={20} color={colors.text} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Voir l'historique</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    handleToggleFavorite(actionMenu.id);
                    setActionMenu(null);
                  }}
                >
                  <Ionicons
                    name={actionMenu.isFavorite ? 'star' : 'star-outline'}
                    size={20}
                    color={actionMenu.isFavorite ? '#f59e0b' : colors.text}
                  />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>
                    {actionMenu.isFavorite ? 'Retirer des favoris' : 'Marquer favori'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    const target = actionMenu;
                    setActionMenu(null);
                    handlePickAvatar(target);
                  }}
                >
                  <Ionicons name="image-outline" size={20} color={colors.text} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>
                    {actionMenu.avatarUrl ? 'Changer la photo' : 'Ajouter une photo'}
                  </Text>
                </TouchableOpacity>

                {actionMenu.avatarUrl && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      const target = actionMenu;
                      setActionMenu(null);
                      handleRemoveAvatar(target);
                    }}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.menuItemText, { color: colors.textSecondary }]}>
                      Retirer la photo
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    const target = actionMenu;
                    setActionMenu(null);
                    setQrShareTarget(target);
                  }}
                >
                  <Ionicons name="qr-code-outline" size={20} color={colors.text} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Partager le contact</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => openEditModal(actionMenu)}
                >
                  <Ionicons name="create-outline" size={20} color={colors.text} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Modifier</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuItem, styles.menuItemDanger]}
                  onPress={() => {
                    const target = actionMenu;
                    setActionMenu(null);
                    setShowDeleteConfirm(target.id);
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                  <Text style={[styles.menuItemText, { color: colors.error }]}>Supprimer</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal QR — partage du contact */}
      <Modal
        visible={!!qrShareTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setQrShareTarget(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setQrShareTarget(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={[styles.qrSheet, { backgroundColor: colors.card }]}
          >
            {qrShareTarget && (
              <>
                <View style={styles.qrHeader}>
                  <Text style={[styles.qrTitle, { color: colors.text }]}>Partager le contact</Text>
                  <TouchableOpacity onPress={() => setQrShareTarget(null)} hitSlop={8}>
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.qrName, { color: colors.text }]} numberOfLines={1}>
                  {qrShareTarget.name}
                </Text>
                <Text style={[styles.qrPhone, { color: colors.textSecondary }]}>
                  {formatPhone(qrShareTarget.phone)}
                </Text>

                <View style={styles.qrWrap}>
                  <QRCode
                    value={buildContactPayload(qrShareTarget)}
                    size={200}
                    backgroundColor="#fff"
                    color="#0f172a"
                  />
                </View>

                <Text style={[styles.qrHint, { color: colors.textSecondary }]}>
                  Scannez ce code dans M'Paye pour ajouter le contact instantanément.
                </Text>

                <TouchableOpacity
                  style={[styles.qrShareBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleShareContact(qrShareTarget)}
                >
                  <Ionicons name="share-outline" size={18} color="#fff" />
                  <Text style={styles.qrShareBtnText}>Partager</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
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
  // === Tri ===
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  sortChipText: {
    fontSize: 12,
  },
  // === Pagination "Voir plus" ===
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
    marginHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // === Empty state ===
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 48,
    gap: 12,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyCtaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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
  // === Badge "Sur M'Paye" ===
  mpayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  mpayBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // === Note privée (carte) ===
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  noteText: {
    fontSize: 11,
    fontStyle: 'italic',
    flex: 1,
  },
  // === Champ multilignes + helper text ===
  inputMultiline: {
    height: 64,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 11,
    marginTop: 4,
  },
  // === Menu contextuel (long-press) ===
  menuSheet: {
    width: '88%',
    borderRadius: 18,
    overflow: 'hidden',
    paddingVertical: 6,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.25)',
    marginBottom: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  menuItemDanger: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127,127,127,0.25)',
    marginTop: 4,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
  },
  // === Swipe actions ===
  swipeAction: {
    width: 90,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
    borderRadius: 12,
  },
  swipeFavorite: {
    marginLeft: 20,
  },
  swipeDelete: {
    marginRight: 20,
  },
  swipeActionLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  // === Modal QR partage ===
  qrSheet: {
    width: '86%',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    alignItems: 'center',
  },
  qrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  qrName: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  qrPhone: {
    fontSize: 13,
    marginTop: 2,
  },
  qrWrap: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
  },
  qrHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 10,
    lineHeight: 17,
  },
  qrShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
  },
  qrShareBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
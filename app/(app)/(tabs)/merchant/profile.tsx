// app/(app)/(tabs)/merchant/profile.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import GradientHeader from '../../../../src/components/GradientHeader';
import * as ImagePicker from 'expo-image-picker';
import { merchantApi, MerchantProfile as ApiMerchantProfile } from '../../../../src/services/merchantApi';
import { resolveAssetUrl } from '../../../../src/services/api';

interface BusinessProfile {
  businessName: string;
  businessType: string;
  registrationNumber: string;
  taxId: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  description: string;
  website: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  iban: string;
  bic: string;
}

const EMPTY_PROFILE: BusinessProfile = {
  businessName: '',
  businessType: '',
  registrationNumber: '',
  taxId: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  description: '',
  website: '',
  bankName: '',
  accountNumber: '',
  accountHolder: '',
  iban: '',
  bic: '',
};

export default function MerchantProfile() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [validationStatus, setValidationStatus] = useState<string>('PENDING');

  const [profile, setProfile] = useState<BusinessProfile>(EMPTY_PROFILE);

  const businessTypes = [
    'Commerce de détail',
    'Commerce de gros',
    'Restaurant / Hôtellerie',
    'Services',
    'Artisanat',
    'Agriculture',
    'Technologie',
    'Santé',
    'Éducation',
    'Autre',
  ];

  useEffect(() => {
    loadProfile();
  }, []);

  const applyProfile = (p: ApiMerchantProfile) => {
    setProfile((prev) => ({
      ...prev,
      businessName: p.businessName || '',
      businessType: p.businessType || '',
      registrationNumber: p.registrationNumber || '',
      taxId: p.vatNumber || '',
      email: p.email || '',
      phone: p.phone || '',
      address: p.address || '',
      description: p.description || '',
      website: p.website || '',
    }));
    // URLs serveur relatives (/uploads/...) → absolues pour <Image>
    setLogo(p.logoUrl ? resolveAssetUrl(p.logoUrl) : null);
    setCoverImage(p.coverUrl ? resolveAssetUrl(p.coverUrl) : null);
    setValidationStatus(p.validationStatus || 'PENDING');
  };

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await merchantApi.getProfile();
      applyProfile(res.data);
    } catch (error: any) {
      console.error('Erreur chargement profil:', error?.response?.data || error?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile.businessName.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir le nom de l\'entreprise');
      return;
    }
    if (!profile.email.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir l\'email');
      return;
    }
    if (!profile.phone.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir le téléphone');
      return;
    }

    setSaving(true);
    try {
      const res = await merchantApi.updateProfile({
        // `nom` est le champ persisté côté backend (businessName est dérivé).
        nom: profile.businessName.trim(),
        businessType: profile.businessType || undefined,
        registrationNumber: profile.registrationNumber || undefined,
        email: profile.email.trim(),
        phone: profile.phone.trim(),
        address: profile.address || undefined,
        description: profile.description || undefined,
        website: profile.website || undefined,
        vatNumber: profile.taxId || undefined,
      } as any);
      if (res?.data) applyProfile(res.data);
      Alert.alert('Succès', 'Profil mis à jour avec succès');
      setEditing(false);
    } catch (error: any) {
      Alert.alert('Erreur', error?.response?.data?.message || 'Impossible de mettre à jour le profil');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async (type: 'logo' | 'cover') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'logo' ? [1, 1] : [16, 9],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    // Upload immédiat — l'image est persistée même hors mode édition.
    if (type === 'logo') {
      setLogo(asset.uri); // aperçu optimiste
      setUploadingLogo(true);
      try {
        const res = await merchantApi.uploadLogo({
          uri: asset.uri,
          mimeType: asset.mimeType,
          fileName: asset.fileName ?? undefined,
        });
        setLogo(res.data.logoUrl ? resolveAssetUrl(res.data.logoUrl) : asset.uri);
      } catch (error: any) {
        Alert.alert('Erreur', error?.response?.data?.message || 'Échec de l’envoi du logo');
        setLogo((prev) => prev); // garde l'aperçu; l'utilisateur peut réessayer
      } finally {
        setUploadingLogo(false);
      }
    } else {
      setCoverImage(asset.uri);
      setUploadingCover(true);
      try {
        const res = await merchantApi.uploadCover({
          uri: asset.uri,
          mimeType: asset.mimeType,
          fileName: asset.fileName ?? undefined,
        });
        setCoverImage(res.data.coverUrl ? resolveAssetUrl(res.data.coverUrl) : asset.uri);
      } catch (error: any) {
        Alert.alert('Erreur', error?.response?.data?.message || 'Échec de l’envoi de la couverture');
      } finally {
        setUploadingCover(false);
      }
    }
  };

  const renderField = (
    label: string,
    value: string,
    field: keyof BusinessProfile,
    keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric'
  ) => (
    <View style={styles.fieldContainer}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      {editing ? (
        <TextInput
          style={[styles.fieldInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
          value={value}
          onChangeText={(text) => setProfile({ ...profile, [field]: text })}
          placeholderTextColor={colors.textSecondary}
          keyboardType={keyboardType || 'default'}
        />
      ) : (
        <Text style={[styles.fieldValue, { color: colors.text }]}>{value || '-'}</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const verified = validationStatus === 'APPROVED' || validationStatus === 'VERIFIED';
  const rejected = validationStatus === 'REJECTED';
  const statusColor = verified ? colors.success : rejected ? '#FF4D4F' : '#F59E0B';
  const statusLabel = verified
    ? 'Entreprise vérifiée'
    : rejected
      ? 'Demande rejetée'
      : 'En attente de validation';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        title="Mon entreprise"
        rightIcon={editing ? undefined : 'create-outline'}
        onRightPress={editing ? undefined : () => setEditing(true)}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Carte héros : couverture + logo + nom + statut */}
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.coverContainer, { backgroundColor: `${colors.primary}12` }]}
            onPress={() => editing && pickImage('cover')}
            disabled={!editing}
            activeOpacity={editing ? 0.85 : 1}
          >
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.coverImage} />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Ionicons name="image-outline" size={32} color={colors.primary} />
                <Text style={[styles.coverText, { color: colors.primary }]}>
                  {editing ? 'Ajouter une bannière' : 'Aucune bannière'}
                </Text>
              </View>
            )}
            {uploadingCover && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            {editing && (
              <View style={styles.editCoverIcon}>
                <Ionicons name="camera-outline" size={15} color="#fff" />
                <Text style={styles.editCoverText}>{coverImage ? 'Modifier' : 'Ajouter'}</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.heroBody}>
            <TouchableOpacity
              style={[styles.logoContainer, { backgroundColor: colors.background, borderColor: colors.card }]}
              onPress={() => editing && pickImage('logo')}
              disabled={!editing}
              activeOpacity={editing ? 0.85 : 1}
            >
              {logo ? (
                <Image source={{ uri: logo }} style={styles.logoImage} />
              ) : (
                <Ionicons name="storefront-outline" size={42} color={colors.primary} />
              )}
              {uploadingLogo && (
                <View style={styles.uploadOverlayRound}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
              {editing && (
                <View style={[styles.editLogoIcon, { backgroundColor: colors.primary, borderColor: colors.card }]}>
                  <Ionicons name="camera-outline" size={13} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            <Text style={[styles.businessName, { color: colors.text }]}>
              {profile.businessName || 'Mon entreprise'}
            </Text>
            {!!profile.businessType && (
              <Text style={[styles.businessType, { color: colors.textSecondary }]}>
                {profile.businessType}
              </Text>
            )}
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}1A` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>

      {/* Formulaire */}
      <View style={[styles.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Informations générales</Text>

        {renderField('Nom de l\'entreprise *', profile.businessName, 'businessName')}
        {renderField('Type d\'activité', profile.businessType, 'businessType')}
        
        {editing && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Type d'activité</Text>
            <View style={styles.typeSelector}>
              {businessTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeChip,
                    { borderColor: colors.border },
                    profile.businessType === type && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                  onPress={() => setProfile({ ...profile, businessType: type })}
                >
                  <Text style={[styles.typeChipText, profile.businessType === type && { color: '#fff' }]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        
        {renderField('Numéro d\'enregistrement', profile.registrationNumber, 'registrationNumber')}
        {renderField('NIF / STAT', profile.taxId, 'taxId')}
      </View>

      <View style={[styles.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Coordonnées</Text>

        {renderField('Email *', profile.email, 'email', 'email-address')}
        {renderField('Téléphone *', profile.phone, 'phone', 'phone-pad')}
        {renderField('Adresse', profile.address, 'address')}
        {renderField('Ville', profile.city, 'city')}
        {renderField('Site web', profile.website, 'website')}
        {renderField('Description', profile.description, 'description')}
        
        {editing && profile.description && (
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            value={profile.description}
            onChangeText={(text) => setProfile({ ...profile, description: text })}
            placeholder="Description de votre entreprise..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
          />
        )}
      </View>

      <View style={[styles.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Informations bancaires</Text>

        {renderField('Nom de la banque', profile.bankName, 'bankName')}
        {renderField('Numéro de compte', profile.accountNumber, 'accountNumber', 'numeric')}
        {renderField('Titulaire du compte', profile.accountHolder, 'accountHolder')}
        {renderField('IBAN', profile.iban, 'iban')}
        {renderField('BIC / SWIFT', profile.bic, 'bic')}
      </View>

      {/* Boutons d'action */}
      {editing && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: colors.border }]}
            onPress={() => setEditing(false)}
          >
            <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Espace */}
      <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  heroCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  coverContainer: {
    width: '100%',
    height: 140,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  coverText: { fontSize: 13, fontWeight: '500' },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadOverlayRound: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 44,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCoverIcon: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
  },
  editCoverText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  heroBody: {
    alignItems: 'center',
    paddingBottom: 18,
    marginTop: -44,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    resizeMode: 'cover',
  },
  editLogoIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    padding: 5,
    borderRadius: 15,
    borderWidth: 2,
  },
  businessName: { fontSize: 19, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  businessType: { fontSize: 13, marginTop: 2, textAlign: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, gap: 6, marginTop: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },

  formSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 14 },
  fieldContainer: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '500', marginBottom: 6 },
  fieldValue: { fontSize: 15, fontWeight: '500' },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    height: 100,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeChipText: { fontSize: 13 },

  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 15, fontWeight: '500' },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
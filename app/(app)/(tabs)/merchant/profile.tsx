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
  Switch,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';

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

export default function MerchantProfile() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  
  const [profile, setProfile] = useState<BusinessProfile>({
    businessName: 'Ma Boutique',
    businessType: 'Commerce de détail',
    registrationNumber: 'REG-2024-001',
    taxId: '123456789',
    email: 'contact@maboutique.com',
    phone: '+261 32 12 345 67',
    address: 'Lot IV 123 Antaninarenina',
    city: 'Antananarivo',
    description: 'Boutique de vente de produits locaux et artisanaux',
    website: 'www.maboutique.com',
    bankName: 'BOA Madagascar',
    accountNumber: '1234 5678 9012 3456',
    accountHolder: 'Jean Rakoto',
    iban: 'MG12 1234 5678 9012 3456 7890',
    bic: 'BOAMGMGX',
  });

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

  const loadProfile = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (error) {
      console.error('Erreur:', error);
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert('Succès', 'Profil mis à jour avec succès');
      setEditing(false);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour le profil');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async (type: 'logo' | 'cover') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'logo' ? [1, 1] : [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      if (type === 'logo') {
        setLogo(result.assets[0].uri);
      } else {
        setCoverImage(result.assets[0].uri);
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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mon entreprise</Text>
        {!editing ? (
          <TouchableOpacity onPress={() => setEditing(true)} style={styles.editButton}>
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Images */}
      <View style={styles.imagesSection}>
        {/* Cover Image */}
        <TouchableOpacity
          style={[styles.coverContainer, { backgroundColor: colors.card }]}
          onPress={() => editing && pickImage('cover')}
          disabled={!editing}
        >
          {coverImage ? (
            <Image source={{ uri: coverImage }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="image-outline" size={40} color={colors.textSecondary} />
              <Text style={[styles.coverText, { color: colors.textSecondary }]}>
                {editing ? 'Ajouter une bannière' : 'Bannière'}
              </Text>
            </View>
          )}
          {editing && (
            <View style={styles.editCoverIcon}>
              <Ionicons name="camera-outline" size={16} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        {/* Logo */}
        <View style={styles.logoWrapper}>
          <TouchableOpacity
            style={[styles.logoContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => editing && pickImage('logo')}
            disabled={!editing}
          >
            {logo ? (
              <Image source={{ uri: logo }} style={styles.logoImage} />
            ) : (
              <Ionicons name="storefront-outline" size={50} color={colors.primary} />
            )}
            {editing && (
              <View style={styles.editLogoIcon}>
                <Ionicons name="camera-outline" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={[styles.businessName, { color: colors.text }]}>{profile.businessName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${colors.success}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.statusText, { color: colors.success }]}>Entreprise vérifiée</Text>
          </View>
        </View>
      </View>

      {/* Formulaire */}
      <View style={styles.formSection}>
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

      <View style={styles.formSection}>
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

      <View style={styles.formSection}>
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
  editButton: { padding: 8 },

  imagesSection: {
    marginBottom: 20,
  },
  coverContainer: {
    width: '100%',
    height: 150,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    width: '100%',
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  coverText: { fontSize: 14 },
  editCoverIcon: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 6,
    borderRadius: 20,
  },
  logoWrapper: {
    alignItems: 'center',
    marginTop: -40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoImage: {
    width: 94,
    height: 94,
    borderRadius: 47,
    resizeMode: 'cover',
  },
  editLogoIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3b82f6',
    padding: 4,
    borderRadius: 15,
  },
  businessName: { fontSize: 18, fontWeight: 'bold', marginTop: 10 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, gap: 6, marginTop: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '500' },

  formSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  fieldContainer: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '500', marginBottom: 6 },
  fieldValue: { fontSize: 15 },
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
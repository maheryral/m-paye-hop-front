// app/(app)/profile.tsx
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import GradientHeader from '../../src/components/GradientHeader';
import { useAuth } from '../../src/contexts/AuthContext';

export default function Profile() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, updateUser} = useAuth();
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        prenom: user.prenom || '',
        nom: user.nom || '',
        email: user.email || '',
        telephone: user.telephone || '',
      });
    }
  }, [user]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateUser({
        prenom: formData.prenom,
        nom: formData.nom,
        email: formData.email,
        telephone: formData.telephone,
      });
      Alert.alert('Succès', 'Profil mis à jour');
      setEditMode(false);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    if (formData.prenom && formData.nom) {
      return `${formData.prenom[0]}${formData.nom[0]}`.toUpperCase();
    }
    if (formData.prenom) return formData.prenom[0].toUpperCase();
    return formData.email?.[0]?.toUpperCase() || 'U';
  };

  const getFullName = () => {
    if (formData.prenom && formData.nom) {
      return `${formData.prenom} ${formData.nom}`;
    }
    if (formData.prenom) return formData.prenom;
    return 'Utilisateur';
  };

  const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon as any} size={20} color={colors.primary} />
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value || 'Non renseigné'}</Text>
    </View>
  );

  const EditField = ({ 
    icon, 
    label, 
    value, 
    onChangeText,
    keyboardType = 'default'
  }: { 
    icon: string; 
    label: string; 
    value: string; 
    onChangeText: (text: string) => void;
    keyboardType?: string;
  }) => (
    <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.inputContainer}>
        <Ionicons name={icon as any} size={20} color={colors.primary} />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={`Entrez votre ${label.toLowerCase()}`}
          placeholderTextColor={colors.textSecondary}
          keyboardType={keyboardType as any}
        />
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title="Mon Profil"
        {...(!editMode
          ? { rightIcon: 'create-outline' as any, onRightPress: () => setEditMode(true) }
          : {})}
      />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <Text style={[styles.userName, { color: colors.text }]}>{getFullName()}</Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{formData.email}</Text>
        </View>

        {/* Carte KYC - AJOUTÉE ICI */}
        <View style={[styles.kycCard, { backgroundColor: `${colors.warning}15`, borderColor: colors.warning }]}>
          <Ionicons name="shield-outline" size={24} color={colors.warning} />
          <View style={styles.kycContent}>
            <Text style={[styles.kycTitle, { color: colors.warning }]}>Complétez votre vérification KYC</Text>
            <Text style={[styles.kycText, { color: colors.textSecondary }]}>
              Améliorez votre niveau de vérification pour augmenter vos limites de transaction
            </Text>
            <TouchableOpacity onPress={() => router.push('/complete-profile' as any)}>
              <Text style={[styles.kycLink, { color: colors.primary }]}>Compléter mon profil →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!editMode ? (
          // Mode Affichage
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <InfoRow icon="person-outline" label="Prénom" value={formData.prenom} />
            <InfoRow icon="person-outline" label="Nom" value={formData.nom} />
            <InfoRow icon="mail-outline" label="Email" value={formData.email} />
            <InfoRow icon="call-outline" label="Téléphone" value={formData.telephone} />
          </View>
        ) : (
          // Mode Édition
          <View style={[styles.editCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Modifier mes informations</Text>
            
            <EditField
              icon="person-outline"
              label="Prénom"
              value={formData.prenom}
              onChangeText={(text) => setFormData({ ...formData, prenom: text })}
            />
            
            <EditField
              icon="person-outline"
              label="Nom"
              value={formData.nom}
              onChangeText={(text) => setFormData({ ...formData, nom: text })}
            />
            
            <EditField
              icon="call-outline"
              label="Téléphone"
              value={formData.telephone}
              onChangeText={(text) => setFormData({ ...formData, telephone: text })}
              keyboardType="phone-pad"
            />

            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setEditMode(false);
                  if (user) {
                    setFormData({
                      prenom: user.prenom || '',
                      nom: user.nom || '',
                      email: user.email || '',
                      telephone: user.telephone || '',
                    });
                  }
                }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Annuler</Text>
              </TouchableOpacity>
            
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Enregistrer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
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
  editButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  // Styles pour la carte KYC
  kycCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 20,
  },
  kycContent: {
    flex: 1,
    gap: 6,
  },
  kycTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  kycText: {
    fontSize: 12,
    lineHeight: 18,
  },
  kycLink: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  editCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  inputLabel: {
    fontSize: 13,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
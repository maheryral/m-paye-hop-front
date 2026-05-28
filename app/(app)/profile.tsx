// app/(app)/profile.tsx
// Profil user avec KYC réel + niveau + limites + édition
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import GradientHeader from '../../src/components/GradientHeader';
import { useAuth } from '../../src/contexts/AuthContext';
import { accountService } from '../../src/services/api';
import { useLocale } from '../../src/contexts/LocaleContext';

type KycLevel = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';

interface ProfileData {
  id: string;
  email: string;
  telephone: string;
  prenom: string;
  nom: string;
  kycLevel: KycLevel;
  statutKyc?: string;
  isActive: boolean;
  role: string;
  memberSince: string;
  kycPending: boolean;
  kycRejected: boolean;
  kycHistory: Array<{
    id: string;
    status: string;
    level: string;
    submittedAt: string;
    decidedAt?: string | null;
    rejectionReason?: string | null;
  }>;
}

// Limites de transaction selon niveau KYC (en Ar)
const KYC_LIMITS: Record<KycLevel, { tx: number; daily: number; monthly: number }> = {
  BASIC:        { tx: 50000,   daily: 200000,   monthly: 1000000 },
  INTERMEDIATE: { tx: 500000,  daily: 2000000,  monthly: 10000000 },
  ADVANCED:    { tx: 5000000, daily: 20000000, monthly: 100000000 },
};

const KYC_META: Record<KycLevel, { label: string; color: string; icon: any }> = {
  BASIC:        { label: 'Basique',      color: '#f59e0b', icon: 'shield-outline' },
  INTERMEDIATE: { label: 'Intermédiaire', color: '#3b82f6', icon: 'shield-half-outline' },
  ADVANCED:     { label: 'Avancé',       color: '#10b981', icon: 'shield-checkmark' },
};

export default function Profile() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, updateUser } = useAuth();
  const { formatCurrency } = useLocale();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
  });

  const loadProfile = useCallback(async () => {
    try {
      const data = await accountService.getProfile();
      if (data) {
        setProfile(data);
        setFormData({
          prenom: data.prenom || '',
          nom: data.nom || '',
          email: data.email || '',
          telephone: data.telephone || '',
        });
      }
    } catch (e: any) {
      console.error('Erreur chargement profil:', e?.response?.data || e?.message);
      // Fallback : utiliser user du contexte si API ne répond pas
      if (user) {
        setProfile({
          id: user.id,
          email: user.email,
          telephone: user.telephone || '',
          prenom: user.prenom || '',
          nom: user.nom || '',
          kycLevel: (user.kycLevel as KycLevel) || 'BASIC',
          isActive: user.isActive,
          role: 'USER',
          memberSince: new Date().toISOString(),
          kycPending: false,
          kycRejected: false,
          kycHistory: [],
        });
        setFormData({
          prenom: user.prenom || '',
          nom: user.nom || '',
          email: user.email,
          telephone: user.telephone || '',
        });
      }
    } finally {
      setLoadingProfile(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUser({
        prenom: formData.prenom,
        nom: formData.nom,
        email: formData.email,
        telephone: formData.telephone,
      });
      Alert.alert('Succès', 'Profil mis à jour');
      setEditMode(false);
      await loadProfile();
    } catch (e: any) {
      Alert.alert(
        'Erreur',
        e?.response?.data?.message || 'Impossible de mettre à jour',
      );
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    const p = formData.prenom?.trim();
    const n = formData.nom?.trim();
    if (p && n) return `${p[0]}${n[0]}`.toUpperCase();
    if (p) return p[0].toUpperCase();
    return formData.email?.[0]?.toUpperCase() || 'U';
  };

  const getFullName = () => {
    if (formData.prenom && formData.nom) return `${formData.prenom} ${formData.nom}`;
    if (formData.prenom) return formData.prenom;
    return 'Utilisateur';
  };

  if (loadingProfile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GradientHeader title="Mon Profil" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      </View>
    );
  }

  const kycLevel = (profile?.kycLevel as KycLevel) || 'BASIC';
  const kycMeta = KYC_META[kycLevel];
  const limits = KYC_LIMITS[kycLevel];
  const memberSince = profile?.memberSince
    ? new Date(profile.memberSince).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : null;

  // État de la carte KYC selon le statut réel
  const renderKycCard = () => {
    // 1. KYC ADVANCED → tout est validé
    if (kycLevel === 'ADVANCED') {
      return (
        <View style={[styles.kycCard, { backgroundColor: '#10b98115', borderColor: '#10b981' }]}>
          <Ionicons name="shield-checkmark" size={28} color="#10b981" />
          <View style={styles.kycContent}>
            <Text style={[styles.kycTitle, { color: '#10b981' }]}>Vérification complète ✓</Text>
            <Text style={[styles.kycText, { color: colors.textSecondary }]}>
              Votre identité est entièrement vérifiée. Vous bénéficiez des limites maximales.
            </Text>
          </View>
        </View>
      );
    }

    // 2. KYC en cours d'examen
    if (profile?.kycPending) {
      return (
        <View style={[styles.kycCard, { backgroundColor: '#3b82f615', borderColor: '#3b82f6' }]}>
          <Ionicons name="hourglass-outline" size={28} color="#3b82f6" />
          <View style={styles.kycContent}>
            <Text style={[styles.kycTitle, { color: '#3b82f6' }]}>Vérification en cours ⏳</Text>
            <Text style={[styles.kycText, { color: colors.textSecondary }]}>
              Nous examinons vos documents. Réponse sous 24-48h.
            </Text>
          </View>
        </View>
      );
    }

    // 3. KYC rejeté → afficher raison
    if (profile?.kycRejected) {
      const lastRejected = profile.kycHistory.find(k => k.status === 'REJECTED');
      return (
        <View style={[styles.kycCard, { backgroundColor: '#ef444415', borderColor: '#ef4444' }]}>
          <Ionicons name="close-circle-outline" size={28} color="#ef4444" />
          <View style={styles.kycContent}>
            <Text style={[styles.kycTitle, { color: '#ef4444' }]}>Vérification rejetée ✗</Text>
            <Text style={[styles.kycText, { color: colors.textSecondary }]}>
              {lastRejected?.rejectionReason || 'Documents non conformes. Veuillez réessayer.'}
            </Text>
            <TouchableOpacity onPress={() => router.push('/kyc-liveness' as any)}>
              <Text style={[styles.kycLink, { color: '#ef4444' }]}>📷 Refaire la vérification du visage →</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // 4. KYC à compléter (cas par défaut BASIC)
    return (
      <View style={[styles.kycCard, { backgroundColor: '#f59e0b15', borderColor: '#f59e0b' }]}>
        <Ionicons name="shield-outline" size={28} color="#f59e0b" />
        <View style={styles.kycContent}>
          <Text style={[styles.kycTitle, { color: '#f59e0b' }]}>
            Complétez votre vérification KYC
          </Text>
          <Text style={[styles.kycText, { color: colors.textSecondary }]}>
            Vous êtes au niveau Basique. Vérifiez votre identité pour augmenter vos limites jusqu'à {formatCurrency(KYC_LIMITS.ADVANCED.monthly)}/mois.
          </Text>
          <TouchableOpacity onPress={() => router.push('/complete-profile' as any)}>
            <Text style={[styles.kycLink, { color: colors.primary }]}>
              Compléter mon profil →
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/kyc-liveness' as any)}>
            <Text style={[styles.kycLink, { color: colors.primary }]}>
              📷 Vérifier mon visage →
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon as any} size={20} color={colors.primary} />
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>
        {value || 'Non renseigné'}
      </Text>
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
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadProfile();
            }}
            tintColor="#1e40af"
          />
        }
      >
        <View style={styles.content}>
          {/* Avatar + nom */}
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{getInitials()}</Text>
              {/* Badge niveau KYC sur l'avatar */}
              <View style={[styles.avatarBadge, { backgroundColor: kycMeta.color, borderColor: colors.background }]}>
                <Ionicons name={kycMeta.icon} size={14} color="#fff" />
              </View>
            </View>
            <Text style={[styles.userName, { color: colors.text }]}>{getFullName()}</Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{formData.email}</Text>
            {memberSince && (
              <Text style={[styles.memberSince, { color: colors.textSecondary }]}>
                Membre depuis {memberSince}
              </Text>
            )}
          </View>

          {/* Carte KYC dynamique */}
          {renderKycCard()}

          {/* Niveau KYC + limites */}
          <View style={[styles.kycLevelCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.kycLevelHeader}>
              <View style={[styles.kycLevelBadge, { backgroundColor: kycMeta.color + '20' }]}>
                <Ionicons name={kycMeta.icon} size={16} color={kycMeta.color} />
                <Text style={[styles.kycLevelText, { color: kycMeta.color }]}>
                  Niveau {kycMeta.label}
                </Text>
              </View>
            </View>
            <Text style={[styles.kycLevelSub, { color: colors.textSecondary }]}>
              Vos limites de transaction actuelles
            </Text>
            <View style={[styles.limitRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.limitLabel, { color: colors.textSecondary }]}>Par transaction</Text>
              <Text style={[styles.limitValue, { color: colors.text }]}>{formatCurrency(limits.tx)}</Text>
            </View>
            <View style={[styles.limitRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.limitLabel, { color: colors.textSecondary }]}>Par jour</Text>
              <Text style={[styles.limitValue, { color: colors.text }]}>{formatCurrency(limits.daily)}</Text>
            </View>
            <View style={[styles.limitRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.limitLabel, { color: colors.textSecondary }]}>Par mois</Text>
              <Text style={[styles.limitValue, { color: colors.text }]}>{formatCurrency(limits.monthly)}</Text>
            </View>
          </View>

          {/* Infos perso */}
          {!editMode ? (
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Informations personnelles</Text>
              <InfoRow icon="person-outline" label="Prénom" value={formData.prenom} />
              <InfoRow icon="person-outline" label="Nom" value={formData.nom} />
              <InfoRow icon="mail-outline" label="Email" value={formData.email} />
              <InfoRow icon="call-outline" label="Téléphone" value={formData.telephone} />
            </View>
          ) : (
            <View style={[styles.editCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Modifier mes informations</Text>

              {/* Prénom */}
              <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Prénom</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color={colors.primary} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={formData.prenom}
                    onChangeText={(t) => setFormData({ ...formData, prenom: t })}
                    placeholder="Votre prénom"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              {/* Nom */}
              <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Nom</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color={colors.primary} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={formData.nom}
                    onChangeText={(t) => setFormData({ ...formData, nom: t })}
                    placeholder="Votre nom"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              {/* Téléphone */}
              <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Téléphone</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="call-outline" size={20} color={colors.primary} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={formData.telephone}
                    onChangeText={(t) => setFormData({ ...formData, telephone: t })}
                    placeholder="Votre numéro"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* Email — non éditable (lié à la connexion) */}
              <View style={[styles.inputGroup, { borderBottomColor: colors.border, opacity: 0.6 }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email (non modifiable)</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
                  <Text style={[styles.input, { color: colors.textSecondary, paddingVertical: 12 }]}>
                    {formData.email}
                  </Text>
                </View>
              </View>

              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setEditMode(false);
                    if (profile) {
                      setFormData({
                        prenom: profile.prenom || '',
                        nom: profile.nom || '',
                        email: profile.email || '',
                        telephone: profile.telephone || '',
                      });
                    }
                  }}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.text }]}>Annuler</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
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
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },

  avatarContainer: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    position: 'relative',
  },
  avatarText: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  userName: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  userEmail: { fontSize: 14 },
  memberSince: { fontSize: 11, marginTop: 6, fontStyle: 'italic' },

  // Carte KYC
  kycCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 16, borderRadius: 16, borderWidth: 1,
    gap: 12, marginBottom: 16,
  },
  kycContent: { flex: 1, gap: 6 },
  kycTitle: { fontSize: 14, fontWeight: '700' },
  kycText: { fontSize: 12, lineHeight: 18 },
  kycLink: { fontSize: 12, fontWeight: '600', marginTop: 4 },

  // Niveau KYC + limites
  kycLevelCard: {
    padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 16,
  },
  kycLevelHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  kycLevelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  kycLevelText: { fontSize: 12, fontWeight: '700' },
  kycLevelSub: { fontSize: 11, marginBottom: 12 },
  limitRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1,
  },
  limitLabel: { fontSize: 13 },
  limitValue: { fontSize: 13, fontWeight: '700' },

  // Infos perso
  infoCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  editCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1,
  },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '600', maxWidth: '55%' },

  inputGroup: { marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1 },
  inputLabel: { fontSize: 13, marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },

  editButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelButton: {
    flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center',
  },
  cancelButtonText: { fontSize: 15, fontWeight: '600' },
  saveButton: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

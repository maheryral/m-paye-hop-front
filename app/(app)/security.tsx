// app/(app)/security.tsx
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import GradientHeader from '../../src/components/GradientHeader';
import { useAuth } from '../../src/contexts/AuthContext';

interface SecurityItem {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: boolean;
  action: string;
}

interface Session {
  id: string;
  deviceName: string;
  location: string;
  ipAddress: string;
  current: boolean;
  lastActivity: string;
}

export default function Security() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, logoutAllDevices } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [securityItems, setSecurityItems] = useState<SecurityItem[]>([
    { id: '2fa', name: 'Authentification à 2 facteurs', description: 'Ajoutez une couche de sécurité supplémentaire', icon: 'lock-closed-outline', status: false, action: 'Activer' },
    { id: 'biometric', name: 'Authentification biométrique', description: 'Utilisez votre empreinte digitale ou Face ID', icon: 'finger-print-outline', status: true, action: 'Désactiver' },
  ]);

  const [sessions, setSessions] = useState<Session[]>([
    { id: '1', deviceName: 'iPhone 13 Pro', location: 'Antananarivo, Madagascar', ipAddress: '192.168.1.176', current: true, lastActivity: new Date().toISOString() },
    { id: '2', deviceName: 'Chrome sur Windows', location: 'Paris, France', ipAddress: '83.123.45.67', current: false, lastActivity: new Date(Date.now() - 86400000).toISOString() },
  ]);

  const securityScore = 75;

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'Veuillez remplir tous les champs' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas' });
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setMessage({ type: 'success', text: 'Mot de passe mis à jour avec succès' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setMessage(null), 3000);
    }, 1500);
  };

  const toggleSecurityItem = (id: string) => {
    setSecurityItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, status: !item.status, action: !item.status ? 'Désactiver' : 'Activer' } : item
      )
    );
    const item = securityItems.find(i => i.id === id);
    Alert.alert(
      item?.status ? 'Désactivation' : 'Activation',
      `Voulez-vous vraiment ${item?.status ? 'désactiver' : 'activer'} ${item?.name?.toLowerCase()} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: () => {} },
      ]
    );
  };

  const revokeSession = (sessionId: string) => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment déconnecter cet appareil ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          onPress: () => {
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            setMessage({ type: 'success', text: 'Appareil déconnecté' });
            setTimeout(() => setMessage(null), 3000);
          },
        },
      ]
    );
  };

  const revokeAllSessions = () => {
    Alert.alert(
      'Déconnexion globale',
      'Voulez-vous vraiment déconnecter tous les autres appareils ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter tous',
          onPress: () => {
            setSessions(prev => prev.filter(s => s.current));
            setMessage({ type: 'success', text: 'Tous les appareils ont été déconnectés' });
            setTimeout(() => setMessage(null), 3000);
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Aujourd'hui";
    if (days === 1) return 'Hier';
    return `Il y a ${days} jours`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader title="Sécurité" subtitle="Protégez votre compte" />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Protégez votre compte
        </Text>

        {/* Message */}
        {message && (
          <View
            style={[
              styles.messageContainer,
              { backgroundColor: message.type === 'success' ? `${colors.success}15` : `${colors.error}15`, borderColor: message.type === 'success' ? colors.success : colors.error },
            ]}
          >
            <Ionicons name={message.type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={18} color={message.type === 'success' ? colors.success : colors.error} />
            <Text style={[styles.messageText, { color: message.type === 'success' ? colors.success : colors.error }]}>
              {message.text}
            </Text>
          </View>
        )}

        {/* Security Score */}
        <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.scoreHeader}>
            <View style={styles.scoreTitleContainer}>
              <Ionicons name="shield-checkmark" size={20} color={colors.success} />
              <Text style={[styles.scoreTitle, { color: colors.text }]}>Score de sécurité</Text>
            </View>
            <Text style={[styles.scoreValue, { color: colors.success }]}>{securityScore}/100</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${securityScore}%`, backgroundColor: colors.success }]} />
          </View>
          <Text style={[styles.scoreText, { color: colors.textSecondary }]}>
            {securityScore >= 80 ? 'Votre compte est très bien protégé' :
             securityScore >= 50 ? 'Votre compte est bien protégé' :
             'Améliorez votre sécurité en complétant votre profil'}
          </Text>
        </View>

        {/* Change Password */}
        <View style={[styles.passwordCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.passwordHeader}>
            <Ionicons name="key-outline" size={20} color={colors.primary} />
            <Text style={[styles.passwordTitle, { color: colors.text }]}>Changer le mot de passe</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Mot de passe actuel</Text>
            <View style={[styles.passwordInputContainer, { borderColor: colors.border }]}>
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Nouveau mot de passe</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Confirmer le mot de passe</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View> 

          <TouchableOpacity
            style={[styles.updateButton, { backgroundColor: colors.primary }]}
            onPress={handleChangePassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.updateButtonText}>Mettre à jour</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Security Items */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Sécurité additionnelle</Text>
          {securityItems.map((item) => (
            <View key={item.id} style={[styles.securityItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.securityItemLeft}>
                <View style={[styles.securityIcon, { backgroundColor: `${colors.primary}20` }]}>
                  <Ionicons name={item.icon} size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.securityItemName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.securityItemDescription, { color: colors.textSecondary }]}>{item.description}</Text>
                </View>
              </View>
              <Switch
                value={item.status}
                onValueChange={() => toggleSecurityItem(item.id)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        {/* Connected Devices */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Appareils connectés ({sessions.length})</Text>
            {sessions.filter(s => !s.current).length > 0 && (
              <TouchableOpacity onPress={revokeAllSessions}>
                <Text style={[styles.revokeAllText, { color: colors.error }]}>Tout déconnecter</Text>
              </TouchableOpacity>
            )}
          </View>

          {sessions.map((session) => (
            <View key={session.id} style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sessionInfo}>
                <View style={styles.sessionDevice}>
                  <Ionicons name="phone-portrait-outline" size={18} color={colors.textSecondary} />
                  <Text style={[styles.sessionDeviceName, { color: colors.text }]}>{session.deviceName}</Text>
                  {session.current && (
                    <View style={[styles.currentBadge, { backgroundColor: `${colors.success}20` }]}>
                      <Text style={[styles.currentBadgeText, { color: colors.success }]}>Actuel</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.sessionLocation, { color: colors.textSecondary }]}>{session.location}</Text>
                <Text style={[styles.sessionMeta, { color: colors.textSecondary }]}>
                  Dernière activité: {formatDate(session.lastActivity)} • IP: {session.ipAddress}
                </Text>
              </View>
              {!session.current && (
                <TouchableOpacity onPress={() => revokeSession(session.id)} style={styles.revokeButton}>
                  <Ionicons name="log-out-outline" size={18} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* KYC Upgrade */}
        {user?.kycLevel !== 'ADVANCED' && (
          <View style={[styles.kycCard, { backgroundColor: `${colors.warning}15`, borderColor: colors.warning }]}>
            <Ionicons name="shield-outline" size={20} color={colors.warning} />
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
        )}

        {/* 🛡️ Sessions actives — déconnecter tous mes appareils */}
        <View style={[styles.passwordCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 20 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Ionicons name="phone-portrait-outline" size={22} color={colors.text} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
              Sessions actives
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 14 }}>
            Si vous avez perdu votre téléphone ou détecté une activité suspecte,
            déconnectez tous les appareils. Vous devrez vous reconnecter partout.
          </Text>
          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 8, backgroundColor: '#ef4444', paddingVertical: 12, borderRadius: 10,
            }}
            onPress={() => {
              Alert.alert(
                'Déconnecter tous les appareils ?',
                'Toutes vos sessions seront révoquées immédiatement.',
                [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Déconnecter tout',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await logoutAllDevices();
                        router.replace('/(auth)/login');
                      } catch (e: any) {
                        setMessage({
                          type: 'error',
                          text: e?.response?.data?.message || 'Erreur',
                        });
                      }
                    },
                  },
                ],
              );
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
              Déconnecter tous mes appareils
            </Text>
          </TouchableOpacity>
        </View>
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
    marginBottom: 8,
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
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
  },
  messageText: {
    fontSize: 13,
    flex: 1,
  },
  scoreCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreText: {
    fontSize: 12,
  },
  // ✅ AJOUTER CE STYLE MANQUANT
  passwordCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  passwordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  passwordTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
  },
  updateButton: {
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  revokeAllText: {
    fontSize: 12,
  },
  securityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  securityItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  securityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityItemName: {
    fontSize: 14,
    fontWeight: '500',
  },
  securityItemDescription: {
    fontSize: 11,
    marginTop: 2,
  },
  sessionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  sessionInfo: {
    flex: 1,
    gap: 4,
  },
  sessionDevice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionDeviceName: {
    fontSize: 14,
    fontWeight: '500',
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  sessionLocation: {
    fontSize: 12,
  },
  sessionMeta: {
    fontSize: 10,
  },
  revokeButton: {
    padding: 8,
  },
  kycCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
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
  },
  kycLink: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
});
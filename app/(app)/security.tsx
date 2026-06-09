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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import GradientHeader from '../../src/components/GradientHeader';
import { useAuth } from '../../src/contexts/AuthContext';
import { authService, accountService } from '../../src/services/api';

interface SecurityItem {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: boolean;
  action: string;
}

interface Session {
  deviceId: string;
  deviceName: string;
  deviceType?: string;
  location?: string | null;
  ipAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationSource?: string | null;
  os?: string | null;
  osVersion?: string | null;
  browser?: string | null;
  model?: string | null;
  current: boolean;
  lastActivityAt: string;
}

export default function Security() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, logoutAllDevices, updateUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Step-up OTP — utilisé pour 2 cas :
  //  - Création initiale du mdp (compte OTP, hasPassword=false)
  //  - Réinitialisation (user qui a oublié son mdp) — `resetMode=true`
  // Empêche un JWT volé de verrouiller le compte avec un mdp inconnu.
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const [securityItems, setSecurityItems] = useState<SecurityItem[]>([
    { id: '2fa', name: 'Authentification à 2 facteurs', description: 'Ajoutez une couche de sécurité supplémentaire', icon: 'lock-closed-outline', status: false, action: 'Activer' },
    { id: 'biometric', name: 'Authentification biométrique', description: 'Utilisez votre empreinte digitale ou Face ID', icon: 'finger-print-outline', status: true, action: 'Désactiver' },
  ]);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const data = await authService.getSessions();
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      // garde liste vide
    } finally {
      setSessionsLoading(false);
    }
  };

  // === Score de sécurité dynamique (calculé serveur) ===
  type SecurityComponent = {
    id: string;
    label: string;
    weight: number;
    achieved: boolean;
    hint?: string;
  };
  type SecurityScoreData = {
    score: number;
    level: 'weak' | 'fair' | 'good' | 'excellent';
    components: SecurityComponent[];
  };
  const [scoreData, setScoreData] = useState<SecurityScoreData | null>(null);
  const [scoreLoading, setScoreLoading] = useState(true);

  const loadSecurityScore = async () => {
    try {
      setScoreLoading(true);
      const data = await accountService.getSecurityScore();
      setScoreData(data);
    } catch {
      // Fallback silencieux : on n'affiche rien plutôt qu'un faux score
    } finally {
      setScoreLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    loadSecurityScore();
  }, []);

  // Le score local est ce que le backend renvoie ; defaut 0 le temps du chargement.
  const securityScore = scoreData?.score ?? 0;

  /** Couleur dérivée du niveau retourné par le serveur. */
  const scoreColor =
    scoreData?.level === 'excellent'
      ? colors.success
      : scoreData?.level === 'good'
      ? colors.success
      : scoreData?.level === 'fair'
      ? '#f59e0b'
      : colors.error;

  const scoreSubtitle =
    scoreData?.level === 'excellent'
      ? 'Votre compte est parfaitement protégé'
      : scoreData?.level === 'good'
      ? 'Votre compte est bien protégé'
      : scoreData?.level === 'fair'
      ? 'Votre compte peut être renforcé'
      : 'Votre compte est vulnérable — agissez maintenant';

  // Inscription OTP → `user.hasPassword=false` → mode "Création" (sans currentPassword).
  // Sinon → mode "Modification" (3 champs).
  const hasPassword = !!user?.hasPassword;

  /**
   * Validation locale partagée. En mode reset, on ignore le champ currentPassword
   * car l'user ne s'en souvient justement pas — l'OTP est sa preuve.
   */
  const validatePasswordInputs = (): string | null => {
    if (hasPassword && !resetMode && !currentPassword) return 'Mot de passe actuel requis';
    if (!newPassword || !confirmPassword) return 'Veuillez remplir tous les champs';
    if (newPassword.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères';
    if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(newPassword))
      return 'Le mot de passe doit contenir au moins une lettre et un chiffre';
    if (newPassword !== confirmPassword) return 'Les mots de passe ne correspondent pas';
    return null;
  };

  const handleChangePassword = async () => {
    const err = validatePasswordInputs();
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }

    // === Chemin OTP (Création OU Réinitialisation) ===
    if (!hasPassword || resetMode) {
      setOtpSending(true);
      try {
        await authService.sendPasswordSetupOtp();
        setOtpInput('');
        setOtpModalOpen(true);
      } catch (e: any) {
        setMessage({
          type: 'error',
          text: e?.response?.data?.message || "Impossible d'envoyer le code SMS",
        });
        setTimeout(() => setMessage(null), 3000);
      } finally {
        setOtpSending(false);
      }
      return;
    }

    // === Chemin MODIFICATION standard (currentPassword) ===
    setLoading(true);
    try {
      await authService.changePassword({ currentPassword, newPassword });
      setMessage({ type: 'success', text: 'Mot de passe mis à jour avec succès' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setMessage({
        type: 'error',
        text: e?.response?.data?.message || 'Échec de la mise à jour du mot de passe',
      });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  /**
   * Soumet l'opération mdp (création/reset) après saisie de l'OTP step-up.
   * Garde le modal ouvert si l'OTP est invalide pour permettre une nouvelle saisie.
   */
  const submitCreationWithOtp = async () => {
    if (!/^\d{6}$/.test(otpInput)) {
      setMessage({ type: 'error', text: 'Code à 6 chiffres requis' });
      return;
    }
    setLoading(true);
    try {
      await authService.changePassword({ otpCode: otpInput, newPassword });
      if (user && !hasPassword) await updateUser({ hasPassword: true });
      const successMsg = resetMode
        ? 'Mot de passe réinitialisé avec succès'
        : 'Mot de passe créé avec succès';
      setMessage({ type: 'success', text: successMsg });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtpInput('');
      setOtpModalOpen(false);
      setResetMode(false);
    } catch (e: any) {
      setMessage({
        type: 'error',
        text: e?.response?.data?.message || 'Code invalide ou expiré',
      });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  /** Re-déclenche l'envoi du SMS — utile si le user n'a rien reçu. */
  const resendSetupOtp = async () => {
    setOtpSending(true);
    try {
      await authService.sendPasswordSetupOtp();
      setMessage({ type: 'success', text: 'Nouveau code envoyé par SMS' });
    } catch (e: any) {
      setMessage({
        type: 'error',
        text: e?.response?.data?.message || 'Impossible de renvoyer le code',
      });
    } finally {
      setOtpSending(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  /** Bascule en mode "Réinitialisation" : cache currentPassword, vide le champ. */
  const triggerResetMode = () => {
    setResetMode(true);
    setCurrentPassword('');
    setMessage({
      type: 'success',
      text: "Mode réinitialisation : un SMS vous sera envoyé pour confirmer.",
    });
    setTimeout(() => setMessage(null), 4000);
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

  const revokeSession = (deviceId: string) => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment déconnecter cet appareil ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          onPress: async () => {
            try {
              await authService.revokeDevice(deviceId);
              setSessions(prev => prev.filter(s => s.deviceId !== deviceId));
              setMessage({ type: 'success', text: 'Appareil déconnecté' });
            } catch {
              setMessage({ type: 'error', text: 'Échec de la déconnexion' });
            }
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
          onPress: async () => {
            try {
              await logoutAllDevices();
              await loadSessions();
              setMessage({ type: 'success', text: 'Tous les autres appareils ont été déconnectés' });
            } catch {
              setMessage({ type: 'error', text: 'Échec' });
            }
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

        {/* Security Score — calculé serveur, mis à jour à chaque ouverture
            de la page. La liste des composants permet à l'user de savoir
            exactement quoi améliorer pour gagner des points. */}
        <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.scoreHeader}>
            <View style={styles.scoreTitleContainer}>
              <Ionicons name="shield-checkmark" size={20} color={scoreColor} />
              <Text style={[styles.scoreTitle, { color: colors.text }]}>Score de sécurité</Text>
            </View>
            {scoreLoading ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Text style={[styles.scoreValue, { color: scoreColor }]}>
                {securityScore}/100
              </Text>
            )}
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${securityScore}%`, backgroundColor: scoreColor },
              ]}
            />
          </View>
          <Text style={[styles.scoreText, { color: colors.textSecondary }]}>
            {scoreSubtitle}
          </Text>

          {/* Détail des composants — uniquement quand on a la donnée */}
          {scoreData && (
            <View style={styles.scoreComponents}>
              {scoreData.components.map((c) => (
                <View key={c.id} style={styles.scoreComponent}>
                  <Ionicons
                    name={c.achieved ? 'checkmark-circle' : 'close-circle-outline'}
                    size={16}
                    color={c.achieved ? colors.success : colors.textSecondary}
                  />
                  <View style={styles.scoreComponentText}>
                    <Text
                      style={[
                        styles.scoreComponentLabel,
                        { color: c.achieved ? colors.text : colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {c.label}
                    </Text>
                    {!c.achieved && c.hint && (
                      <Text style={[styles.scoreComponentHint, { color: colors.textSecondary }]}>
                        {c.hint}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.scoreComponentWeight, { color: colors.textSecondary }]}>
                    +{c.weight}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Change Password — 3 modes :
            • Création (hasPassword=false) : OTP step-up
            • Modification (hasPassword=true, !resetMode) : currentPassword
            • Réinitialisation (hasPassword=true, resetMode) : OTP step-up (mdp oublié) */}
        <View style={[styles.passwordCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.passwordHeader}>
            <Ionicons name="key-outline" size={20} color={colors.primary} />
            <Text style={[styles.passwordTitle, { color: colors.text }]}>
              {!hasPassword
                ? 'Créer un mot de passe'
                : resetMode
                ? 'Réinitialiser le mot de passe'
                : 'Modifier le mot de passe'}
            </Text>
          </View>

          {!hasPassword && (
            <Text style={[styles.passwordHint, { color: colors.textSecondary }]}>
              Votre compte n'a pas encore de mot de passe. En créer un permet de
              vous connecter sans attendre le code SMS.
            </Text>
          )}

          {hasPassword && resetMode && (
            <Text style={[styles.passwordHint, { color: colors.textSecondary }]}>
              Un code SMS sera envoyé à {user?.telephone || 'votre numéro'} pour
              confirmer la réinitialisation.
            </Text>
          )}

          {hasPassword && !resetMode && (
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
          )}

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
            disabled={loading || otpSending}
          >
            {loading || otpSending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.updateButtonText}>
                {!hasPassword
                  ? 'Créer le mot de passe'
                  : resetMode
                  ? 'Envoyer le code SMS'
                  : 'Mettre à jour'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Bouton secondaire "Réinitialiser via SMS" — visible uniquement en
              mode Modification, pour les users qui ont oublié leur mdp.
              Plus discoverable qu'un simple lien sous le champ currentPassword. */}
          {hasPassword && !resetMode && (
            <>
              <View style={styles.orDivider}>
                <View style={[styles.orLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.orText, { color: colors.textSecondary }]}>ou</Text>
                <View style={[styles.orLine, { backgroundColor: colors.border }]} />
              </View>
              <TouchableOpacity
                onPress={triggerResetMode}
                style={[styles.secondaryButton, { borderColor: colors.primary }]}
                disabled={loading || otpSending}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
                <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                  Réinitialiser via code SMS
                </Text>
              </TouchableOpacity>
              <Text style={[styles.secondaryHint, { color: colors.textSecondary }]}>
                Vous avez oublié votre mot de passe ? Recevez un code par SMS
                pour le réinitialiser.
              </Text>
            </>
          )}

          {hasPassword && resetMode && (
            <TouchableOpacity
              onPress={() => setResetMode(false)}
              hitSlop={6}
              style={styles.forgotPwdLink}
            >
              <Text style={[styles.forgotPwdText, { color: colors.textSecondary }]}>
                ← Annuler, je veux modifier avec mon mot de passe actuel
              </Text>
            </TouchableOpacity>
          )}
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
                <View style={styles.securityItemText}>
                  <Text
                    style={[styles.securityItemName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={[styles.securityItemDescription, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {item.description}
                  </Text>
                </View>
              </View>
              {/* Toggle custom — remplace <Switch> natif dont la largeur imposée
                  par la plateforme débordait sur certains écrans. Bornes 44×24
                  garanties, identique iOS/Android, alignées sur le web. */}
              <TouchableOpacity
                onPress={() => toggleSecurityItem(item.id)}
                activeOpacity={0.8}
                style={[
                  styles.toggleTrack,
                  {
                    backgroundColor: item.status ? colors.primary : colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    { transform: [{ translateX: item.status ? 20 : 2 }] },
                  ]}
                />
              </TouchableOpacity>
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

          {sessionsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
          ) : sessions.length === 0 ? (
            <Text style={[styles.sessionMeta, { color: colors.textSecondary, textAlign: 'center', marginVertical: 12 }]}>
              Aucune session active
            </Text>
          ) : (
            sessions.map((session) => {
              const isMobile =
                session.deviceType === 'MOBILE' || session.deviceType === 'TABLET';
              const detail = [
                session.os && (session.osVersion ? `${session.os} ${session.osVersion}` : session.os),
                session.browser,
                session.model,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <View key={session.deviceId} style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.sessionInfo}>
                    <View style={styles.sessionDevice}>
                      <Ionicons
                        name={isMobile ? 'phone-portrait-outline' : 'desktop-outline'}
                        size={18}
                        color={colors.textSecondary}
                      />
                      <Text style={[styles.sessionDeviceName, { color: colors.text }]}>{session.deviceName}</Text>
                      {session.current && (
                        <View style={[styles.currentBadge, { backgroundColor: `${colors.success}20` }]}>
                          <Text style={[styles.currentBadgeText, { color: colors.success }]}>Actuel</Text>
                        </View>
                      )}
                    </View>
                    {detail ? (
                      <Text style={[styles.sessionMeta, { color: colors.textSecondary }]}>{detail}</Text>
                    ) : null}
                    <Text style={[styles.sessionLocation, { color: colors.textSecondary }]}>
                      <Ionicons name="location-outline" size={12} color={colors.textSecondary} />{' '}
                      {session.location || 'Localisation inconnue'}
                      {session.locationSource === 'gps' ? ' (GPS)' : ''}
                    </Text>
                    <Text style={[styles.sessionMeta, { color: colors.textSecondary }]}>
                      Dernière activité: {formatDate(session.lastActivityAt)}
                      {session.ipAddress ? ` • IP: ${session.ipAddress}` : ''}
                    </Text>
                  </View>
                  {!session.current && (
                    <TouchableOpacity onPress={() => revokeSession(session.deviceId)} style={styles.revokeButton}>
                      <Ionicons name="log-out-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
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

      {/* Modal step-up OTP : création initiale de mdp seulement. */}
      <Modal
        visible={otpModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setOtpModalOpen(false)}
      >
        <View style={styles.otpOverlay}>
          <View style={[styles.otpSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.otpHeader}>
              <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
              <Text style={[styles.otpTitle, { color: colors.text }]}>
                Confirmer la création
              </Text>
              <TouchableOpacity onPress={() => setOtpModalOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.otpDescription, { color: colors.textSecondary }]}>
              Un code à 6 chiffres a été envoyé par SMS à {user?.telephone || 'votre numéro'}.
              Cette étape protège votre compte contre les accès non autorisés.
            </Text>

            <TextInput
              style={[
                styles.otpInput,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
              ]}
              placeholder="123456"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              maxLength={6}
              value={otpInput}
              onChangeText={(t) => setOtpInput(t.replace(/\D/g, ''))}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.updateButton, { backgroundColor: colors.primary }]}
              onPress={submitCreationWithOtp}
              disabled={loading || otpInput.length !== 6}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.updateButtonText}>Créer le mot de passe</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={resendSetupOtp} disabled={otpSending} style={styles.otpResend}>
              <Text style={[styles.otpResendText, { color: colors.primary }]}>
                {otpSending ? 'Envoi…' : 'Renvoyer le code'}
              </Text>
            </TouchableOpacity>
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
  // === Détail des composants du score ===
  scoreComponents: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(127,127,127,0.18)',
    gap: 10,
  },
  scoreComponent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scoreComponentText: {
    flex: 1,
    minWidth: 0,
  },
  scoreComponentLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  scoreComponentHint: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  scoreComponentWeight: {
    fontSize: 11,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'right',
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
  passwordHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
    marginTop: -2,
  },
  forgotPwdLink: {
    alignSelf: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  forgotPwdText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // === Séparateur "ou" entre les 2 chemins (modifier / réinitialiser) ===
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    marginBottom: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // === Bouton secondaire "Réinitialiser via SMS" ===
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryHint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  // === Modal step-up OTP (création mdp) ===
  otpOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  otpSheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  otpTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  otpDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  otpInput: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 22,
    letterSpacing: 8,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  otpResend: {
    alignSelf: 'center',
    paddingVertical: 10,
    marginTop: 6,
  },
  otpResendText: {
    fontSize: 13,
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
    flex: 1,
    minWidth: 0,
  },
  securityItemText: {
    flex: 1,
    minWidth: 0,
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
  // === Toggle custom (remplace <Switch> natif) ===
  // Track 44×24 + thumb 20×20 → identique au toggle web, bornes prévisibles.
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    marginLeft: 8,
    flexShrink: 0,
    overflow: 'hidden',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    // Petite ombre pour relief
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
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
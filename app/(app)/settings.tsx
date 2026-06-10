// app/(app)/settings.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../src/contexts/ThemeContext';
import GradientHeader from '../../src/components/GradientHeader';
import { useAuth } from '../../src/contexts/AuthContext';
import { userPreferencesService, accountService, resolveAssetUrl } from '../../src/services/api';
// Biométrie : gérée désormais dans /security uniquement (un seul point de vérité).
import { useLocale, Currency } from '../../src/contexts/LocaleContext';
import type { Language } from '../../src/i18n/translations';

interface SettingSection {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: SettingItem[];
}

interface SettingItem {
  id: string;
  label: string;
  description?: string;
  type: 'toggle' | 'select' | 'action';
  value?: boolean;
  action?: () => void;
  rightValue?: string;
}

interface Preferences {
  notifEmail: boolean;
  notifPush: boolean;
  notifSms: boolean;
  notifPromotions: boolean;
  showBalance: boolean;
  twoFactor: boolean;
  biometric: boolean;
  language: string; // fr | en | mg
  currency: string; // Ar | EUR | USD
  theme: string; // light | dark | system
}

const DEFAULT_PREFS: Preferences = {
  notifEmail: true,
  notifPush: true,
  notifSms: false,
  notifPromotions: false,
  showBalance: true,
  twoFactor: false,
  biometric: false,
  language: 'fr',
  currency: 'Ar',
  theme: 'system',
};

export default function Settings() {
  const router = useRouter();
  const { colors, isDark, setMode } = useTheme();
  const { user } = useAuth();
  const { language, currency, setLanguage, setCurrency, t } = useLocale();

  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [loadingPrefs, setLoadingPrefs] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await userPreferencesService.get();
        setPrefs({ ...DEFAULT_PREFS, ...data });
        // Sync thème côté ThemeContext si différent
        if (data?.theme && ['light', 'dark', 'system'].includes(data.theme)) {
          setMode(data.theme);
        }
      } catch (e: any) {
        console.warn(
          'Préférences indisponibles, valeurs par défaut.',
          e?.response?.data?.message,
        );
      } finally {
        setLoadingPrefs(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sauvegarde optimiste + rollback en cas d'erreur
  const savePref = async (patch: Partial<Preferences>) => {
    const prev = prefs;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      const saved = await userPreferencesService.update(patch);
      setPrefs({ ...DEFAULT_PREFS, ...saved });
    } catch (e: any) {
      setPrefs(prev); // rollback
      Alert.alert(
        'Erreur',
        e?.response?.data?.message || 'Impossible de sauvegarder la préférence',
      );
    }
  };

  const toggleNotification = (key: 'notifEmail' | 'notifPush' | 'notifSms' | 'notifPromotions') => {
    savePref({ [key]: !prefs[key] } as Partial<Preferences>);
  };

  // Note : le toggle biométrique a été déplacé vers la page Sécurité.
  // Settings ne gère plus que les prefs simples (boolean toggle direct).
  const togglePrivacy = async (key: 'showBalance' | 'twoFactor') => {
    savePref({ [key]: !prefs[key] } as Partial<Preferences>);
  };

  const handleThemeChange = () => {
    Alert.alert(
      'Thème',
      'Choisissez votre thème préféré',
      [
        { text: 'Clair', onPress: () => { setMode('light'); savePref({ theme: 'light' }); } },
        { text: 'Sombre', onPress: () => { setMode('dark'); savePref({ theme: 'dark' }); } },
        { text: 'Système', onPress: () => { setMode('system'); savePref({ theme: 'system' }); } },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const handleLanguageChange = () => {
    Alert.alert(
      t('settings.language'),
      'Choisissez votre langue',
      [
        { text: 'Français', onPress: async () => { await setLanguage('fr'); savePref({ language: 'fr' }); } },
        { text: 'English', onPress: async () => { await setLanguage('en'); savePref({ language: 'en' }); } },
        { text: 'Malagasy', onPress: async () => { await setLanguage('mg'); savePref({ language: 'mg' }); } },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  const handleCurrencyChange = () => {
    Alert.alert(
      t('settings.currency'),
      'Choisissez votre devise par défaut',
      [
        { text: 'Ariary (Ar)', onPress: async () => { await setCurrency('Ar'); savePref({ currency: 'Ar' }); } },
        { text: 'Euro (€)', onPress: async () => { await setCurrency('EUR' as Currency); savePref({ currency: 'EUR' }); } },
        { text: 'Dollar ($)', onPress: async () => { await setCurrency('USD' as Currency); savePref({ currency: 'USD' }); } },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  const languageLabel = ({ fr: 'Français', en: 'English', mg: 'Malagasy' } as Record<string, string>)[language] || 'Français';
  const currencyLabel = ({ Ar: 'Ar', EUR: '€', USD: '$' } as Record<string, string>)[currency] || 'Ar';

  // === Export RGPD des données ===
  // Le JSON est récupéré depuis /user/export-data, écrit dans un fichier local
  // (cacheDirectory pour éviter de polluer le stockage permanent), puis partagé
  // via la feuille de partage natif (mail, AirDrop, Drive, etc.). En cas
  // d'absence de partage natif (rare), on garde le fichier accessible et on
  // affiche son chemin pour fallback.
  const [exporting, setExporting] = useState(false);

  const performExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await accountService.exportData();
      const json = JSON.stringify(data, null, 2);
      const filename = `mpaye-export-${new Date().toISOString().slice(0, 10)}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Exporter mes données M\'Paye',
          UTI: 'public.json',
        });
      } else {
        Alert.alert(
          'Export prêt',
          `Fichier sauvegardé : ${fileUri}\n(Partage natif indisponible sur cet appareil)`,
        );
      }
    } catch (e: any) {
      Alert.alert(
        'Erreur',
        e?.response?.data?.message || "Impossible d'exporter vos données",
      );
    } finally {
      setExporting(false);
    }
  };

  const handleExportData = () => {
    Alert.alert(
      'Exporter mes données',
      "Vous allez recevoir un fichier JSON contenant l'ensemble de vos données : profil, wallet, transactions, bénéficiaires, sessions, notifications. Aucun mot de passe ni token n'est inclus.",
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Exporter', onPress: () => { void performExport(); } },
      ],
    );
  };

  // NOTE — Suppression de compte volontairement absente.
  // L'ancienne implémentation faisait juste un logout() sous le label "Supprimer"
  // sans toucher au backend : trompeur pour l'user et juridiquement bancal (RGPD).
  //
  // La vraie suppression en fintech exige : pre-checks bloquants (solde > 0,
  // transactions PENDING, disputes actives), step-up OTP, période de grâce 30j,
  // job batch d'anonymisation (les transactions doivent rester pour AML/audit
  // pendant 5-10 ans selon régulation CSBF). À implémenter quand l'effort
  // (~4-5j backend + front) sera planifié. Pour l'instant l'user peut nous
  // contacter via le support pour faire valoir son droit à l'oubli.

  const settingsSections: SettingSection[] = [
    {
      title: t('settings.preferences'),
      icon: 'options-outline',
      items: [
        { id: 'theme', label: t('settings.theme'), description: 'Clair, sombre ou système', type: 'select', rightValue: isDark ? 'Sombre' : 'Clair', action: handleThemeChange },
        { id: 'language', label: t('settings.language'), description: languageLabel, type: 'select', rightValue: languageLabel, action: handleLanguageChange },
        { id: 'currency', label: t('settings.currency'), description: currency, type: 'select', rightValue: currencyLabel, action: handleCurrencyChange },
      ],
    },
    {
      title: t('settings.notifications'),
      icon: 'notifications-outline',
      items: [
        { id: 'notifEmail', label: 'Notifications email', description: 'Recevoir les alertes par email', type: 'toggle', value: prefs.notifEmail, action: () => toggleNotification('notifEmail') },
        { id: 'notifPush', label: 'Notifications push', description: 'Alertes en temps réel', type: 'toggle', value: prefs.notifPush, action: () => toggleNotification('notifPush') },
        { id: 'notifSms', label: 'SMS', description: 'Notifications par SMS', type: 'toggle', value: prefs.notifSms, action: () => toggleNotification('notifSms') },
        { id: 'notifPromotions', label: 'Offres promotionnelles', description: 'Recevoir les offres spéciales', type: 'toggle', value: prefs.notifPromotions, action: () => toggleNotification('notifPromotions') },
      ],
    },
    {
      title: t('settings.privacy'),
      icon: 'lock-closed-outline',
      items: [
        { id: 'showBalance', label: 'Afficher le solde', description: 'Montrer le solde sur l\'écran d\'accueil', type: 'toggle', value: prefs.showBalance, action: () => togglePrivacy('showBalance') },
        { id: 'twoFactor', label: 'Double authentification', description: 'Sécuriser votre compte', type: 'toggle', value: prefs.twoFactor, action: () => togglePrivacy('twoFactor') },
        // Toggle biométrique déplacé vers la page Sécurité — seul endroit qui gère
        // hardware-check + prompt + sauvegarde + refresh du BiometricGuard.
      ],
    },
    {
      title: t('settings.data'),
      icon: 'folder-outline',
      items: [
        {
          id: 'export',
          label: exporting ? 'Export en cours…' : 'Exporter mes données',
          description: 'JSON complet : profil, transactions, bénéficiaires',
          type: 'action',
          action: handleExportData,
        },
        // 'Supprimer mon compte' retiré — voir note au-dessus de settingsSections.
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Personnalisez votre expérience
        </Text>

        {loadingPrefs && (
          <View style={{ paddingVertical: 12, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

        {/* Profile Section */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/complete-profile' as any)}
        >
          <View style={styles.profileLeft}>
            {user?.avatarUrl ? (
              <Image
                source={{ uri: resolveAssetUrl(user.avatarUrl) }}
                style={styles.profileAvatar}
              />
            ) : (
              <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.profileAvatarText}>
                  {user?.prenom?.[0] || user?.email?.[0] || 'U'}
                </Text>
              </View>
            )}
            <View>
              <Text style={[styles.profileName, { color: colors.text }]}>
                {user?.prenom ? `${user.prenom} ${user.nom || ''}` : user?.email?.split('@')[0] || 'Utilisateur'}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Settings Sections */}
        {settingsSections.map((section, index) => (
          <View key={index} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon} size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
            </View>
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.settingItem,
                    itemIndex !== section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                  onPress={item.action}
                  disabled={item.type === 'toggle'}
                  activeOpacity={item.type === 'toggle' ? 1 : 0.7}
                >
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>{item.label}</Text>
                    {item.description && (
                      <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>{item.description}</Text>
                    )}
                  </View>
                  {item.type === 'toggle' ? (
                    <Switch
                      value={item.value}
                      onValueChange={item.action}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor="#fff"
                    />
                  ) : (
                    <View style={styles.settingRight}>
                      {item.rightValue && (
                        <Text style={[styles.settingRightValue, { color: colors.textSecondary }]}>{item.rightValue}</Text>
                      )}
                      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Version */}
        <Text style={[styles.versionText, { color: colors.textSecondary }]}>MyWallet v1.0.0</Text>
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
  },
  profileEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 11,
    marginTop: 2,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingRightValue: {
    fontSize: 13,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    marginTop: 24,
  },
});
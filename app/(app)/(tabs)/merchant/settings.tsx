// app/(app)/(tabs)/merchant/settings.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../../src/contexts/ThemeContext';

interface NotificationSettings {
  sales: boolean;
  refunds: boolean;
  promotions: boolean;
  newsletter: boolean;
  sms: boolean;
}

export default function MerchantSettings() {
  const { colors, isDark, toggleTheme } = useTheme();
  
  const [notifications, setNotifications] = useState<NotificationSettings>({
    sales: true,
    refunds: true,
    promotions: false,
    newsletter: true,
    sms: false,
  });
  
  const [language, setLanguage] = useState('fr');
  const [currency, setCurrency] = useState('MGA');
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const languages = [
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'mg', name: 'Malagasy', flag: '🇲🇬' },
  ];

  const currencies = [
    { code: 'MGA', name: 'Ariary Malgache', symbol: 'Ar' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'USD', name: 'Dollar US', symbol: '$' },
  ];

  const handleChangePassword = async () => {
    if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    if (passwordData.new !== passwordData.confirm) {
      Alert.alert('Erreur', 'Les nouveaux mots de passe ne correspondent pas');
      return;
    }
    if (passwordData.new.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      Alert.alert('Succès', 'Mot de passe modifié avec succès');
      setShowPasswordModal(false);
      setPasswordData({ current: '', new: '', confirm: '' });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier le mot de passe');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      Alert.alert('Succès', 'Compte supprimé avec succès');
      router.replace('/(auth)/login');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de supprimer le compte');
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  const SettingItem = ({ icon, title, onPress, rightElement }: any) => (
    <TouchableOpacity
      style={[styles.settingItem, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}20` }]}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {rightElement || <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
    </TouchableOpacity>
  );

  const NotificationItem = ({ title, value, onValueChange }: any) => (
    <View style={[styles.notificationItem, { borderBottomColor: colors.border }]}>
      <Text style={[styles.notificationTitle, { color: colors.text }]}>{title}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#767577', true: colors.primary }}
        thumbColor={value ? '#fff' : '#f4f3f4'}
      />
    </View>
  );

  const LanguageModal = () => (
    <Modal
      visible={showLanguageModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowLanguageModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Choisir la langue</Text>
            <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          {languages.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.modalItem, { borderBottomColor: colors.border }]}
              onPress={() => {
                setLanguage(lang.code);
                setShowLanguageModal(false);
              }}
            >
              <Text style={styles.modalItemFlag}>{lang.flag}</Text>
              <Text style={[styles.modalItemText, { color: colors.text }]}>{lang.name}</Text>
              {language === lang.code && (
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );

  const CurrencyModal = () => (
    <Modal
      visible={showCurrencyModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowCurrencyModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Choisir la devise</Text>
            <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          {currencies.map((curr) => (
            <TouchableOpacity
              key={curr.code}
              style={[styles.modalItem, { borderBottomColor: colors.border }]}
              onPress={() => {
                setCurrency(curr.code);
                setShowCurrencyModal(false);
              }}
            >
              <Text style={[styles.modalItemText, { color: colors.text }]}>{curr.name}</Text>
              <Text style={[styles.modalItemSub, { color: colors.textSecondary }]}>{curr.symbol}</Text>
              {currency === curr.code && (
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );

  const PasswordModal = () => (
    <Modal
      visible={showPasswordModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowPasswordModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Changer le mot de passe</Text>
            <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.passwordForm}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Mot de passe actuel</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                secureTextEntry
                value={passwordData.current}
                onChangeText={(text) => setPasswordData({ ...passwordData, current: text })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Nouveau mot de passe</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                secureTextEntry
                value={passwordData.new}
                onChangeText={(text) => setPasswordData({ ...passwordData, new: text })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Confirmer le mot de passe</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                secureTextEntry
                value={passwordData.confirm}
                onChangeText={(text) => setPasswordData({ ...passwordData, confirm: text })}
              />
            </View>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={handleChangePassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>Modifier</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const DeleteModal = () => (
    <Modal
      visible={showDeleteModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowDeleteModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.error }]}>Supprimer le compte</Text>
            <TouchableOpacity onPress={() => setShowDeleteModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.deleteContent}>
            <Ionicons name="alert-circle-outline" size={60} color={colors.error} />
            <Text style={[styles.deleteTitle, { color: colors.text }]}>Êtes-vous sûr ?</Text>
            <Text style={[styles.deleteText, { color: colors.textSecondary }]}>
              Cette action est irréversible. Toutes vos données seront supprimées définitivement.
            </Text>

            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: colors.error }]}
              onPress={handleDeleteAccount}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.deleteButtonText}>Supprimer définitivement</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelDeleteButton, { borderColor: colors.border }]}
              onPress={() => setShowDeleteModal(false)}
            >
              <Text style={[styles.cancelDeleteText, { color: colors.text }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Paramètres</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Section Apparence */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Apparence</Text>
        <SettingItem
          icon="moon-outline"
          title="Mode sombre"
          onPress={toggleTheme}
          rightElement={
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={isDark ? '#fff' : '#f4f3f4'}
            />
          }
        />
      </View>

      {/* Section Notifications */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Notifications</Text>
        <NotificationItem
          title="Nouvelles ventes"
          value={notifications.sales}
          onValueChange={(val: boolean) => setNotifications({ ...notifications, sales: val })}
        />
        <NotificationItem
          title="Remboursements"
          value={notifications.refunds}
          onValueChange={(val: boolean) => setNotifications({ ...notifications, refunds: val })}
        />
        <NotificationItem
          title="Promotions"
          value={notifications.promotions}
          onValueChange={(val: boolean) => setNotifications({ ...notifications, promotions: val })}
        />
        <NotificationItem
          title="Newsletter"
          value={notifications.newsletter}
          onValueChange={(val: boolean) => setNotifications({ ...notifications, newsletter: val })}
        />
        <NotificationItem
          title="Notifications SMS"
          value={notifications.sms}
          onValueChange={(val: boolean) => setNotifications({ ...notifications, sms: val })}
        />
      </View>

      {/* Section Préférences */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Préférences</Text>
        <SettingItem
          icon="language-outline"
          title="Langue"
          onPress={() => setShowLanguageModal(true)}
          rightElement={
            <View style={styles.rightValue}>
              <Text style={[styles.rightValueText, { color: colors.textSecondary }]}>
                {languages.find(l => l.code === language)?.name}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </View>
          }
        />
        <SettingItem
          icon="cash-outline"
          title="Devise"
          onPress={() => setShowCurrencyModal(true)}
          rightElement={
            <View style={styles.rightValue}>
              <Text style={[styles.rightValueText, { color: colors.textSecondary }]}>
                {currencies.find(c => c.code === currency)?.name}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </View>
          }
        />
      </View>

      {/* Section Sécurité */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Sécurité</Text>
        <SettingItem
          icon="lock-closed-outline"
          title="Changer le mot de passe"
          onPress={() => setShowPasswordModal(true)}
        />
        <SettingItem
          icon="shield-checkmark-outline"
          title="Authentification à deux facteurs"
          onPress={() => Alert.alert('Info', 'Fonctionnalité à venir')}
        />
        <SettingItem
          icon="finger-print-outline"
          title="Biométrie"
          onPress={() => Alert.alert('Info', 'Fonctionnalité à venir')}
        />
      </View>

      {/* Section Données */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Données</Text>
        <SettingItem
          icon="download-outline"
          title="Exporter mes données"
          onPress={() => Alert.alert('Info', 'Fonctionnalité à venir')}
        />
        <SettingItem
          icon="trash-outline"
          title="Supprimer mon compte"
          onPress={() => setShowDeleteModal(true)}
        />
      </View>

      {/* Section À propos */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>À propos</Text>
        <SettingItem
          icon="information-circle-outline"
          title="Version"
          onPress={() => {}}
          rightElement={
            <Text style={[styles.versionText, { color: colors.textSecondary }]}>1.0.0</Text>
          }
        />
        <SettingItem
          icon="document-text-outline"
          title="Conditions d'utilisation"
          onPress={() => Alert.alert('Info', 'Conditions d\'utilisation')}
        />
        <SettingItem
          icon="shield-outline"
          title="Politique de confidentialité"
          onPress={() => Alert.alert('Info', 'Politique de confidentialité')}
        />
        <SettingItem
          icon="help-circle-outline"
          title="Centre d'aide"
          onPress={() => router.push('./help')}
        />
      </View>

      <LanguageModal />
      <CurrencyModal />
      <PasswordModal />
      <DeleteModal />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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

  section: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginBottom: 8,
  },

  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: { fontSize: 15, fontWeight: '500' },
  rightValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rightValueText: { fontSize: 14 },

  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  notificationTitle: { fontSize: 14 },

  versionText: { fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  modalItemFlag: { fontSize: 24 },
  modalItemText: { flex: 1, fontSize: 16 },
  modalItemSub: { fontSize: 13, marginRight: 12 },
  
  passwordForm: { gap: 16 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 14, fontWeight: '500' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  modalButton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  deleteContent: { alignItems: 'center', gap: 16, paddingVertical: 20 },
  deleteTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 8 },
  deleteText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  deleteButton: { width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelDeleteButton: { width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, marginTop: 8 },
  cancelDeleteText: { fontSize: 16, fontWeight: '500' },
});
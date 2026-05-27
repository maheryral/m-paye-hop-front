// app/(app)/(tabs)/merchant/notifications.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Switch,
  Modal,
  ScrollView,  // Ajoutez ScrollView
  ActivityIndicator,  // Ajoutez ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../../src/contexts/ThemeContext';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'sale' | 'refund' | 'info' | 'warning' | 'success' | 'promotions';
  isRead: boolean;
  createdAt: string;
  data?: any;
}

interface NotificationSettings {
  sales: boolean;
  refunds: boolean;
  promotions: boolean;
  system: boolean;
  email: boolean;
  sms: boolean;
}

export default function MerchantNotifications() {
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    sales: true,
    refunds: true,
    promotions: false,
    system: true,
    email: true,
    sms: false,
  });

  // Données mockées
  const mockNotifications: Notification[] = [
    {
      id: '1',
      title: 'Nouvelle vente !',
      message: 'Vous avez reçu un paiement de 25 000 Ar de Jean Rakoto',
      type: 'sale',
      isRead: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes
    },
    {
      id: '2',
      title: 'Vente confirmée',
      message: 'Paiement de 15 000 Ar reçu de Marie Rabe',
      type: 'sale',
      isRead: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes
    },
    {
      id: '3',
      title: 'Demande de remboursement',
      message: 'Un client demande un remboursement de 10 000 Ar',
      type: 'refund',
      isRead: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 heures
    },
    {
      id: '4',
      title: 'Remboursement traité',
      message: 'Le remboursement de 5 000 Ar a été effectué',
      type: 'refund',
      isRead: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 heures
    },
    {
      id: '5',
      title: 'Nouvelle promotion',
      message: 'Découvrez notre nouvelle campagne marketing',
      type: 'promotions',
      isRead: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 jour
    },
    {
      id: '6',
      title: 'Mise à jour système',
      message: 'L\'application a été mise à jour avec de nouvelles fonctionnalités',
      type: 'info',
      isRead: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 jours
    },
    {
      id: '7',
      title: 'Alerte sécurité',
      message: 'Une nouvelle connexion a été détectée sur votre compte',
      type: 'warning',
      isRead: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 jours
    },
    {
      id: '8',
      title: 'Félicitations !',
      message: 'Vous avez atteint 100 ventes sur votre boutique',
      type: 'success',
      isRead: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(), // 4 jours
    },
  ];

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      setNotifications(mockNotifications);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays === 1) return 'Hier';
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sale': return 'cart-outline';
      case 'refund': return 'refresh-outline';
      case 'promotions': return 'pricetag-outline';
      case 'warning': return 'alert-circle-outline';
      case 'success': return 'checkmark-circle-outline';
      default: return 'information-circle-outline';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'sale': return '#3b82f6';
      case 'refund': return '#f59e0b';
      case 'promotions': return '#8b5cf6';
      case 'warning': return '#ef4444';
      case 'success': return '#3b82f6';
      default: return '#64748b';
    }
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );
  };

  const markAllAsRead = async () => {
    Alert.alert(
      'Marquer tout comme lu',
      'Voulez-vous marquer toutes les notifications comme lues ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () => {
            setNotifications(prev =>
              prev.map(notif => ({ ...notif, isRead: true }))
            );
          },
        },
      ]
    );
  };

  const deleteNotification = (id: string) => {
    Alert.alert(
      'Supprimer',
      'Voulez-vous supprimer cette notification ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            setNotifications(prev => prev.filter(notif => notif.id !== id));
          },
        },
      ]
    );
  };

  const clearAllNotifications = () => {
    Alert.alert(
      'Tout supprimer',
      'Voulez-vous supprimer toutes les notifications ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            setNotifications([]);
          },
        },
      ]
    );
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        { backgroundColor: colors.card, borderColor: colors.border },
        !item.isRead && { backgroundColor: `${getTypeColor(item.type)}08`, borderLeftColor: getTypeColor(item.type), borderLeftWidth: 3 }
      ]}
      onPress={() => markAsRead(item.id)}
      onLongPress={() => deleteNotification(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationIconContainer}>
        <View style={[styles.notificationIcon, { backgroundColor: `${getTypeColor(item.type)}20` }]}>
          <Ionicons name={getTypeIcon(item.type)} size={22} color={getTypeColor(item.type)} />
        </View>
        {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: getTypeColor(item.type) }]} />}
      </View>

      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={[styles.notificationTitle, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.notificationTime, { color: colors.textSecondary }]}>{formatDate(item.createdAt)}</Text>
        </View>
        <Text style={[styles.notificationMessage, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.message}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const SettingsModal = () => (
    <Modal
      visible={showSettings}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowSettings(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Préférences</Text>
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.settingsSection}>
              <Text style={[styles.settingsSectionTitle, { color: colors.textSecondary }]}>Notifications push</Text>
              
              <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                <View style={styles.settingInfo}>
                  <Ionicons name="cart-outline" size={20} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Ventes</Text>
                </View>
                <Switch
                  value={settings.sales}
                  onValueChange={(val) => setSettings({ ...settings, sales: val })}
                  trackColor={{ false: '#767577', true: colors.primary }}
                  thumbColor={settings.sales ? '#fff' : '#f4f3f4'}
                />
              </View>

              <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                <View style={styles.settingInfo}>
                  <Ionicons name="refresh-outline" size={20} color={colors.warning} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Remboursements</Text>
                </View>
                <Switch
                  value={settings.refunds}
                  onValueChange={(val) => setSettings({ ...settings, refunds: val })}
                  trackColor={{ false: '#767577', true: colors.primary }}
                  thumbColor={settings.refunds ? '#fff' : '#f4f3f4'}
                />
              </View>

              <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                <View style={styles.settingInfo}>
                  <Ionicons name="pricetag-outline" size={20} color={colors.info} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Promotions</Text>
                </View>
                <Switch
                  value={settings.promotions}
                  onValueChange={(val) => setSettings({ ...settings, promotions: val })}
                  trackColor={{ false: '#767577', true: colors.primary }}
                  thumbColor={settings.promotions ? '#fff' : '#f4f3f4'}
                />
              </View>

              <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                <View style={styles.settingInfo}>
                  <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Système</Text>
                </View>
                <Switch
                  value={settings.system}
                  onValueChange={(val) => setSettings({ ...settings, system: val })}
                  trackColor={{ false: '#767577', true: colors.primary }}
                  thumbColor={settings.system ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={[styles.settingsSectionTitle, { color: colors.textSecondary }]}>Modes de réception</Text>
              
              <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                <View style={styles.settingInfo}>
                  <Ionicons name="mail-outline" size={20} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Notifications par email</Text>
                </View>
                <Switch
                  value={settings.email}
                  onValueChange={(val) => setSettings({ ...settings, email: val })}
                  trackColor={{ false: '#767577', true: colors.primary }}
                  thumbColor={settings.email ? '#fff' : '#f4f3f4'}
                />
              </View>

              <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                <View style={styles.settingInfo}>
                  <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Notifications SMS</Text>
                </View>
                <Switch
                  value={settings.sms}
                  onValueChange={(val) => setSettings({ ...settings, sms: val })}
                  trackColor={{ false: '#767577', true: colors.primary }}
                  thumbColor={settings.sms ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading && notifications.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} style={styles.headerButton}>
              <Ionicons name="checkmark-done-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerButton}>
            <Ionicons name="settings-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      {notifications.length > 0 && (
        <View style={[styles.statsBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{notifications.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{unreadCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Non lues</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity onPress={clearAllNotifications} style={styles.clearButton}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={[styles.clearText, { color: colors.error }]}>Tout effacer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Liste */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotificationItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={notifications.length === 0 ? styles.emptyList : styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={80} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucune notification</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Vous serez notifié des nouvelles activités
            </Text>
          </View>
        )}
      />

      <SettingsModal />
    </View>
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
  headerActions: { flexDirection: 'row', gap: 12 },
  headerButton: { padding: 4 },

  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 30 },
  clearButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 4 },
  clearText: { fontSize: 12, fontWeight: '500' },

  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  emptyList: { flex: 1 },
  
  notificationItem: {
    flexDirection: 'row',
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  notificationIconContainer: {
    position: 'relative',
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  notificationContent: { flex: 1 },
  notificationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  notificationTitle: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  notificationTime: { fontSize: 11 },
  notificationMessage: { fontSize: 13, lineHeight: 18 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: 18, fontWeight: '500', marginTop: 20 },
  emptyText: { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  settingsSection: { marginBottom: 24 },
  settingsSectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 12 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabel: { fontSize: 15 },
});
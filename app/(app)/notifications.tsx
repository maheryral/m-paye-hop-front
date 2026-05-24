// app/(app)/notifications.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import GradientHeader from '../../src/components/GradientHeader';
import { notificationService } from '../../src/services/api';
import { useSocket } from '../../src/contexts/SocketContext';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  actionType?: string;
  actionId?: string;
}

export default function Notifications() {
  const router = useRouter();
  const { colors } = useTheme();
  const { onNotification, refreshUnreadCount } = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const PAGE_SIZE = 20;

  useEffect(() => {
    loadNotifications(true);
  }, []);

  // 🔌 Temps réel : préfixe la nouvelle notification en tête de liste
  useEffect(() => {
    const unsubscribe = onNotification((n) => {
      setNotifications((prev) => {
        if (prev.some((x) => x.id === n.id)) return prev;
        return [n as any, ...prev];
      });
      setTotal((t) => t + 1);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNotifications = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      const currentPage = reset ? 1 : page;
      const response = await notificationService.getNotifications(currentPage, PAGE_SIZE);
      
      const notificationsData = response?.notifications || [];
      const totalCount = response?.total || 0;
      
      setTotal(totalCount);
      setHasMore(notificationsData.length === PAGE_SIZE && notifications.length + notificationsData.length < totalCount);
      
      if (reset) {
        setNotifications(notificationsData);
        setPage(2);
      } else {
        setNotifications(prev => [...prev, ...notificationsData]);
        setPage(prev => prev + 1);
      }
    } catch (error: any) {
      console.error(
        'Erreur chargement notifications:',
        error?.response?.data || error?.message,
      );
      if (reset) {
        setNotifications([]);
        setHasMore(false);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications(true);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      loadNotifications(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
      refreshUnreadCount(); // 🔄 met à jour le badge
    } catch (error) {
      console.error('Erreur marquage lu:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      refreshUnreadCount();
    } catch (error) {
      console.error('Erreur marquage tout lu:', error);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'TRANSFER_RECEIVED': return 'arrow-down-circle-outline';
      case 'TRANSFER_SENT': return 'arrow-up-circle-outline';
      case 'DEPOSIT_SUCCESS': return 'checkmark-circle-outline';
      case 'SECURITY_ALERT': return 'shield-outline';
      case 'KYC_REMINDER': return 'person-outline';
      default: return 'notifications-outline';
    }
  };

  const getColorForType = (type: string) => {
    switch (type) {
      case 'TRANSFER_RECEIVED': return '#3b82f6';
      case 'TRANSFER_SENT': return '#3b82f6';
      case 'DEPOSIT_SUCCESS': return '#3b82f6';
      case 'SECURITY_ALERT': return '#ef4444';
      case 'KYC_REMINDER': return '#f59e0b';
      default: return '#64748b';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours} h`;
    if (days === 1) return 'Hier';
    if (days < 7) return `Il y a ${days} jours`;
    return date.toLocaleDateString('fr-FR');
  };

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.actionType === 'TRANSACTION' && notification.actionId) {
      router.push(`/history` as any);
    } else if (notification.actionType === 'KYC') {
      router.push('/complete-profile' as any);
    } else if (notification.actionType === 'SECURITY') {
      router.push('/security' as any);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>Chargement...</Text>
      </View>
    );
  };

  const renderHeader = () => {
    if (notifications.length === 0) return null;
    return (
      <>
        {/* Unread Count Banner */}
        {unreadCount > 0 && (
          <View style={[styles.unreadBanner, { backgroundColor: `${colors.primary}15` }]}>
            <Ionicons name="notifications" size={18} color={colors.primary} />
            <Text style={[styles.unreadBannerText, { color: colors.primary }]}>
              {unreadCount} notification{unreadCount > 1 ? 's' : ''} non lue{unreadCount > 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </>
    );
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        !item.isRead && { backgroundColor: `${colors.primary}10`, borderLeftColor: colors.primary, borderLeftWidth: 3 },
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationIcon}>
        <View style={[styles.iconCircle, { backgroundColor: `${getColorForType(item.type)}20` }]}>
          <Ionicons name={getIconForType(item.type)} size={24} color={getColorForType(item.type)} />
        </View>
      </View>
      <View style={styles.notificationContent}>
        <Text style={[styles.notificationTitle, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.notificationMessage, { color: colors.textSecondary }]}>{item.message}</Text>
        <Text style={[styles.notificationTime, { color: colors.textSecondary }]}>{formatDate(item.createdAt)}</Text>
      </View>
      {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title="Notifications"
        {...(unreadCount > 0
          ? { rightIcon: 'checkmark-done-outline' as any, onRightPress: markAllAsRead }
          : {})}
      />

      {/* Counter */}
      {total > 0 && (
        <View style={styles.counterContainer}>
          <Text style={[styles.counterText, { color: colors.textSecondary }]}>
            {total} notification{total > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Notifications List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          contentContainerStyle={notifications.length === 0 ? styles.emptyList : styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucune notification</Text>
            </View>
          }
        />
      )}
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
  markAllText: {
    fontSize: 13,
    fontWeight: '500',
  },
  counterContainer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  counterText: {
    fontSize: 12,
  },
  unreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  unreadBannerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
  },
  emptyList: {
    flex: 1,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  notificationIcon: {},
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  notificationMessage: {
    fontSize: 13,
  },
  notificationTime: {
    fontSize: 11,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  footerText: {
    fontSize: 12,
  },
});
// app/(app)/messages/index.tsx — Liste des conversations
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useSocket } from '../../../src/contexts/SocketContext';
import GradientHeader from '../../../src/components/GradientHeader';
import BottomTabBar from '../../../src/components/BottomTabBar';
import { messagingApi, Conversation } from '../../../src/services/messagingApi';

export default function MessagesHome() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { onMessage } = useSocket();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await messagingApi.listConversations();
      setItems(res.data);
    } catch (e: any) {
      console.error(e?.response?.data || e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Refresh sur nouveau message
  useEffect(() => {
    const unsub = onMessage(() => load());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openSupport = async () => {
    try {
      const res = await messagingApi.startConversation({ type: 'SUPPORT' });
      router.push(`/messages/${res.data.id}` as any);
    } catch (e: any) {
      Alert.alert(
        'Support indisponible',
        e?.response?.data?.message ||
          'Aucun administrateur n\'est disponible pour le moment.',
      );
    }
  };

  const getOther = (c: Conversation) => {
    if (c.type === 'SUPPORT') return null; // pas un user unique
    return c.participants.find(p => p.userId !== user?.id)?.user;
  };

  const getTitle = (c: Conversation) => {
    if (c.type === 'SUPPORT') return c.title || 'Support M\'Paye';
    const o = getOther(c);
    return o ? `${o.prenom} ${o.nom}`.trim() : 'Conversation';
  };

  const getInitials = (c: Conversation) => {
    if (c.type === 'SUPPORT') return 'SP';
    const o = getOther(c);
    if (!o) return '?';
    return `${o.prenom?.[0] || ''}${o.nom?.[0] || ''}`.toUpperCase();
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const renderItem = ({ item }: { item: Conversation }) => {
    const last = item.messages?.[0];
    const isSupport = item.type === 'SUPPORT';
    const avatarColor = isSupport ? '#3b82f6' : '#1e40af';

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/messages/${item.id}` as any)}
        activeOpacity={0.85}
      >
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          {isSupport ? (
            <Ionicons name="headset" size={22} color="#fff" />
          ) : (
            <Text style={styles.avatarText}>{getInitials(item)}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {getTitle(item)}
            </Text>
            <Text style={[styles.time, { color: colors.textSecondary }]}>
              {formatTime(last?.createdAt || item.lastMessageAt)}
            </Text>
          </View>
          <View style={styles.rowBottom}>
            <Text
              style={[
                styles.message,
                {
                  color: item.unreadCount && item.unreadCount > 0
                    ? colors.text
                    : colors.textSecondary,
                  fontWeight: item.unreadCount && item.unreadCount > 0 ? '700' : '400',
                },
              ]}
              numberOfLines={1}
            >
              {last
                ? `${last.senderId === user?.id ? 'Vous : ' : ''}${last.content}`
                : 'Aucun message'}
            </Text>
            {item.unreadCount && item.unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader title="Messages" subtitle="Vos conversations" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e40af" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={56} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Aucune conversation
              </Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                Démarrez en contactant le support
              </Text>
            </View>
          }
        />
      )}

      {/* FAB Support */}
      <TouchableOpacity style={styles.fab} onPress={openSupport} activeOpacity={0.85}>
        <Ionicons name="headset" size={22} color="#fff" />
        <Text style={styles.fabText}>Support</Text>
      </TouchableOpacity>

      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  time: { fontSize: 11 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  message: { fontSize: 13, flex: 1, marginRight: 8 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyHint: { fontSize: 13 },

  fab: {
    position: 'absolute',
    right: 16,
    bottom: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1e40af',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

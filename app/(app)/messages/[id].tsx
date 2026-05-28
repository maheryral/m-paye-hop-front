// app/(app)/messages/[id].tsx — Écran chat
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useSocket } from '../../../src/contexts/SocketContext';
import {
  messagingApi,
  ChatMessage,
  Conversation,
} from '../../../src/services/messagingApi';

const BLUE_GRADIENT: [string, string] = ['#0f172a', '#1e40af'];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { onMessage, onSupportClosed } = useSocket();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [cRes, mRes] = await Promise.all([
        messagingApi.getConversation(id),
        messagingApi.listMessages(id),
      ]);
      setConversation(cRes.data);
      setMessages(mRes.data);
      // Marque comme lu
      messagingApi.markRead(id).catch(() => {});
    } catch (e: any) {
      console.error(e?.response?.data || e?.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Push temps réel
  useEffect(() => {
    const unsub = onMessage((e) => {
      if (e.conversationId !== id) return;
      setMessages((prev) => {
        if (prev.some(m => m.id === e.message.id)) return prev;
        return [...prev, e.message as ChatMessage];
      });
      // Marque comme lu instantanément si on a la conversation ouverte
      messagingApi.markRead(id!).catch(() => {});
      // Scroll en bas
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Fermeture par l'agent → recharge la conversation (déclenche la notation)
  useEffect(() => {
    const unsub = onSupportClosed((e) => {
      if (e.conversationId === id) load();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, load]);

  const submitRating = async () => {
    if (!id || ratingValue < 1 || ratingSubmitting) return;
    setRatingSubmitting(true);
    try {
      const res = await messagingApi.rateConversation(
        id,
        ratingValue,
        ratingComment.trim() || undefined,
      );
      setConversation(res.data);
    } catch (e: any) {
      // garde l'UI, l'utilisateur peut réessayer
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !id) return;
    setSending(true);
    setInput('');
    try {
      const res = await messagingApi.sendMessage(id, text);
      setMessages((prev) => [...prev, res.data]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e: any) {
      setInput(text); // restaure
    } finally {
      setSending(false);
    }
  };

  const headerTitle = (() => {
    if (!conversation) return 'Chat';
    if (conversation.type === 'SUPPORT') return 'Support M\'Paye';
    const other = conversation.participants.find(p => p.userId !== user?.id)?.user;
    return other ? `${other.prenom} ${other.nom}`.trim() : 'Conversation';
  })();

  const headerSubtitle = (() => {
    if (!conversation) return undefined;
    if (conversation.type === 'SUPPORT') return 'Équipe support';
    const other = conversation.participants.find(p => p.userId !== user?.id)?.user;
    return other?.email;
  })();

  const renderBubble = ({ item }: { item: ChatMessage }) => {
    const isMine = item.senderId === user?.id;
    const isAdmin = item.sender?.role === 'ADMIN';
    return (
      <View
        style={[
          styles.bubbleRow,
          { justifyContent: isMine ? 'flex-end' : 'flex-start' },
        ]}
      >
        <View
          style={[
            styles.bubble,
            isMine
              ? { backgroundColor: '#1e40af', borderTopRightRadius: 4 }
              : {
                  backgroundColor: isAdmin ? '#3b82f6' : colors.card,
                  borderColor: colors.border,
                  borderWidth: isAdmin ? 0 : 1,
                  borderTopLeftRadius: 4,
                },
          ]}
        >
          {!isMine && (
            <Text
              style={[
                styles.senderName,
                { color: isAdmin ? '#fff' : colors.textSecondary },
              ]}
            >
              {item.sender ? `${item.sender.prenom} ${item.sender.nom}`.trim() : ''}
              {isAdmin && ' • Support'}
            </Text>
          )}
          <Text
            style={[
              styles.content,
              { color: isMine || isAdmin ? '#fff' : colors.text },
            ]}
          >
            {item.content}
          </Text>
          <Text
            style={[
              styles.time,
              { color: isMine || isAdmin ? 'rgba(255,255,255,0.7)' : colors.textSecondary },
            ]}
          >
            {new Date(item.createdAt).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <LinearGradient
        colors={BLUE_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
              {headerSubtitle && (
                <Text style={styles.headerSubtitle} numberOfLines={1}>{headerSubtitle}</Text>
              )}
            </View>
            <View style={styles.iconBtn} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1e40af" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderBubble}
            contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubble-ellipses-outline" size={50} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Aucun message. Dites bonjour !
                </Text>
              </View>
            }
          />
        )}

        {conversation?.status === 'CLOSED' ? (
          conversation.rating != null ? (
            <View style={[styles.ratedBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                Merci ! Vous avez noté{' '}
              </Text>
              <Text style={{ color: '#f59e0b', fontSize: 16 }}>
                {'★'.repeat(conversation.rating)}
                <Text style={{ color: colors.border }}>
                  {'★'.repeat(5 - conversation.rating)}
                </Text>
              </Text>
            </View>
          ) : (
            <View style={[styles.rateBox, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <Text style={[styles.rateTitle, { color: colors.text }]}>
                Conversation terminée — notez votre agent
              </Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => setRatingValue(n)} activeOpacity={0.7}>
                    <Ionicons
                      name={n <= ratingValue ? 'star' : 'star-outline'}
                      size={34}
                      color="#f59e0b"
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.rateComment, { color: colors.text, borderColor: colors.border }]}
                placeholder="Commentaire (optionnel)"
                placeholderTextColor={colors.textSecondary}
                value={ratingComment}
                onChangeText={setRatingComment}
                multiline
                maxLength={300}
              />
              <TouchableOpacity
                style={[styles.rateSubmit, { opacity: ratingValue >= 1 && !ratingSubmitting ? 1 : 0.4 }]}
                onPress={submitRating}
                disabled={ratingValue < 1 || ratingSubmitting}
                activeOpacity={0.85}
              >
                {ratingSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.rateSubmitText}>Envoyer ma note</Text>
                )}
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Votre message..."
              placeholderTextColor={colors.textSecondary}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { opacity: input.trim() && !sending ? 1 : 0.4 }]}
              onPress={handleSend}
              disabled={!input.trim() || sending}
              activeOpacity={0.8}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerGradient: {
    paddingBottom: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  headerSubtitle: { color: '#cbd5e1', fontSize: 11, textAlign: 'center', marginTop: 2 },

  bubbleRow: { flexDirection: 'row', marginVertical: 4 },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  senderName: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  content: { fontSize: 14, lineHeight: 20 },
  time: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 13 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(128,128,128,0.1)',
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
  },

  ratedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderTopWidth: 1,
  },
  rateBox: {
    padding: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  rateTitle: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  rateComment: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    fontSize: 13,
  },
  rateSubmit: {
    backgroundColor: '#1e40af',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rateSubmitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

// src/services/messagingApi.ts
import api from './api';

export interface ChatUser {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: { id: string; prenom: string; nom: string; role: string };
}

export interface ChatParticipant {
  id: string;
  userId: string;
  lastReadAt: string | null;
  user: ChatUser;
}

export interface Conversation {
  id: string;
  type: 'PRIVATE' | 'SUPPORT' | 'GROUP';
  title?: string | null;
  lastMessageAt?: string | null;
  participants: ChatParticipant[];
  messages?: ChatMessage[];
  unreadCount?: number;
}

export const messagingApi = {
  startConversation: (data: { recipientId?: string; type?: 'PRIVATE' | 'SUPPORT' }) =>
    api.post<Conversation>('/messaging/conversations', data),

  listConversations: () => api.get<Conversation[]>('/messaging/conversations'),

  getConversation: (id: string) =>
    api.get<Conversation>(`/messaging/conversations/${id}`),

  listMessages: (id: string, page = 1, limit = 50) =>
    api.get<ChatMessage[]>(`/messaging/conversations/${id}/messages`, {
      params: { page, limit },
    }),

  sendMessage: (id: string, content: string) =>
    api.post<ChatMessage>(`/messaging/conversations/${id}/messages`, {
      content,
    }),

  markRead: (id: string) =>
    api.patch(`/messaging/conversations/${id}/read`),
};

export default messagingApi;

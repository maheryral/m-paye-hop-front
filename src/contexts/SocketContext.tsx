// src/contexts/SocketContext.tsx
// Connexion WebSocket persistante au backend pour notifications temps réel.
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { secureStorage } from '../services/secureStorage';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../config/env';
import { notificationService } from '../services/api';

export interface RealtimeNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority?: string;
  icon?: string;
  color?: string;
  actionType?: string;
  actionId?: string;
  isRead?: boolean;
  createdAt: string;
}

type Listener = (n: RealtimeNotification) => void;
export interface RealtimeMessageEvent {
  conversationId: string;
  message: {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    createdAt: string;
    sender?: { id: string; prenom: string; nom: string; role: string };
  };
}
type MessageListener = (e: RealtimeMessageEvent) => void;

interface SocketContextType {
  connected: boolean;
  unreadCount: number;
  lastNotification: RealtimeNotification | null;
  /** S'abonner aux nouvelles notifications. Retourne une fonction de désabonnement. */
  onNotification: (cb: Listener) => () => void;
  /** S'abonner aux nouveaux messages (toute conversation). */
  onMessage: (cb: MessageListener) => () => void;
  /** S'abonner à la fermeture d'une conversation support. */
  onSupportClosed: (cb: (e: { conversationId: string }) => void) => () => void;
  /** Recharger manuellement le compteur unread (après mark-as-read côté front). */
  refreshUnreadCount: () => Promise<void>;
}

const Ctx = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Set<Listener>>(new Set());
  const msgListenersRef = useRef<Set<MessageListener>>(new Set());
  const closedListenersRef = useRef<
    Set<(e: { conversationId: string }) => void>
  >(new Set());
  const [connected, setConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastNotification, setLastNotification] =
    useState<RealtimeNotification | null>(null);

  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      if (!user) return;
      const token = await secureStorage.getItem('accessToken');
      if (!token || cancelled) return;

      const socket = io(`${API_BASE_URL}/notifications`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: Infinity,
      });

      socket.on('connect', () => {
        setConnected(true);
        // 🔢 Seed du compteur unread via REST (la WS suivra)
        notificationService
          .getUnreadCount()
          .then((res: any) => {
            const c = typeof res === 'number' ? res : res?.count ?? 0;
            setUnreadCount(c);
          })
          .catch(() => {});
      });
      socket.on('disconnect', () => setConnected(false));
      socket.on('connect_error', (err) => {
        // Souvent: token expiré ou backend offline
        console.warn('Socket connect_error:', err.message);
      });

      socket.on('notification:new', (n: RealtimeNotification) => {
        setLastNotification(n);
        listenersRef.current.forEach((cb) => cb(n));
      });

      socket.on(
        'notification:unread-count',
        ({ count }: { count: number }) => {
          setUnreadCount(count);
        },
      );

      socket.on('message:new', (e: RealtimeMessageEvent) => {
        msgListenersRef.current.forEach((cb) => cb(e));
      });

      socket.on('support:closed', (e: { conversationId: string }) => {
        closedListenersRef.current.forEach((cb) => cb(e));
      });

      socketRef.current = socket;
    };

    connect();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
    };
  }, [user]);

  const onNotification = (cb: Listener) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  };

  const onMessage = (cb: MessageListener) => {
    msgListenersRef.current.add(cb);
    return () => {
      msgListenersRef.current.delete(cb);
    };
  };

  const onSupportClosed = (cb: (e: { conversationId: string }) => void) => {
    closedListenersRef.current.add(cb);
    return () => {
      closedListenersRef.current.delete(cb);
    };
  };

  const refreshUnreadCount = async () => {
    try {
      const res: any = await notificationService.getUnreadCount();
      const c = typeof res === 'number' ? res : res?.count ?? 0;
      setUnreadCount(c);
    } catch {}
  };

  return (
    <Ctx.Provider
      value={{ connected, unreadCount, lastNotification, onNotification, onMessage, onSupportClosed, refreshUnreadCount }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSocket doit être utilisé dans SocketProvider');
  return ctx;
};

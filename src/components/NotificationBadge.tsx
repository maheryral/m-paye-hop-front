// src/components/NotificationBadge.tsx
// Petit badge rouge avec le compteur unread sur un icône notification.
// À placer en position absolute par-dessus l'icône parente.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSocket } from '../contexts/SocketContext';

interface Props {
  /** Position du badge (par défaut: top-right) */
  size?: number;
  /** Couleur du badge (par défaut: rouge) */
  color?: string;
  /** Couleur du texte (par défaut: blanc) */
  textColor?: string;
  /** Bordure (pour contraste sur fond coloré) */
  borderColor?: string;
}

export default function NotificationBadge({
  size = 18,
  color = '#ef4444',
  textColor = '#fff',
  borderColor,
}: Props) {
  const { unreadCount } = useSocket();

  if (!unreadCount || unreadCount <= 0) return null;

  // > 10 → afficher "10+"
  const label = unreadCount > 10 ? '10+' : String(unreadCount);
  // Largeur dynamique pour s'adapter à "10+" (3 chars)
  const minWidth = label.length >= 2 ? size + 8 : size;

  return (
    <View
      style={[
        styles.badge,
        {
          minWidth,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          ...(borderColor && { borderWidth: 1.5, borderColor }),
        },
      ]}
    >
      <Text style={[styles.text, { color: textColor, fontSize: size * 0.6 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 10,
  },
  text: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

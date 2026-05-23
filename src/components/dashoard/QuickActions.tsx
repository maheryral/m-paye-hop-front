// src/components/dashboard/QuickActions.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';

const actions = [
  { id: 'transfer', icon: 'send-outline', label: 'Envoyer', route: '/transfers', color: '#3b82f6' },
  { id: 'qr', icon: 'qr-code-outline', label: 'Scanner', route: '/qr-payment', color: '#8b5cf6' },
  { id: 'beneficiary', icon: 'people-outline', label: 'Bénéf.', route: '/beneficiaries', color: '#3b82f6' },
  { id: 'history', icon: 'time-outline', label: 'Historique', route: '/history', color: '#f59e0b' },
];

const QuickActions: React.FC = () => {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View>
      <Text style={[styles.title, { color: colors.text }]}>Actions rapides</Text>
      <View style={styles.actionsGrid}>
        {actions.map((action) => (
          <TouchableOpacity key={action.id} style={styles.actionItem} onPress={() => router.push(action.route as any)}>
            <View style={[styles.iconContainer, { backgroundColor: `${action.color}20` }]}>
              <Ionicons name={action.icon as any} size={24} color={action.color} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionItem: {
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 12,
  },
});

export default QuickActions;
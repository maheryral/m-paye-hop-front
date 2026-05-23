// src/components/dashboard/BalanceCard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

interface BalanceCardProps {
  balance: number;
  balanceVisible: boolean;
  setBalanceVisible: (visible: boolean) => void;
}

const BalanceCard: React.FC<BalanceCardProps> = ({ balance, balanceVisible, setBalanceVisible }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.primary }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>Solde disponible</Text>
        <TouchableOpacity onPress={() => setBalanceVisible(!balanceVisible)}>
          <Ionicons name={balanceVisible ? 'eye-outline' : 'eye-off-outline'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      <Text style={styles.balance}>
        {balanceVisible ? `${balance.toLocaleString()} Ar` : '••••••••'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  balance: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
});

export default BalanceCard;
// src/components/merchant/MerchantStatCard.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/contexts/ThemeContext';

const { width } = Dimensions.get('window');

export interface StatCardProps {
  title: string;
  value: number | string;
  icon: string;
  color?: string;
  change?: {
    value: number;
    isPositive: boolean;
  };
  onPress?: () => void;
  loading?: boolean;
  suffix?: string;
  prefix?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'outline';
}

export default function MerchantStatCard({
  title,
  value,
  icon,
  color,
  change,
  onPress,
  loading = false,
  suffix = '',
  prefix = '',
  size = 'medium',
  variant = 'default',
}: StatCardProps) {
  const { colors } = useTheme();
  
  const cardColor = color || colors.primary;

  const getCardWidth = () => {
    switch (size) {
      case 'small':
        return (width - 48) / 2 - 6;
      case 'large':
        return width - 32;
      default:
        return (width - 48) / 2 - 6;
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'small':
        return 12;
      case 'large':
        return 20;
      default:
        return 16;
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 24;
      case 'large':
        return 36;
      default:
        return 28;
    }
  };

  const getValueFontSize = () => {
    switch (size) {
      case 'small':
        return 18;
      case 'large':
        return 28;
      default:
        return 22;
    }
  };

  const formatValue = () => {
    if (typeof value === 'number') {
      if (value >= 1000000000) {
        return `${prefix}${(value / 1000000000).toFixed(1)}B${suffix}`;
      }
      if (value >= 1000000) {
        return `${prefix}${(value / 1000000).toFixed(1)}M${suffix}`;
      }
      if (value >= 1000) {
        return `${prefix}${(value / 1000).toFixed(1)}k${suffix}`;
      }
      return `${prefix}${value.toLocaleString('fr-FR')}${suffix}`;
    }
    return value;
  };

  const renderChangeIndicator = () => {
    if (!change) return null;
    
    const changeColor = change.isPositive ? '#52C41A' : '#FF4D4F';
    const changeIcon = change.isPositive ? 'arrow-up-outline' : 'arrow-down-outline';
    const changeText = `${change.isPositive ? '+' : ''}${change.value}%`;
    
    return (
      <View style={styles.changeContainer}>
        <Ionicons name={changeIcon as any} size={12} color={changeColor} />
        <Text style={[styles.changeText, { color: changeColor }]}>{changeText}</Text>
      </View>
    );
  };

  const renderContent = () => {
    const content = (
      <>
        <View style={styles.headerRow}>
          <View style={[styles.iconContainer, { backgroundColor: `${cardColor}15` }]}>
            <Ionicons name={icon as any} size={getIconSize()} color={cardColor} />
          </View>
          {renderChangeIndicator()}
        </View>
        
        <Text style={[styles.value, { color: colors.text, fontSize: getValueFontSize() }]}>
          {loading ? '---' : formatValue()}
        </Text>
        
        <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
      </>
    );

    if (onPress) {
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ width: '100%' }}>
          {content}
        </TouchableOpacity>
      );
    }
    
    return content;
  };

  const cardStyle = {
    width: getCardWidth(),
    padding: getPadding(),
    borderRadius: 16,
  };

  if (variant === 'outline') {
    return (
      <View style={[
        styles.outlineCard,
        cardStyle,
        { borderColor: cardColor, backgroundColor: `${cardColor}05` }
      ]}>
        {renderContent()}
      </View>
    );
  }

  return (
    <View style={[
      styles.defaultCard,
      cardStyle,
      { backgroundColor: colors.card, borderColor: colors.border }
    ]}>
      {renderContent()}
    </View>
  );
}

// Composant pour une grille de statistiques
export const MerchantStatGrid: React.FC<{
  stats: StatCardProps[];
  columns?: 2 | 3 | 4;
  variant?: 'default' | 'outline';
}> = ({ stats, columns = 2, variant = 'default' }) => {
  const getColumnsFlexBasis = () => {
    switch (columns) {
      case 3:
        return '30%';
      case 4:
        return '23%';
      default:
        return '47%';
    }
  };

  return (
    <View style={styles.gridContainer}>
      {stats.map((stat, index) => (
        <View key={index} style={{ width: getColumnsFlexBasis(), marginHorizontal: '1.5%' }}>
          <MerchantStatCard {...stat} variant={variant} />
        </View>
      ))}
    </View>
  );
};

// Composant pour une carte de solde (spéciale)
export const MerchantBalanceCard: React.FC<{
  balance: number;
  pendingBalance?: number;
  totalReceived?: number;
  onWithdraw?: () => void;
  onDetails?: () => void;
  loading?: boolean;
}> = ({ balance, pendingBalance = 0, totalReceived = 0, onWithdraw, onDetails, loading = false }) => {
  const { colors } = useTheme();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-MG', {
      style: 'currency',
      currency: 'MGA',
    }).format(amount);
  };

  return (
    <View style={[styles.balanceCard, { backgroundColor: colors.success }]}>
      <Text style={styles.balanceLabel}>Solde disponible</Text>
      <Text style={styles.balanceValue}>
        {loading ? '---' : formatCurrency(balance)}
      </Text>
      
      <View style={styles.balanceDetails}>
        <View style={styles.balanceDetailItem}>
          <Text style={styles.balanceDetailLabel}>En attente</Text>
          <Text style={styles.balanceDetailValue}>
            {loading ? '---' : formatCurrency(pendingBalance)}
          </Text>
        </View>
        <View style={[styles.balanceDetailDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
        <View style={styles.balanceDetailItem}>
          <Text style={styles.balanceDetailLabel}>Total reçu</Text>
          <Text style={styles.balanceDetailValue}>
            {loading ? '---' : formatCurrency(totalReceived)}
          </Text>
        </View>
      </View>

      <View style={styles.balanceActions}>
        {onWithdraw && (
          <TouchableOpacity 
            style={[styles.balanceActionBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} 
            onPress={onWithdraw}
          >
            <Ionicons name="arrow-down-outline" size={18} color="#fff" />
            <Text style={styles.balanceActionText}>Retirer</Text>
          </TouchableOpacity>
        )}
        {onDetails && (
          <TouchableOpacity 
            style={[styles.balanceActionBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} 
            onPress={onDetails}
          >
            <Ionicons name="eye-outline" size={18} color="#fff" />
            <Text style={styles.balanceActionText}>Détails</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Default variant
  defaultCard: {
    borderWidth: 1,
    marginBottom: 12,
    marginHorizontal: 4,
  },
  // Outline variant
  outlineCard: {
    borderWidth: 2,
    marginBottom: 12,
    marginHorizontal: 4,
  },
  // Common styles
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 2,
  },
  changeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  value: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  title: {
    fontSize: 12,
  },
  // Grid styles
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 8,
  },
  // Balance card styles
  balanceCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    marginHorizontal: 16,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  balanceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  balanceDetailItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceDetailLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  balanceDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  balanceDetailDivider: {
    width: 1,
    height: 30,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: 12,
  },
  balanceActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
  },
  balanceActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
// src/components/merchant/RevenueChart.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/contexts/ThemeContext';

const { width } = Dimensions.get('window');

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface RevenueChartProps {
  data: ChartDataPoint[] | any;
  type?: 'line' | 'bar';
  title?: string;
  height?: number;
  color?: string;
  loading?: boolean;
  onPeriodChange?: (period: string) => void;
  selectedPeriod?: string;
  periods?: string[];
  formatValue?: (value: number) => string;
  showLegend?: boolean;
}

export default function RevenueChart({
  data,
  type = 'line',
  title,
  height = 220,
  color,
  loading = false,
  onPeriodChange,
  selectedPeriod = 'week',
  periods = ['jour', 'semaine', 'mois'],
  formatValue,
  showLegend = true,
}: RevenueChartProps) {
  const { colors } = useTheme();
  const chartColor = color || colors.primary;

  const defaultFormatValue = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toString();
  };

  const formatter = formatValue || defaultFormatValue;

  // Transformer les données pour le graphique
  const getChartData = () => {
    if (Array.isArray(data)) {
      return {
        labels: data.map(d => d.label),
        datasets: [{
          data: data.map(d => d.value),
          color: (opacity = 1) => chartColor,
          strokeWidth: 2,
        }],
      };
    }
    // Si data est déjà au format chart
    return {
      labels: data.labels || [],
      datasets: data.datasets || [{ data: [] }],
    };
  };

  const chartData = getChartData();

  const chartConfig = {
    backgroundColor: colors.card,
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => chartColor,
    labelColor: (opacity = 1) => colors.textSecondary,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: chartColor,
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: colors.border,
    },
    formatYLabel: (value: string) => {
      const num = parseInt(value);
      return formatter(num);
    },
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.card }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Chargement...
        </Text>
      </View>
    );
  }

  if (!chartData.labels || chartData.labels.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.card }]}>
        <Ionicons name="bar-chart-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Aucune donnée disponible
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* En-tête */}
      <View style={styles.header}>
        {title && <Text style={[styles.title, { color: colors.text }]}>{title}</Text>}
        {onPeriodChange && periods && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.periodButtons}>
              {periods.map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodButton,
                    selectedPeriod === period && { backgroundColor: chartColor },
                  ]}
                  onPress={() => onPeriodChange(period)}
                >
                  <Text
                    style={[
                      styles.periodText,
                      { color: selectedPeriod === period ? '#fff' : colors.textSecondary },
                    ]}
                  >
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Graphique */}
      {type === 'line' && (
        <LineChart
          data={chartData}
          width={width - 48}
          height={height}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          formatYLabel={(value) => formatter(parseInt(value))}
        />
      )}

      {type === 'bar' && (
        <BarChart
          data={chartData}
          width={width - 48}
          height={height}
          chartConfig={chartConfig}
          style={styles.chart}
          yAxisLabel=""
          yAxisSuffix=""
          fromZero
        />
      )}

      {/* Légende */}
      {showLegend && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: chartColor }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>
              {title || 'Ventes'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  periodButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  periodText: {
    fontSize: 12,
    fontWeight: '500',
  },
  chart: {
    borderRadius: 16,
    marginVertical: 8,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
  },
  loadingContainer: {
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
});
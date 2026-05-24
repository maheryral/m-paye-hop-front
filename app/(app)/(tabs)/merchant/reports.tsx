// app/(app)/(tabs)/merchant/reports.tsx
// 📊 Rapports comptables : CSV export + récapitulatif TVA (données réelles)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { useLocale } from '../../../../src/contexts/LocaleContext';
import GradientHeader from '../../../../src/components/GradientHeader';
import { merchantApi } from '../../../../src/services/merchantApi';

interface TaxSummary {
  year: number;
  month: number;
  vatNumber: string | null;
  defaultRate: number;
  totalTTC: number;
  totalHT: number;
  vatCollected: number;
  transactionCount: number;
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export default function MerchantReports() {
  const { colors } = useTheme();
  const { formatCurrency } = useLocale();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [tax, setTax] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await merchantApi.taxSummary(year, month);
      setTax(res.data);
    } catch (e: any) {
      console.error('Erreur tax summary:', e?.response?.data || e?.message);
      setTax(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCSV = async () => {
    setDownloading(true);
    try {
      const res = await merchantApi.exportCSV(year, month);
      const { content, filename, count } = res.data;
      if (!count) {
        Alert.alert('Aucune transaction', 'Pas de transactions à exporter pour ce mois.');
        return;
      }

      if (Platform.OS === 'web') {
        await Share.share({ message: content, title: filename });
      } else {
        const uri = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(uri, content, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        const available = await Sharing.isAvailableAsync();
        if (available) {
          await Sharing.shareAsync(uri, {
            mimeType: 'text/csv',
            dialogTitle: 'Exporter rapport CSV',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          await Share.share({ message: content, title: filename });
        }
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Export impossible');
    } finally {
      setDownloading(false);
    }
  };

  const periodLabel = useMemo(() => `${MONTHS_FR[month - 1]} ${year}`, [month, year]);

  const navigateMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title="Rapports comptables"
        subtitle="TVA, export CSV / Excel"
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#1e40af" />
        }
      >
        {/* Sélecteur mois */}
        <View style={[styles.periodSelector, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.periodText, { color: colors.text }]}>{periodLabel}</Text>
            <Text style={[styles.periodSub, { color: colors.textSecondary }]}>
              {isCurrentMonth ? 'En cours' : 'Mois passé'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigateMonth(1)}
            style={[styles.navBtn, isCurrentMonth && { opacity: 0.3 }]}
            disabled={isCurrentMonth}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#1e40af" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* KPI CA TTC */}
            <LinearGradient
              colors={['#0f172a', '#1e40af']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.kpiCard}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="cash" size={20} color="#fff" />
                <Text style={styles.kpiLabel}>Chiffre d'affaires TTC</Text>
              </View>
              <Text style={styles.kpiValue}>{formatCurrency(tax?.totalTTC ?? 0)}</Text>
              <Text style={styles.kpiSub}>
                {tax?.transactionCount ?? 0} transaction{(tax?.transactionCount ?? 0) > 1 ? 's' : ''}
              </Text>
            </LinearGradient>

            {/* HT + TVA */}
            <View style={styles.row2}>
              <View style={[styles.kpiSmall, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.kpiSmallLabel, { color: colors.textSecondary }]}>CA HT</Text>
                <Text style={[styles.kpiSmallValue, { color: colors.text }]}>{formatCurrency(tax?.totalHT ?? 0)}</Text>
              </View>
              <View style={[styles.kpiSmall, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.kpiSmallLabel, { color: colors.textSecondary }]}>TVA collectée</Text>
                <Text style={[styles.kpiSmallValue, { color: '#f59e0b' }]}>
                  {formatCurrency(tax?.vatCollected ?? 0)}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                  taux : {tax?.defaultRate ?? 0}%
                </Text>
              </View>
            </View>

            {tax?.vatNumber && (
              <View style={[styles.infoBox, { borderColor: colors.border }]}>
                <Ionicons name="receipt-outline" size={14} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                  N° fiscal : {tax.vatNumber}
                </Text>
              </View>
            )}

            {tax?.defaultRate === 0 && (
              <View style={[styles.warnBox]}>
                <Ionicons name="warning-outline" size={14} color="#f59e0b" />
                <Text style={{ color: '#f59e0b', fontSize: 11, flex: 1 }}>
                  Taux TVA non configuré. Renseignez-le dans <Text style={{ fontWeight: '700' }}>Mon entreprise</Text> pour calculer la TVA.
                </Text>
              </View>
            )}

            {/* Bouton export CSV */}
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={exportCSV}
              disabled={downloading || !(tax?.transactionCount ?? 0)}
              activeOpacity={0.85}
            >
              {downloading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text style={styles.exportText}>
                    Exporter les transactions ({tax?.transactionCount ?? 0})
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={{ color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 6 }}>
              Format CSV ouvrable dans Excel / Google Sheets / Sage
            </Text>

            {/* Section explication */}
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Que contient l'export ?
              </Text>
              {[
                'Date, référence, type et statut de chaque transaction',
                'Montant, devise, frais prélevés',
                'Compatible logiciels compta (Sage, EBP, Ciel, Excel...)',
              ].map((s, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                  <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{s}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  periodText: { fontSize: 16, fontWeight: '700' },
  periodSub: { fontSize: 11, marginTop: 2 },

  kpiCard: { padding: 18, borderRadius: 16 },
  kpiLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  kpiValue: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 4 },
  kpiSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4 },

  row2: { flexDirection: 'row', gap: 10, marginTop: 12 },
  kpiSmall: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, gap: 4 },
  kpiSmallLabel: { fontSize: 11, fontWeight: '600' },
  kpiSmallValue: { fontSize: 16, fontWeight: '800' },

  infoBox: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  warnBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f59e0b',
    marginTop: 12,
    backgroundColor: '#f59e0b15',
  },

  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1e40af',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 20,
  },
  exportText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  section: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 20,
    gap: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  bulletText: { fontSize: 12, flex: 1, lineHeight: 18 },
});

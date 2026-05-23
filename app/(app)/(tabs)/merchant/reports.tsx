// app/(app)/(tabs)/merchant/reports.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../../src/contexts/ThemeContext';

type ReportType = 'sales' | 'transactions' | 'products' | 'tax';
type ReportPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';
type ReportFormat = 'pdf' | 'excel' | 'csv';

interface Report {
  id: string;
  name: string;
  type: ReportType;
  period: string;
  dateRange: string;
  generatedAt: string;
  size: string;
}

export default function MerchantReports() {
  const { colors } = useTheme();
  
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedType, setSelectedType] = useState<ReportType>('sales');
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('week');
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>('pdf');
  const [generating, setGenerating] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Données mockées
  const mockReports: Report[] = [
    {
      id: '1',
      name: 'Rapport des ventes',
      type: 'sales',
      period: 'Mars 2024',
      dateRange: '01/03/2024 - 31/03/2024',
      generatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      size: '2.3 MB',
    },
    {
      id: '2',
      name: 'Rapport des transactions',
      type: 'transactions',
      period: 'Semaine 12',
      dateRange: '18/03/2024 - 24/03/2024',
      generatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      size: '1.8 MB',
    },
    {
      id: '3',
      name: 'Rapport fiscal',
      type: 'tax',
      period: '1er Trimestre 2024',
      dateRange: '01/01/2024 - 31/03/2024',
      generatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      size: '3.1 MB',
    },
  ];

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      setReports(mockReports);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getReportTypeLabel = (type: ReportType) => {
    switch (type) {
      case 'sales': return 'Ventes';
      case 'transactions': return 'Transactions';
      case 'products': return 'Produits';
      case 'tax': return 'Fiscal';
    }
  };

  const getReportTypeIcon = (type: ReportType) => {
    switch (type) {
      case 'sales': return 'trending-up-outline';
      case 'transactions': return 'receipt-outline';
      case 'products': return 'cube-outline';
      case 'tax': return 'document-text-outline';
    }
  };

  const getReportColor = (type: ReportType) => {
    switch (type) {
      case 'sales': return '#3b82f6';
      case 'transactions': return '#3b82f6';
      case 'products': return '#f59e0b';
      case 'tax': return '#8b5cf6';
    }
  };

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'today': return "Aujourd'hui";
      case 'week': return 'Cette semaine';
      case 'month': return 'Ce mois';
      case 'year': return 'Cette année';
      case 'custom': return 'Personnalisé';
    }
  };

  const handleGenerateReport = async () => {
    if (selectedPeriod === 'custom' && (!customStartDate || !customEndDate)) {
      Alert.alert('Erreur', 'Veuillez sélectionner les dates');
      return;
    }

    setGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newReport: Report = {
        id: Date.now().toString(),
        name: `Rapport ${getReportTypeLabel(selectedType)}`,
        type: selectedType,
        period: getPeriodLabel(),
        dateRange: selectedPeriod === 'custom' ? `${customStartDate} - ${customEndDate}` : getPeriodLabel(),
        generatedAt: new Date().toISOString(),
        size: `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 9) + 1} MB`,
      };
      
      setReports([newReport, ...reports]);
      setShowGenerateModal(false);
      Alert.alert('Succès', 'Rapport généré avec succès');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de générer le rapport');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadReport = async (report: Report) => {
    Alert.alert(
      'Téléchargement',
      `Voulez-vous télécharger "${report.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Télécharger',
          onPress: async () => {
            try {
              await new Promise(resolve => setTimeout(resolve, 1500));
              Alert.alert('Succès', 'Rapport téléchargé');
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de télécharger');
            }
          },
        },
      ]
    );
  };

  const handleShareReport = async (report: Report) => {
    try {
      await Share.share({
        message: `Rapport ${report.name} généré le ${formatDate(report.generatedAt)}`,
      });
    } catch (error) {
      console.error('Erreur de partage:', error);
    }
  };

  const handleDeleteReport = (report: Report) => {
    Alert.alert(
      'Supprimer le rapport',
      `Voulez-vous supprimer "${report.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await new Promise(resolve => setTimeout(resolve, 500));
              setReports(reports.filter(r => r.id !== report.id));
              Alert.alert('Succès', 'Rapport supprimé');
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer');
            }
          },
        },
      ]
    );
  };

  const GenerateModal = () => (
    <Modal
      visible={showGenerateModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowGenerateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Générer un rapport</Text>
            <TouchableOpacity onPress={() => setShowGenerateModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Type de rapport */}
            <Text style={[styles.modalLabel, { color: colors.text }]}>Type de rapport</Text>
            <View style={styles.typeGrid}>
              <TouchableOpacity
                style={[
                  styles.typeCard,
                  { borderColor: colors.border },
                  selectedType === 'sales' && { borderColor: '#3b82f6', backgroundColor: '#3b82f610' }
                ]}
                onPress={() => setSelectedType('sales')}
              >
                <Ionicons name="trending-up-outline" size={24} color={selectedType === 'sales' ? '#3b82f6' : colors.textSecondary} />
                <Text style={[styles.typeText, { color: selectedType === 'sales' ? '#3b82f6' : colors.text }]}>Ventes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeCard,
                  { borderColor: colors.border },
                  selectedType === 'transactions' && { borderColor: '#3b82f6', backgroundColor: '#3b82f610' }
                ]}
                onPress={() => setSelectedType('transactions')}
              >
                <Ionicons name="receipt-outline" size={24} color={selectedType === 'transactions' ? '#3b82f6' : colors.textSecondary} />
                <Text style={[styles.typeText, { color: selectedType === 'transactions' ? '#3b82f6' : colors.text }]}>Transactions</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeCard,
                  { borderColor: colors.border },
                  selectedType === 'products' && { borderColor: '#f59e0b', backgroundColor: '#f59e0b10' }
                ]}
                onPress={() => setSelectedType('products')}
              >
                <Ionicons name="cube-outline" size={24} color={selectedType === 'products' ? '#f59e0b' : colors.textSecondary} />
                <Text style={[styles.typeText, { color: selectedType === 'products' ? '#f59e0b' : colors.text }]}>Produits</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeCard,
                  { borderColor: colors.border },
                  selectedType === 'tax' && { borderColor: '#8b5cf6', backgroundColor: '#8b5cf610' }
                ]}
                onPress={() => setSelectedType('tax')}
              >
                <Ionicons name="document-text-outline" size={24} color={selectedType === 'tax' ? '#8b5cf6' : colors.textSecondary} />
                <Text style={[styles.typeText, { color: selectedType === 'tax' ? '#8b5cf6' : colors.text }]}>Fiscal</Text>
              </TouchableOpacity>
            </View>

            {/* Période */}
            <Text style={[styles.modalLabel, { color: colors.text }]}>Période</Text>
            <View style={styles.periodGrid}>
              <TouchableOpacity
                style={[styles.periodChip, selectedPeriod === 'today' && { backgroundColor: colors.primary }]}
                onPress={() => setSelectedPeriod('today')}
              >
                <Text style={[styles.periodChipText, selectedPeriod === 'today' && { color: '#fff' }]}>Aujourd'hui</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodChip, selectedPeriod === 'week' && { backgroundColor: colors.primary }]}
                onPress={() => setSelectedPeriod('week')}
              >
                <Text style={[styles.periodChipText, selectedPeriod === 'week' && { color: '#fff' }]}>Cette semaine</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodChip, selectedPeriod === 'month' && { backgroundColor: colors.primary }]}
                onPress={() => setSelectedPeriod('month')}
              >
                <Text style={[styles.periodChipText, selectedPeriod === 'month' && { color: '#fff' }]}>Ce mois</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodChip, selectedPeriod === 'year' && { backgroundColor: colors.primary }]}
                onPress={() => setSelectedPeriod('year')}
              >
                <Text style={[styles.periodChipText, selectedPeriod === 'year' && { color: '#fff' }]}>Cette année</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodChip, selectedPeriod === 'custom' && { backgroundColor: colors.primary }]}
                onPress={() => setSelectedPeriod('custom')}
              >
                <Text style={[styles.periodChipText, selectedPeriod === 'custom' && { color: '#fff' }]}>Personnalisé</Text>
              </TouchableOpacity>
            </View>

            {/* Dates personnalisées */}
            {selectedPeriod === 'custom' && (
              <View style={styles.customDates}>
                <TouchableOpacity style={[styles.dateButton, { borderColor: colors.border }]}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                  <Text style={[styles.dateButtonText, { color: colors.textSecondary }]}>
                    {customStartDate || 'Date de début'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dateButton, { borderColor: colors.border }]}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                  <Text style={[styles.dateButtonText, { color: colors.textSecondary }]}>
                    {customEndDate || 'Date de fin'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Format */}
            <Text style={[styles.modalLabel, { color: colors.text }]}>Format</Text>
            <View style={styles.formatGrid}>
              <TouchableOpacity
                style={[styles.formatChip, selectedFormat === 'pdf' && { backgroundColor: colors.primary }]}
                onPress={() => setSelectedFormat('pdf')}
              >
                <Ionicons name="document-text-outline" size={16} color={selectedFormat === 'pdf' ? '#fff' : colors.textSecondary} />
                <Text style={[styles.formatChipText, selectedFormat === 'pdf' && { color: '#fff' }]}>PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formatChip, selectedFormat === 'excel' && { backgroundColor: colors.primary }]}
                onPress={() => setSelectedFormat('excel')}
              >
                <Ionicons name="grid-outline" size={16} color={selectedFormat === 'excel' ? '#fff' : colors.textSecondary} />
                <Text style={[styles.formatChipText, selectedFormat === 'excel' && { color: '#fff' }]}>Excel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formatChip, selectedFormat === 'csv' && { backgroundColor: colors.primary }]}
                onPress={() => setSelectedFormat('csv')}
              >
                <Ionicons name="code-outline" size={16} color={selectedFormat === 'csv' ? '#fff' : colors.textSecondary} />
                <Text style={[styles.formatChipText, selectedFormat === 'csv' && { color: '#fff' }]}>CSV</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.generateButton, { backgroundColor: colors.primary }]}
              onPress={handleGenerateReport}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text style={styles.generateButtonText}>Générer le rapport</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Rapports</Text>
        <TouchableOpacity onPress={() => setShowGenerateModal(true)} style={styles.addButton}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={[styles.statsBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statItem}>
          <Ionicons name="document-text-outline" size={20} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.text }]}>{reports.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rapports</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Ionicons name="trending-up-outline" size={20} color={colors.success} />
          <Text style={[styles.statValue, { color: colors.text }]}>12</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Téléchargés</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Ionicons name="calendar-outline" size={20} color={colors.warning} />
          <Text style={[styles.statValue, { color: colors.text }]}>30j</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Conservation</Text>
        </View>
      </View>

      {/* Liste des rapports */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {reports.length > 0 ? (
          reports.map((report) => (
            <View
              key={report.id}
              style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.reportHeader}>
                <View style={[styles.reportIcon, { backgroundColor: `${getReportColor(report.type)}20` }]}>
                  <Ionicons name={getReportTypeIcon(report.type)} size={22} color={getReportColor(report.type)} />
                </View>
                <View style={styles.reportInfo}>
                  <Text style={[styles.reportName, { color: colors.text }]}>{report.name}</Text>
                  <Text style={[styles.reportDate, { color: colors.textSecondary }]}>
                    {report.dateRange} • {report.size}
                  </Text>
                </View>
                <View style={[styles.reportBadge, { backgroundColor: `${getReportColor(report.type)}20` }]}>
                  <Text style={[styles.reportBadgeText, { color: getReportColor(report.type) }]}>
                    {getReportTypeLabel(report.type)}
                  </Text>
                </View>
              </View>

              <View style={[styles.reportFooter, { borderTopColor: colors.border }]}>
                <Text style={[styles.generatedText, { color: colors.textSecondary }]}>
                  Généré le {formatDate(report.generatedAt)}
                </Text>
                <View style={styles.reportActions}>
                  <TouchableOpacity onPress={() => handleDownloadReport(report)} style={styles.actionButton}>
                    <Ionicons name="download-outline" size={18} color={colors.primary} />
                    <Text style={[styles.actionText, { color: colors.primary }]}>Télécharger</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleShareReport(report)} style={styles.actionButton}>
                    <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.actionText, { color: colors.textSecondary }]}>Partager</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteReport(report)} style={styles.actionButton}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                    <Text style={[styles.actionText, { color: colors.error }]}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={60} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucun rapport</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Générez votre premier rapport
            </Text>
          </View>
        )}
      </ScrollView>

      <GenerateModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  addButton: { padding: 8 },

  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  statItem: { alignItems: 'center', flex: 1, gap: 6 },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 11 },
  statDivider: { width: 1, height: 30 },

  reportCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  reportIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  reportInfo: { flex: 1 },
  reportName: { fontSize: 15, fontWeight: '600' },
  reportDate: { fontSize: 11, marginTop: 2 },
  reportBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  reportBadgeText: { fontSize: 11, fontWeight: '500' },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  generatedText: { fontSize: 10 },
  reportActions: { flexDirection: 'row', gap: 16 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 12, fontWeight: '500' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalLabel: { fontSize: 14, fontWeight: '600', marginBottom: 12, marginTop: 16 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  typeCard: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  typeText: { fontSize: 13, fontWeight: '500' },

  periodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  periodChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0F0F0' },
  periodChipText: { fontSize: 13, fontWeight: '500' },

  formatGrid: { flexDirection: 'row', gap: 12 },
  formatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    gap: 6,
  },
  formatChipText: { fontSize: 13, fontWeight: '500' },

  customDates: { gap: 12 },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  dateButtonText: { flex: 1, fontSize: 14 },

  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 24,
    marginBottom: 16,
  },
  generateButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { fontSize: 18, fontWeight: '500', marginTop: 16 },
  emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
});
// app/(app)/(tabs)/merchant/transaction/[id].tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import GradientHeader from '../../../../../src/components/GradientHeader';
import { useTheme } from '../../../../../src/contexts/ThemeContext';
import { merchantApi, Transaction } from '../../../../../src/services/merchantApi';
import { SkeletonLoader } from '../../../../../src/components/merchant/LoadingSpinner';
import { EmptyState } from '../../../../../src/components/merchant/EmptyState';

export default function TransactionDetail() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refunding, setRefunding] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    fetchTransaction();
  }, [id]);

  const fetchTransaction = async () => {
    try {
      const response = await merchantApi.getTransactionDetails(id);
      setTransaction(response.data);
    } catch (error) {
      console.error('Error fetching transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = () => {
    Alert.alert(
      'Remboursement',
      `Voulez-vous rembourser ${formatCurrency(transaction?.amount || 0)} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Rembourser',
          style: 'destructive',
          onPress: async () => {
            setRefunding(true);
            try {
              await merchantApi.createRefund(id, transaction!.amount, 'Remboursement demandé par le client');
              Alert.alert('Succès', 'Remboursement effectué');
              fetchTransaction();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de rembourser');
            } finally {
              setRefunding(false);
            }
          },
        },
      ]
    );
  };

  const handleShareReceipt = async () => {
    try {
      await Share.share({
        title: 'Reçu de paiement',
        message: `Paiement de ${formatCurrency(transaction?.amount || 0)} effectué le ${new Date(transaction?.createdAt || '').toLocaleDateString('fr-FR')}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /** Construit le HTML du reçu de vente (rendu en PDF par expo-print). */
  const buildReceiptHtml = (tx: Transaction) => {
    const cfg = getStatusConfig(tx.status);
    const row = (label: string, value: string, mono = false) => `
      <tr>
        <td class="lbl">${label}</td>
        <td class="val"${mono ? ' style="font-family:monospace"' : ''}>${value}</td>
      </tr>`;
    const rows = [
      row('Montant', `<b>${escapeHtml(formatCurrency(tx.amount))}</b>`),
      row('Statut', cfg.text),
      row('Date', formatDate(tx.createdAt)),
      row('Moyen de paiement', escapeHtml(paymentMethodLabel(tx.paymentMethod))),
      tx.customerName ? row('Client', escapeHtml(tx.customerName)) : '',
      tx.customerPhone ? row('Téléphone', escapeHtml(tx.customerPhone)) : '',
      tx.customerEmail ? row('Email', escapeHtml(tx.customerEmail)) : '',
      (tx.title || tx.motif) ? row('Motif', escapeHtml(tx.title || tx.motif || '')) : '',
      tx.description ? row('Description', escapeHtml(tx.description)) : '',
      tx.storeName ? row('Boutique', escapeHtml(tx.storeName)) : '',
      row('Référence', escapeHtml(tx.transactionId), true),
    ].join('');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, 'Segoe UI', sans-serif; color: #0f172a; padding: 32px; }
  .header { display:flex; align-items:center; justify-content:space-between; border-bottom: 3px solid #2563eb; padding-bottom: 16px; }
  .brand { font-size: 26px; font-weight: 800; color: #2563eb; }
  .brand span { color:#1e3a8a; }
  .doc { text-align:right; color:#64748b; font-size:12px; }
  h1 { font-size: 18px; margin: 28px 0 4px; }
  .sub { color:#64748b; font-size:12px; margin-bottom:18px; }
  .amount { text-align:center; margin: 24px 0; }
  .amount .big { font-size: 34px; font-weight: 800; color:#16a34a; }
  table { width:100%; border-collapse: collapse; margin-top: 8px; }
  td { padding: 11px 4px; border-bottom: 1px solid #e2e8f0; font-size: 13px; vertical-align: top; }
  td.lbl { color:#64748b; width: 40%; }
  td.val { text-align:right; font-weight:600; }
  .footer { margin-top: 32px; text-align:center; color:#94a3b8; font-size: 11px; line-height:1.6; }
  .stamp { display:inline-block; margin-top:14px; padding:6px 14px; border:1.5px solid ${cfg.color}; color:${cfg.color}; border-radius:8px; font-weight:700; font-size:12px; }
</style></head>
<body>
  <div class="header">
    <div class="brand">M'<span>Paye</span></div>
    <div class="doc">REÇU DE VENTE<br/>${new Date(tx.createdAt).toLocaleDateString('fr-FR')}</div>
  </div>
  <h1>Vente — ${cfg.text}</h1>
  <div class="sub">Référence : ${escapeHtml(tx.transactionId)}</div>
  <div class="amount"><div class="big">${escapeHtml(formatCurrency(tx.amount))}</div></div>
  <table>${rows}</table>
  <div class="footer">
    <div class="stamp">✓ ${cfg.text}</div>
    <p>Ce reçu est généré automatiquement par M'Paye et ne nécessite pas de signature.<br/>
    Conservez-le comme justificatif de la vente.</p>
  </div>
</body></html>`;
  };

  /** Génère le PDF du reçu et ouvre la feuille de partage / enregistrement. */
  const downloadReceipt = async () => {
    if (!transaction) return;
    try {
      setGeneratingPdf(true);
      const { uri } = await Print.printToFileAsync({ html: buildReceiptHtml(transaction) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Reçu ${transaction.transactionId}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Reçu généré', `PDF enregistré :\n${uri}`);
      }
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de générer le reçu PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-MG', { style: 'currency', currency: 'MGA' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const paymentMethodLabel = (m?: string) => {
    switch (m) {
      case 'mpaye': return 'M\'Paye';
      case 'card': return 'Carte bancaire';
      case 'cash': return 'Espèces';
      case 'bank': return 'Virement bancaire';
      case 'alipay': return 'Alipay';
      case 'wechat': return 'WeChat Pay';
      default: return m || '—';
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed': return { text: 'Réussi', color: '#52C41A', icon: 'checkmark-circle' };
      case 'pending': return { text: 'En attente', color: '#FAAD14', icon: 'time-outline' };
      case 'failed': return { text: 'Échoué', color: '#FF4D4F', icon: 'close-circle' };
      case 'refunded': return { text: 'Remboursé', color: '#999', icon: 'refresh-circle' };
      default: return { text: status, color: '#666', icon: 'help-circle' };
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SkeletonLoader type="card" count={3} />
      </View>
    );
  }

  if (!transaction) {
    return <EmptyState title="Transaction non trouvée" message="Cette transaction n'existe pas" icon="alert-circle-outline" />;
  }

  const statusConfig = getStatusConfig(transaction.status);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Détail vente" />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      {/* Status Header */}
      <View style={[styles.statusHeader, { backgroundColor: statusConfig.color + '10' }]}>
        <Ionicons name={statusConfig.icon as any} size={48} color={statusConfig.color} />
        <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.text}</Text>
        <Text style={[styles.transactionId, { color: colors.textSecondary }]}>ID: {transaction.transactionId}</Text>
      </View>

      {/* Montant */}
      <View style={[styles.amountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Montant</Text>
        <Text style={[styles.amountValue, { color: colors.text }]}>{formatCurrency(transaction.amount)}</Text>
        {!!(transaction.title || transaction.motif) && (
          <Text style={[styles.amountMotif, { color: colors.textSecondary }]} numberOfLines={2}>
            {transaction.title || transaction.motif}
          </Text>
        )}
      </View>

      {/* Description (lien de paiement / QR) */}
      {!!transaction.description && transaction.description !== (transaction.title || transaction.motif) && (
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Description</Text>
          <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
            {transaction.description}
          </Text>
        </View>
      )}

      {/* Informations client */}
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Client</Text>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.text }]}>{transaction.customerName || 'Client anonyme'}</Text>
        </View>
        {transaction.customerPhone && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>{transaction.customerPhone}</Text>
          </View>
        )}
        {transaction.customerEmail && (
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>{transaction.customerEmail}</Text>
          </View>
        )}
      </View>

      {/* Détails paiement */}
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Détails du paiement</Text>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.text }]}>{formatDate(transaction.createdAt)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="card-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.text }]}>{paymentMethodLabel(transaction.paymentMethod)}</Text>
        </View>
        {!!transaction.motif && (
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>{transaction.motif}</Text>
          </View>
        )}
        {transaction.storeName && (
          <View style={styles.infoRow}>
            <Ionicons name="storefront-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>{transaction.storeName}</Text>
          </View>
        )}
      </View>

      {/* Articles */}
      {transaction.items && transaction.items.length > 0 && (
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Articles</Text>
          {transaction.items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.itemQuantity, { color: colors.textSecondary }]}>x{item.quantity}</Text>
              <Text style={[styles.itemPrice, { color: colors.text }]}>{formatCurrency(item.price * item.quantity)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Téléchargement PDF */}
      <TouchableOpacity
        style={[styles.pdfButton, { backgroundColor: colors.primary }]}
        onPress={downloadReceipt}
        disabled={generatingPdf}
        activeOpacity={0.85}
      >
        {generatingPdf ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="download-outline" size={20} color="#fff" />
        )}
        <Text style={styles.pdfButtonText}>
          {generatingPdf ? 'Génération…' : 'Télécharger le reçu (PDF)'}
        </Text>
      </TouchableOpacity>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary + '15' }]} onPress={handleShareReceipt}>
          <Ionicons name="share-outline" size={20} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>Partager le reçu</Text>
        </TouchableOpacity>

        {transaction.status === 'completed' && (
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#FF4D4F15' }]} onPress={handleRefund} disabled={refunding}>
            {refunding ? <ActivityIndicator size="small" color="#FF4D4F" /> : <Ionicons name="refresh-outline" size={20} color="#FF4D4F" />}
            <Text style={[styles.actionText, { color: '#FF4D4F' }]}>Rembourser</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statusHeader: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  statusText: { fontSize: 18, fontWeight: 'bold' },
  transactionId: { fontSize: 12 },
  amountCard: { margin: 16, padding: 20, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  amountLabel: { fontSize: 14, marginBottom: 8 },
  amountValue: { fontSize: 32, fontWeight: 'bold' },
  amountMotif: { fontSize: 13, marginTop: 8, textAlign: 'center', fontStyle: 'italic' },
  descriptionText: { fontSize: 14, lineHeight: 20 },
  infoCard: { marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { fontSize: 14, flex: 1 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  itemName: { fontSize: 14, flex: 2 },
  itemQuantity: { fontSize: 12, width: 40, textAlign: 'center' },
  itemPrice: { fontSize: 14, fontWeight: '500', width: 80, textAlign: 'right' },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 14,
  },
  pdfButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionsContainer: { flexDirection: 'row', gap: 12, margin: 16, marginBottom: 32 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 },
  actionText: { fontSize: 14, fontWeight: '500' },
});
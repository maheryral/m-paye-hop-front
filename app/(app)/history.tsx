// app/(app)/history.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import GradientHeader from '../../src/components/GradientHeader';
import BottomTabBar from '../../src/components/BottomTabBar';
import { transactionService } from '../../src/services/api';

interface Transaction {
  id: string;
  type: string;
  montant: number;
  statut: string;
  motif: string | null;
  reference: string;
  feeAmount: number;
  totalAmount: number;
  createdAt: string;
  isCredit: boolean;
  method?: 'CARD' | 'MVOLA' | 'AIRTEL' | 'ORANGE' | 'WALLET' | null;
  sender?: { fullName: string; email: string; telephone: string };
  receiver?: { fullName: string; email: string; telephone: string };
}

/** Métadonnées d'affichage du mode de financement (badge). null = wallet (pas de badge). */
function methodMeta(
  m?: string | null,
): { label: string; icon: keyof typeof Ionicons.glyphMap; color: string } | null {
  switch (m) {
    case 'CARD':
      return { label: 'Carte', icon: 'card', color: '#6366f1' };
    case 'MVOLA':
      return { label: 'MVola', icon: 'phone-portrait', color: '#ec4899' };
    case 'AIRTEL':
      return { label: 'Airtel', icon: 'phone-portrait', color: '#ef4444' };
    case 'ORANGE':
      return { label: 'Orange', icon: 'phone-portrait', color: '#f97316' };
    default:
      return null;
  }
}

const PAGE_SIZE = 20;

export default function History() {
  const router = useRouter();
  const { colors } = useTheme();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [generatingReceipt, setGeneratingReceipt] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');
  // Pré-remplit la recherche via query param ?q=... (ex: depuis page Bénéficiaires)
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQuery = Array.isArray(params.q) ? params.q[0] : params.q ?? '';
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const isFetchingRef = React.useRef(false);

  useEffect(() => {
    loadTransactions({ reset: true });
  }, []);

  /**
   * Charge une page de transactions.
   *   - `reset: true`  → reset à la page 1, écrase la liste (mount, refresh, filter)
   *   - `reset: false` → append à la suite (infinite scroll)
   */
  const loadTransactions = async (opts: { reset?: boolean } = {}) => {
    const reset = !!opts.reset;
    // Anti double-fetch (peut arriver avec onEndReached + autres triggers)
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const targetPage = reset ? 1 : page + 1;
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const response = await transactionService.getTransactions({
        page: targetPage,
        limit: PAGE_SIZE,
      });
      const items: Transaction[] = response?.transactions ?? [];
      const pagination = response?.pagination ?? {};
      const total: number = pagination.total ?? items.length;
      const totalPages: number = pagination.totalPages ?? 1;

      setTransactions(prev => (reset ? items : [...prev, ...items]));
      setPage(targetPage);
      setHasMore(targetPage < totalPages);
      setTotalCount(total);
    } catch (error: any) {
      console.error(
        'Erreur chargement transactions:',
        error?.response?.data || error?.message,
      );
      if (reset) setTransactions([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions({ reset: true });
    setRefreshing(false);
  };

  const onEndReached = () => {
    if (loading || loadingMore || !hasMore) return;
    loadTransactions({ reset: false });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Aujourd'hui";
    if (days === 1) return 'Hier';
    if (days < 7) return `Il y a ${days} jours`;
    return date.toLocaleDateString('fr-FR');
  };

  const getTransactionTitle = (tx: Transaction) => {
    if (tx.type === 'DEPOSIT') return 'Dépôt MyWallet';
    if (tx.isCredit && tx.sender?.fullName) return `Reçu de ${tx.sender.fullName}`;
    if (!tx.isCredit && tx.receiver?.fullName) return `Envoyé à ${tx.receiver.fullName}`;
    return tx.motif || 'Transaction';
  };

  const typeLabel = (tx: Transaction) =>
    tx.type === 'DEPOSIT' ? 'Dépôt' : tx.type === 'WITHDRAWAL' ? 'Retrait' : 'Transfert';

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /** Construit le HTML du reçu (rendu en PDF par expo-print). */
  const buildReceiptHtml = (tx: Transaction) => {
    const isCreditLike = tx.isCredit || tx.type === 'DEPOSIT';
    const sign = isCreditLike ? '+' : '-';
    const fmt = (n: number) => `${Number(n || 0).toLocaleString('fr-FR')} Ar`;
    const date = new Date(tx.createdAt).toLocaleString('fr-FR');

    const row = (label: string, value: string, mono = false) => `
      <tr>
        <td class="lbl">${label}</td>
        <td class="val"${mono ? ' style="font-family:monospace"' : ''}>${value}</td>
      </tr>`;

    const rows = [
      row('Type', typeLabel(tx)),
      row('Montant', `<b>${sign}${fmt(tx.montant)}</b>`),
      tx.feeAmount > 0 ? row('Frais', fmt(tx.feeAmount)) : '',
      tx.totalAmount ? row('Total débité', fmt(tx.totalAmount)) : '',
      row('Statut', tx.statut),
      row('Date', date),
      tx.motif ? row('Motif', escapeHtml(tx.motif)) : '',
      row('Référence', tx.reference, true),
      tx.sender
        ? row('Expéditeur', `${escapeHtml(tx.sender.fullName)}<br/><span class="muted">${escapeHtml(tx.sender.email || tx.sender.telephone || '')}</span>`)
        : '',
      tx.receiver
        ? row('Destinataire', `${escapeHtml(tx.receiver.fullName)}<br/><span class="muted">${escapeHtml(tx.receiver.email || tx.receiver.telephone || '')}</span>`)
        : '',
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
  .amount .big { font-size: 34px; font-weight: 800; color:${isCreditLike ? '#16a34a' : '#dc2626'}; }
  table { width:100%; border-collapse: collapse; margin-top: 8px; }
  td { padding: 11px 4px; border-bottom: 1px solid #e2e8f0; font-size: 13px; vertical-align: top; }
  td.lbl { color:#64748b; width: 40%; }
  td.val { text-align:right; font-weight:600; }
  .muted { color:#94a3b8; font-weight:400; font-size:11px; }
  .footer { margin-top: 32px; text-align:center; color:#94a3b8; font-size: 11px; line-height:1.6; }
  .stamp { display:inline-block; margin-top:14px; padding:6px 14px; border:1.5px solid #16a34a; color:#16a34a; border-radius:8px; font-weight:700; font-size:12px; }
</style></head>
<body>
  <div class="header">
    <div class="brand">M'<span>Paye</span></div>
    <div class="doc">REÇU DE TRANSACTION<br/>${new Date(tx.createdAt).toLocaleDateString('fr-FR')}</div>
  </div>
  <h1>${typeLabel(tx)} — ${tx.statut}</h1>
  <div class="sub">Référence : ${tx.reference}</div>
  <div class="amount"><div class="big">${sign}${fmt(tx.montant)}</div></div>
  <table>${rows}</table>
  <div class="footer">
    <div class="stamp">✓ ${tx.statut}</div>
    <p>Ce reçu est généré automatiquement par M'Paye et ne nécessite pas de signature.<br/>
    Conservez-le comme justificatif de votre transaction.</p>
  </div>
</body></html>`;
  };

  /** Génère le PDF et ouvre la feuille de partage / enregistrement. */
  const downloadReceipt = async (tx: Transaction) => {
    try {
      setGeneratingReceipt(true);
      const { uri } = await Print.printToFileAsync({ html: buildReceiptHtml(tx) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Reçu ${tx.reference}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Reçu généré', `PDF enregistré :\n${uri}`);
      }
    } catch (e: any) {
      Alert.alert('Erreur', "Impossible de générer le reçu PDF.");
    } finally {
      setGeneratingReceipt(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filterType === 'credit' && !tx.isCredit && tx.type !== 'DEPOSIT') return false;
    if (filterType === 'debit' && (tx.isCredit || tx.type === 'DEPOSIT')) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const title = getTransactionTitle(tx).toLowerCase();
      const ref = tx.reference.toLowerCase();
      return title.includes(query) || ref.includes(query);
    }
    return true;
  });

  // Stats : `total` vient du backend (toutes les transactions, pas juste la page).
  // `credits/debits` sont calculés sur les pages chargées (cumulés au scroll).
  // Pour des totaux globaux exacts, ajouter un endpoint /transactions/stats.
  const stats = {
    total: totalCount,
    credits: transactions.filter(t => t.isCredit || t.type === 'DEPOSIT').reduce((s, t) => s + t.montant, 0),
    debits: transactions.filter(t => !t.isCredit && t.type !== 'DEPOSIT').reduce((s, t) => s + t.montant, 0),
    fees: transactions.reduce((s, t) => s + (t.feeAmount || 0), 0),
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isCreditLike = item.isCredit || item.type === 'DEPOSIT';
    return (
      <TouchableOpacity
        style={[styles.transactionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setSelectedTransaction(item)}
      >
        <View style={styles.transactionLeft}>
          <View
            style={[
              styles.transactionIcon,
              { backgroundColor: isCreditLike ? `${colors.success}20` : `${colors.error}20` },
            ]}
          >
            <Ionicons
              name={isCreditLike ? 'arrow-down' : 'arrow-up'}
              size={20}
              color={isCreditLike ? colors.success : colors.error}
            />
          </View>
          <View style={styles.transactionTextWrap}>
            <Text
              style={[styles.transactionTitle, { color: colors.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {getTransactionTitle(item)}
            </Text>
            <Text
              style={[styles.transactionDate, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {formatDate(item.createdAt)}
            </Text>
            <Text
              style={[styles.transactionRef, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              Ref: {item.reference.slice(0, 8)}
            </Text>
            {(() => {
              const mm = methodMeta(item.method);
              return mm ? (
                <View style={[styles.methodChip, { backgroundColor: `${mm.color}18` }]}>
                  <Ionicons name={mm.icon} size={10} color={mm.color} />
                  <Text style={[styles.methodChipText, { color: mm.color }]}>Payé via {mm.label}</Text>
                </View>
              ) : null;
            })()}
          </View>
        </View>
        <View style={styles.transactionRight}>
          <Text
            style={[
              styles.transactionAmount,
              { color: isCreditLike ? colors.success : colors.error },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {isCreditLike ? '+' : '-'}{item.montant.toLocaleString()} Ar
          </Text>
          <View style={[styles.transactionStatus, { backgroundColor: `${colors.success}15` }]}>
            <Text
              style={[styles.transactionStatusText, { color: colors.success }]}
              numberOfLines={1}
            >
              {item.statut}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader title="Historique" subtitle="Vos transactions récentes" />

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text
            style={[styles.statValue, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {stats.total}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Transactions</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text
            style={[styles.statValue, { color: colors.success }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {formatCompactAr(stats.credits)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Crédits</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text
            style={[styles.statValue, { color: colors.error }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {formatCompactAr(stats.debits)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Débits</Text>
        </View>
      </View>

      {/* Search and Filters */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Rechercher..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterButtons}>
          {(['all', 'credit', 'debit'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                { borderColor: colors.border },
                filterType === filter && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setFilterType(filter)}
            >
              <Text style={[styles.filterText, { color: filterType === filter ? '#fff' : colors.textSecondary }]}>
                {filter === 'all' ? 'Tous' : filter === 'credit' ? 'Crédits' : 'Débits'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Transactions List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery || filterType !== 'all'
                  ? 'Aucune transaction correspondante'
                  : 'Aucune transaction'}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.loadingMoreText, { color: colors.textSecondary }]}>
                  Chargement…
                </Text>
              </View>
            ) : !hasMore && transactions.length > 0 ? (
              <Text style={[styles.endOfListText, { color: colors.textSecondary }]}>
                {transactions.length} transaction{transactions.length > 1 ? 's' : ''} affichée
                {transactions.length > 1 ? 's' : ''} sur {totalCount}
              </Text>
            ) : null
          }
        />
      )}

      {/* Transaction Details Modal */}
      <Modal visible={!!selectedTransaction} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Détails de la transaction</Text>
              <TouchableOpacity onPress={() => setSelectedTransaction(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedTransaction && (() => {
              const tx = selectedTransaction;
              const isCreditLike = tx.isCredit || tx.type === 'DEPOSIT';
              return (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalDetails}>
                  <DetailRow
                    label="Type"
                    value={tx.type === 'DEPOSIT' ? 'Dépôt' : 'Transfert'}
                    colors={colors}
                  />
                  {methodMeta(tx.method) && (
                    <DetailRow
                      label="Payé via"
                      value={methodMeta(tx.method)!.label}
                      valueColor={methodMeta(tx.method)!.color}
                      colors={colors}
                    />
                  )}
                  <DetailRow
                    label="Montant"
                    value={`${isCreditLike ? '+' : '-'}${tx.montant.toLocaleString()} Ar`}
                    valueColor={isCreditLike ? colors.success : colors.error}
                    bold
                    colors={colors}
                  />
                  {tx.feeAmount > 0 && (
                    <DetailRow
                      label="Frais"
                      value={`${tx.feeAmount.toLocaleString()} Ar`}
                      valueColor={colors.warning}
                      colors={colors}
                    />
                  )}
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Statut</Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${colors.success}15` }]}>
                      <Text style={[styles.statusBadgeText, { color: colors.success }]} numberOfLines={1}>
                        {tx.statut}
                      </Text>
                    </View>
                  </View>
                  <DetailRow
                    label="Date"
                    value={new Date(tx.createdAt).toLocaleString('fr-FR')}
                    colors={colors}
                  />
                  {tx.motif && (
                    <DetailRow label="Motif" value={tx.motif} colors={colors} />
                  )}
                  <DetailRow
                    label="Référence"
                    value={tx.reference}
                    mono
                    colors={colors}
                  />
                  {tx.sender && (
                    <View style={styles.personInfo}>
                      <Text style={[styles.personLabel, { color: colors.textSecondary }]}>Expéditeur</Text>
                      <Text style={[styles.personName, { color: colors.text }]} numberOfLines={1}>
                        {tx.sender.fullName}
                      </Text>
                      <Text
                        style={[styles.personContact, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {tx.sender.email || tx.sender.telephone}
                      </Text>
                    </View>
                  )}
                  {tx.receiver && (
                    <View style={styles.personInfo}>
                      <Text style={[styles.personLabel, { color: colors.textSecondary }]}>Destinataire</Text>
                      <Text style={[styles.personName, { color: colors.text }]} numberOfLines={1}>
                        {tx.receiver.fullName}
                      </Text>
                      <Text
                        style={[styles.personContact, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {tx.receiver.email || tx.receiver.telephone}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.receiptBtn, { backgroundColor: colors.primary, opacity: generatingReceipt ? 0.7 : 1 }]}
                  onPress={() => downloadReceipt(tx)}
                  disabled={generatingReceipt}
                  activeOpacity={0.85}
                >
                  {generatingReceipt ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={18} color="#fff" />
                      <Text style={styles.receiptBtnText}>Télécharger le reçu (PDF)</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      <BottomTabBar />
    </View>
  );
}

// ─── Sous-composants & helpers ─────────────────────────

/** Ligne label/valeur du modal détails — gère le wrap propre des valeurs longues. */
function DetailRow({
  label,
  value,
  valueColor,
  bold,
  mono,
  colors,
}: {
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
  mono?: boolean;
  colors: any;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          {
            color: valueColor ?? colors.text,
            fontWeight: bold ? 'bold' : 'normal',
            fontFamily: mono ? 'monospace' : undefined,
          },
        ]}
        numberOfLines={3}
        ellipsizeMode={mono ? 'middle' : 'tail'}
      >
        {value}
      </Text>
    </View>
  );
}

/** Format compact Ar : 1 234 567 → "1,23 M Ar", 25 000 → "25 000 Ar" */
function formatCompactAr(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0 Ar';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace('.', ',')} M Ar`;
  }
  if (abs >= 100_000) {
    return `${Math.round(n / 1_000)} K Ar`;
  }
  return `${n.toLocaleString('fr-FR')} Ar`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 96,
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
  },
  receiptBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  methodChipText: { fontSize: 10, fontWeight: '700' },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  transactionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  transactionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  transactionDate: {
    fontSize: 11,
    marginTop: 2,
  },
  transactionRef: {
    fontSize: 10,
    marginTop: 1,
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
    marginLeft: 8,
    maxWidth: 140,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  transactionStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  transactionStatusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  loadingMoreText: {
    fontSize: 13,
  },
  endOfListText: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalDetails: {
    padding: 20,
    gap: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailLabel: {
    fontSize: 14,
    flexShrink: 0,
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  personInfo: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 4,
  },
  personLabel: {
    fontSize: 12,
  },
  personName: {
    fontSize: 15,
    fontWeight: '600',
  },
  personContact: {
    fontSize: 12,
  },
});
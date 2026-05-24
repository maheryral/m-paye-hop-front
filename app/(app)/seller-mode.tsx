// app/(app)/seller-mode.tsx
// 🛒 Mode vendeur léger façon Alipay 个人收款 — tout user peut recevoir des paiements sans KYC.
// QR avec montant optionnel + stats du jour/semaine/mois + derniers paiements reçus.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLocale } from '../../src/contexts/LocaleContext';
import { useSocket } from '../../src/contexts/SocketContext';
import { transactionService } from '../../src/services/api';
import GradientHeader from '../../src/components/GradientHeader';

const BLUE_GRADIENT: [string, string] = ['#0f172a', '#1e40af'];

export default function SellerMode() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { formatCurrency } = useLocale();
  const { onNotification } = useSocket();

  // Montant optionnel à demander (laisser vide = payeur libre)
  const [requestedAmount, setRequestedAmount] = useState('');
  const [editingAmount, setEditingAmount] = useState(false);

  // Transactions reçues
  const [receivedTx, setReceivedTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sharing, setSharing] = useState(false);

  const qrRef = useRef<any>(null);

  // QR contient identité du receveur + montant éventuel
  const qrData = useMemo(
    () =>
      JSON.stringify({
        type: 'payment_request',
        userId: user?.id,
        name: user?.prenom ? `${user.prenom} ${user.nom || ''}`.trim() : 'Utilisateur M\'Paye',
        email: user?.email,
        telephone: user?.telephone || '',
        amount: requestedAmount ? Number(requestedAmount) : undefined,
        timestamp: new Date().toISOString(),
      }),
    [user, requestedAmount],
  );

  const loadTransactions = useCallback(async () => {
    try {
      const res = await transactionService.getTransactions({ limit: 50 });
      const list = (res?.transactions || res || []) as any[];
      // Garder uniquement les crédits (paiements reçus)
      const credits = list.filter((tx: any) => tx.isCredit || tx.type === 'DEPOSIT');
      setReceivedTx(credits);
    } catch (e: any) {
      console.error('Erreur chargement seller stats:', e?.response?.data || e?.message);
      setReceivedTx([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
    const unsub = onNotification((n) => {
      if (n.type === 'TRANSFER_RECEIVED') {
        loadTransactions(); // refresh quand quelqu'un paie
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stats calculées
  const stats = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startWeek = new Date(startToday);
    startWeek.setDate(startToday.getDate() - 7);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let today = 0, week = 0, month = 0, total = 0;
    let countToday = 0, countWeek = 0, countMonth = 0;
    for (const tx of receivedTx) {
      const d = new Date(tx.createdAt);
      const amt = Number(tx.montant || 0);
      total += amt;
      if (d >= startMonth) { month += amt; countMonth++; }
      if (d >= startWeek) { week += amt; countWeek++; }
      if (d >= startToday) { today += amt; countToday++; }
    }
    return { today, week, month, total, countToday, countWeek, countMonth };
  }, [receivedTx]);

  const shareQR = async () => {
    if (!qrRef.current || sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(qrRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      if (Platform.OS === 'web') {
        await Share.share({ message: `Mon QR M'Paye — paye-moi via l'app !` });
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: "Partager mon QR M'Paye",
          });
        } else {
          await Share.share({ message: `Mon QR M'Paye${requestedAmount ? ` — ${formatCurrency(Number(requestedAmount))}` : ''}` });
        }
      }
    } catch (e: any) {
      console.error('Erreur partage QR:', e?.message);
    } finally {
      setSharing(false);
    }
  };

  const renderTxItem = (tx: any) => {
    const amt = Number(tx.montant || 0);
    const senderName =
      tx.sender?.fullName ||
      (tx.sender ? `${tx.sender.firstName || ''} ${tx.sender.lastName || ''}`.trim() : '') ||
      tx.motif ||
      'Paiement reçu';
    const date = new Date(tx.createdAt);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const timeLabel = isToday
      ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    return (
      <View key={tx.id} style={[styles.txRow, { borderBottomColor: colors.border }]}>
        <View style={[styles.txAvatar, { backgroundColor: '#10b98120' }]}>
          <Ionicons name="arrow-down" size={16} color="#10b981" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.txName, { color: colors.text }]} numberOfLines={1}>
            {senderName}
          </Text>
          <Text style={[styles.txDate, { color: colors.textSecondary }]}>{timeLabel}</Text>
        </View>
        <Text style={[styles.txAmount, { color: '#10b981' }]}>
          +{formatCurrency(amt)}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title="Recevoir un paiement"
        subtitle="Montre ce QR à ton client"
        rightIcon="share-outline"
        onRightPress={shareQR}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadTransactions();
            }}
            tintColor="#1e40af"
          />
        }
      >
        {/* QR Card avec dégradé */}
        <LinearGradient
          colors={BLUE_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.qrCard}
        >
          <Text style={styles.qrTitle}>
            {user?.prenom ? `${user.prenom} ${user.nom || ''}`.trim() : 'Mon compte M\'Paye'}
          </Text>
          {user?.telephone && (
            <Text style={styles.qrPhone}>{user.telephone}</Text>
          )}

          {/* QR code dans cadre blanc */}
          <View ref={qrRef} collapsable={false} style={styles.qrWrap}>
            <QRCode
              value={qrData}
              size={200}
              backgroundColor="white"
              color="#0f172a"
            />
          </View>

          {/* Montant demandé */}
          {requestedAmount && Number(requestedAmount) > 0 && (
            <View style={styles.amountBadge}>
              <Text style={styles.amountBadgeLabel}>Montant demandé</Text>
              <Text style={styles.amountBadgeValue}>
                {formatCurrency(Number(requestedAmount))}
              </Text>
            </View>
          )}

          {/* Toggle / setter du montant */}
          {!editingAmount ? (
            <TouchableOpacity
              style={styles.amountEditBtn}
              onPress={() => setEditingAmount(true)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={requestedAmount ? 'create-outline' : 'add-circle-outline'}
                size={16}
                color="#fff"
              />
              <Text style={styles.amountEditText}>
                {requestedAmount ? 'Modifier le montant' : 'Demander un montant précis'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.amountInputRow}>
              <TextInput
                style={styles.amountInput}
                value={requestedAmount}
                onChangeText={(t) => setRequestedAmount(t.replace(/[^\d]/g, ''))}
                placeholder="0"
                placeholderTextColor="rgba(255,255,255,0.5)"
                keyboardType="numeric"
                autoFocus
              />
              <Text style={styles.amountInputUnit}>Ar</Text>
              <TouchableOpacity
                onPress={() => setEditingAmount(false)}
                style={styles.amountValidate}
              >
                <Ionicons name="checkmark" size={20} color="#1e40af" />
              </TouchableOpacity>
              {requestedAmount && (
                <TouchableOpacity
                  onPress={() => {
                    setRequestedAmount('');
                    setEditingAmount(false);
                  }}
                  style={styles.amountValidate}
                >
                  <Ionicons name="close" size={20} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </LinearGradient>

        {/* Stats du vendeur */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Aujourd'hui</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(stats.today)}</Text>
            <Text style={[styles.statCount, { color: colors.textSecondary }]}>
              {stats.countToday} paiement{stats.countToday > 1 ? 's' : ''}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>7 derniers jours</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(stats.week)}</Text>
            <Text style={[styles.statCount, { color: colors.textSecondary }]}>
              {stats.countWeek} paiement{stats.countWeek > 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 10 }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ce mois</Text>
          <Text style={[styles.statValue, { color: '#10b981' }]}>{formatCurrency(stats.month)}</Text>
          <Text style={[styles.statCount, { color: colors.textSecondary }]}>
            {stats.countMonth} paiement{stats.countMonth > 1 ? 's' : ''}
          </Text>
        </View>

        {/* Paiements récents */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Derniers paiements reçus
        </Text>
        <View style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {loading ? (
            <ActivityIndicator color="#1e40af" style={{ padding: 24 }} />
          ) : receivedTx.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="receipt-outline" size={36} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                Aucun paiement reçu pour l'instant
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, textAlign: 'center', paddingHorizontal: 16 }}>
                Partage ton QR à tes clients pour recevoir ton premier paiement
              </Text>
            </View>
          ) : (
            receivedTx.slice(0, 10).map(renderTxItem)
          )}
        </View>

        {/* Info box */}
        <View style={[styles.infoBox, { borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={16} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Vous pouvez recevoir des paiements sans vérification supplémentaire jusqu'à votre limite mensuelle.
            Pour devenir vrai commerçant (boutique, coupons, plus de limites), passez par "Devenir Commerçant" dans le menu.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // QR card
  qrCard: {
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    gap: 12,
  },
  qrTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  qrPhone: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: -8 },
  qrWrap: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginVertical: 6,
  },

  amountBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  amountBadgeLabel: { color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  amountBadgeValue: { color: '#1e40af', fontSize: 20, fontWeight: '800', marginTop: 2 },

  amountEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    marginTop: 4,
  },
  amountEditText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
  },
  amountInput: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    minWidth: 80,
    paddingVertical: 4,
  },
  amountInputUnit: { color: '#fff', fontSize: 14, fontWeight: '700' },
  amountValidate: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  statLabel: { fontSize: 11, fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: '800' },
  statCount: { fontSize: 11 },

  // Transactions
  sectionTitle: { fontSize: 14, fontWeight: '700', marginTop: 22, marginBottom: 10 },
  txCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
  },
  txAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  txName: { fontSize: 13, fontWeight: '600' },
  txDate: { fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '800' },

  emptyBox: {
    alignItems: 'center',
    padding: 28,
    gap: 8,
  },

  infoBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 18,
  },
  infoText: { flex: 1, fontSize: 11, lineHeight: 16 },
});

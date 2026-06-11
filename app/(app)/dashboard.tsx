// app/(app)/dashboard.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import NotificationBadge from '../../src/components/NotificationBadge';
import BottomTabBar from '../../src/components/BottomTabBar';
import { useAuth } from '../../src/contexts/AuthContext';
import { useWallet } from '../../src/contexts/WalletContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useLocale } from '../../src/contexts/LocaleContext';
import { resolveAssetUrl, transactionService } from '../../src/services/api';
import { billersApi, type PublicBiller, type PublicServiceType } from '../../src/services/billersApi';
import { cardsApi, type SavedCard } from '../../src/services/cardsApi';

const screenWidth = Dimensions.get('window').width;

/** Catégorie dérivée des billers : 1 ServiceType + le nb de services rattachés. */
type Category = { type: PublicServiceType; count: number };

/** Mappe un nom d'icône lucide (renvoyé par la BD) vers une icône Ionicons. */
function lucideToIonicons(name: string | null): keyof typeof Ionicons.glyphMap {
  if (!name) return 'apps-outline';
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    Zap: 'flash-outline',
    Tv: 'tv-outline',
    Wifi: 'wifi-outline',
    Droplets: 'water-outline',
    FileText: 'document-text-outline',
    Plane: 'airplane-outline',
    Car: 'car-outline',
    UtensilsCrossed: 'restaurant-outline',
    Sparkles: 'sparkles-outline',
    AppWindow: 'apps-outline',
    Tag: 'pricetag-outline',
    Phone: 'call-outline',
    Receipt: 'receipt-outline',
    ShoppingCart: 'cart-outline',
    Building2: 'business-outline',
    Coffee: 'cafe-outline',
    Train: 'train-outline',
    Bus: 'bus-outline',
    CableCar: 'git-network-outline',
    Star: 'star-outline',
  };
  return map[name] || 'apps-outline';
}

type RecentTx = {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  amount: number;
  type: 'credit' | 'debit';
};

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { balance, fetchBalance } = useWallet();
  const { colors } = useTheme();
  const { formatCurrency } = useLocale();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [transactions, setTransactions] = useState<RecentTx[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [card, setCard] = useState<SavedCard | null>(null);
  const [promoIndex, setPromoIndex] = useState(0);

  useEffect(() => {
    fetchBalance();
    loadTransactions();
    loadCategories();
    loadCard();
  }, []);

  /** Carte affichée sur le hero = carte par défaut (sinon la première). */
  const loadCard = async () => {
    try {
      const r = await cardsApi.list();
      const list = Array.isArray(r.data) ? r.data : [];
      setCard(list.find((c) => c.isDefault) ?? list[0] ?? null);
    } catch {
      setCard(null);
    }
  };

  /**
   * Catégories du dashboard = types de service réels (BD), dérivés de /billers.
   * Chaque type regroupe ses billers (sous-services). Tri par sortOrder admin.
   */
  const loadCategories = async () => {
    try {
      const r = await billersApi.list();
      const billers: PublicBiller[] = Array.isArray(r.data) ? r.data : [];
      const map = new Map<string, Category>();
      for (const b of billers) {
        const existing = map.get(b.serviceType.id);
        if (existing) existing.count += 1;
        else map.set(b.serviceType.id, { type: b.serviceType, count: 1 });
      }
      setCategories(
        Array.from(map.values()).sort((a, b) => a.type.sortOrder - b.type.sortOrder),
      );
    } catch {
      setCategories([]);
    }
  };

  const loadTransactions = async () => {
    try {
      const res = await transactionService.getTransactions({ limit: 5 });
      const data: any[] = res?.transactions || [];
      setTransactions(data.map(formatTx));
    } catch {
      // silencieux : la section restera vide
    }
  };

  const formatTx = (tx: any): RecentTx => {
    const isCredit = tx.isCredit || tx.type === 'DEPOSIT';
    return {
      id: tx.id,
      title: tx.motif || tx.label || (isCredit ? 'Argent reçu' : 'Paiement'),
      subtitle: isCredit ? 'Transfert reçu' : 'Paiement',
      date: formatTxDate(tx.createdAt),
      amount: Math.abs(tx.montant ?? tx.amount ?? 0),
      type: isCredit ? 'credit' : 'debit',
    };
  };

  const formatTxDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return `Aujourd'hui, ${hm}`;
    if (isYesterday) return `Hier, ${hm}`;
    return d.toLocaleDateString('fr-FR');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchBalance(), loadTransactions(), loadCard()]);
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour,';
    if (hour < 18) return 'Bon après-midi,';
    return 'Bonsoir,';
  };

  const firstName = user?.prenom || user?.email?.split('@')[0] || 'cher client';

  const quickActions: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap; route: string; color: string }[] = [
    { id: 'scan', label: 'Scanner', icon: 'scan-outline', route: '/qr-payment', color: '#2563eb' },
    { id: 'pay', label: 'Payer &\nRecevoir', icon: 'swap-horizontal-outline', route: '/transfers', color: '#10b981' },
    { id: 'services', label: 'Services', icon: 'grid-outline', route: '/bills', color: '#f59e0b' },
    { id: 'wallet', label: 'Portefeuille', icon: 'wallet-outline', route: '/portfolio', color: '#8b5cf6' },
  ];

  const promos = [
    {
      id: 'cashback',
      title: 'Cashback',
      badge: '5%',
      subtitle: '5% remboursés sur chaque\npaiement marchand',
      icon: 'sync-outline' as const,
      gradient: ['#2563eb', '#3b82f6'] as const,
    },
    {
      id: 'transfers',
      title: 'Transferts gratuits',
      badge: '0 Ar',
      subtitle: "Aucun frais entre comptes\nM'Paye",
      icon: 'send' as const,
      gradient: ['#0f172a', '#1e293b'] as const,
    },
    {
      id: 'referral',
      title: 'Parrainage',
      badge: '+5 000 Ar',
      subtitle: 'Invitez un proche,\ngagnez 5 000 Ar',
      icon: 'gift' as const,
      gradient: ['#7c3aed', '#a855f7'] as const,
    },
  ];

  const PROMO_CARD_WIDTH = screenWidth - 40 - 60; // padding + peek du card suivant

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* ═══════════ BLOC BLEU (status bar + header + carte solde) ═══════════ */}
        <LinearGradient
          colors={['#2563eb', '#1e40af', '#1e3a8a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.topBlue, { paddingTop: insets.top + 12 }]}
        >
          <View style={styles.topBlueDecor1} />
          <View style={styles.topBlueDecor2} />

          {/* ── Header ── */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerLeft} activeOpacity={0.8} onPress={() => router.push('/profile')}>
              {user?.avatarUrl ? (
                <Image source={{ uri: resolveAssetUrl(user.avatarUrl) }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarLetter}>{firstName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View>
                <Text style={styles.greeting}>{getGreeting()}</Text>
                <Text style={styles.userName} numberOfLines={1}>
                  {firstName} 👋
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconCircle} onPress={() => router.push('/bills')}>
                <Ionicons name="search" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconCircle} onPress={() => router.push('/notifications')}>
                <Ionicons name="notifications-outline" size={18} color="#fff" />
                <NotificationBadge size={18} borderColor="#1e40af" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Carte solde ── */}
          <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.balanceCard}>
            <View style={styles.balanceDecor1} />

            {/* Carte par défaut (réelle) en haut à droite */}
            <TouchableOpacity
              style={styles.visaMock}
              activeOpacity={0.8}
              onPress={() => router.push('/portfolio')}
            >
              <View style={styles.visaChip} />
              <Text style={styles.visaBrand}>{card ? card.brand.toUpperCase() : 'CARTE'}</Text>
              <Text style={styles.visaNumber}>{card ? `•••• ${card.last4}` : '+ Ajouter'}</Text>
            </TouchableOpacity>

            <View style={styles.balanceLabelRow}>
              <Text style={styles.balanceLabel}>Solde disponible</Text>
              <TouchableOpacity onPress={() => setShowBalance((v) => !v)} hitSlop={10}>
                <Ionicons name={showBalance ? 'eye-outline' : 'eye-off-outline'} size={16} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
            </View>

            <Text style={styles.balanceAmount}>{showBalance ? formatCurrency(balance) : '•••••••'}</Text>
            <Text style={styles.balanceHint}>{showBalance ? 'Masquer le solde' : 'Afficher le solde'}</Text>

            <View style={styles.balanceActions}>
              <TouchableOpacity style={styles.balanceBtnFilled} onPress={() => router.push('/portfolio')} activeOpacity={0.85}>
                <Ionicons name="add" size={16} color="#1e40af" />
                <Text style={styles.balanceBtnFilledText}>Recharger</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.balanceBtnOutline} onPress={() => router.push('/history')} activeOpacity={0.85}>
                <Ionicons name="time-outline" size={15} color="#fff" />
                <Text style={styles.balanceBtnOutlineText}>Historique</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* ═══════════ ACTIONS RAPIDES (flotte sur le bleu) ═══════════ */}
        <Animated.View entering={FadeInDown.delay(220).duration(500)} style={[styles.section, styles.quickActionsSection]}>
          <View style={[styles.quickActionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {quickActions.map((action, i) => (
              <React.Fragment key={action.id}>
                {i > 0 && <View style={[styles.quickDivider, { backgroundColor: colors.border }]} />}
                <TouchableOpacity style={styles.quickAction} activeOpacity={0.7} onPress={() => router.push(action.route as any)}>
                  <View style={[styles.quickIconCircle, { backgroundColor: `${action.color}1a` }]}>
                    <Ionicons name={action.icon} size={20} color={action.color} />
                  </View>
                  <Text style={[styles.quickLabel, { color: colors.text }]}>{action.label}</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </Animated.View>

        {/* ═══════════ CATÉGORIES (dynamiques depuis la BD) ═══════════ */}
        {categories.length > 0 && (
          <Animated.View entering={FadeInDown.delay(320).duration(500)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Catégories</Text>
              <TouchableOpacity style={styles.seeAll} onPress={() => router.push('/bills')}>
                <Text style={[styles.seeAllText, { color: colors.primary }]}>Voir tout</Text>
                <Ionicons name="chevron-forward" size={13} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
              {categories.map(({ type, count }) => {
                const color = type.color || '#3b82f6';
                return (
                  <TouchableOpacity
                    key={type.id}
                    style={styles.categoryItem}
                    activeOpacity={0.8}
                    onPress={() => router.push({ pathname: '/bills', params: { typeId: type.id } })}
                  >
                    <View style={[styles.categoryTile, { backgroundColor: `${color}1a` }]}>
                      <Ionicons name={lucideToIonicons(type.iconName)} size={22} color={color} />
                      <View style={[styles.categoryCount, { backgroundColor: color, borderColor: colors.background }]}>
                        <Text style={styles.categoryCountText}>{count}</Text>
                      </View>
                    </View>
                    <Text style={[styles.categoryLabel, { color: colors.text }]} numberOfLines={1}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {/* ═══════════ VOS AVANTAGES ═══════════ */}
        <Animated.View entering={FadeInDown.delay(420).duration(500)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 14 }]}>Vos avantages M'Paye</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={PROMO_CARD_WIDTH + 12}
            decelerationRate="fast"
            contentContainerStyle={{ gap: 12 }}
            onMomentumScrollEnd={(e) => setPromoIndex(Math.round(e.nativeEvent.contentOffset.x / (PROMO_CARD_WIDTH + 12)))}
          >
            {promos.map((promo) => (
              <LinearGradient
                key={promo.id}
                colors={promo.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.promoCard, { width: PROMO_CARD_WIDTH }]}
              >
                <View style={styles.promoIconBubble}>
                  <Ionicons name={promo.icon} size={18} color="#fff" />
                </View>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" style={styles.promoArrow} />
                <Text style={styles.promoBadge}>{promo.badge}</Text>
                <Text style={styles.promoTitle}>{promo.title}</Text>
                <Text style={styles.promoSubtitle}>{promo.subtitle}</Text>
              </LinearGradient>
            ))}
          </ScrollView>
          <View style={styles.dotsRow}>
            {promos.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === promoIndex ? colors.primary : colors.border, width: i === promoIndex ? 18 : 6 },
                ]}
              />
            ))}
          </View>
        </Animated.View>

        {/* ═══════════ TRANSACTIONS RÉCENTES ═══════════ */}
        <Animated.View entering={FadeInDown.delay(520).duration(500)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Transactions récentes</Text>
            <TouchableOpacity style={styles.seeAll} onPress={() => router.push('/history')}>
              <Text style={[styles.seeAllText, { color: colors.primary }]}>Voir tout</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? (
            <Text style={[styles.emptyTx, { color: colors.textSecondary }]}>Aucune transaction récente</Text>
          ) : (
            transactions.map((tx) => {
              const credit = tx.type === 'credit';
              return (
                <TouchableOpacity key={tx.id} style={styles.txRow} activeOpacity={0.7} onPress={() => router.push('/history')}>
                  <View style={[styles.txIcon, { backgroundColor: credit ? '#DCFCE7' : '#EDE9FE' }]}>
                    <Ionicons
                      name={credit ? 'arrow-down' : 'bag-outline'}
                      size={18}
                      color={credit ? '#22c55e' : '#8b5cf6'}
                    />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={[styles.txTitle, { color: colors.text }]} numberOfLines={1}>
                      {tx.title}
                    </Text>
                    <Text style={[styles.txSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      {tx.subtitle}
                    </Text>
                  </View>
                  <View style={styles.txAmountWrap}>
                    <Text style={[styles.txAmount, { color: credit ? '#16a34a' : colors.text }]}>
                      {credit ? '+ ' : '- '}
                      {formatCurrency(tx.amount)}
                    </Text>
                    <Text style={[styles.txDate, { color: colors.textSecondary }]} numberOfLines={1}>
                      {tx.date}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </Animated.View>
      </ScrollView>

      {/* ═══════════ BOTTOM TAB BAR (composant partagé) ═══════════ */}
      <BottomTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  // ─── Bloc bleu (header + solde) ───
  topBlue: {
    paddingHorizontal: 16,
    paddingBottom: 34,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: 'hidden',
  },
  topBlueDecor1: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  topBlueDecor2: {
    position: 'absolute',
    bottom: -30,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    zIndex: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.22)' },
  avatarLetter: { color: '#fff', fontSize: 16, fontWeight: '700' },
  greeting: { fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.8)' },
  userName: { fontSize: 15, fontWeight: '700', marginTop: 1, color: '#fff' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  section: { paddingHorizontal: 16, marginBottom: 18 },
  quickActionsSection: { marginTop: -24, marginBottom: 18, zIndex: 5 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 12, fontWeight: '600' },

  // ─── Carte solde ───
  balanceCard: {
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    zIndex: 1,
  },
  balanceDecor1: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  balanceDecor2: {
    position: 'absolute',
    bottom: -50,
    right: 40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  visaMock: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 80,
    height: 50,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 8,
    justifyContent: 'space-between',
  },
  visaChip: {
    width: 18,
    height: 13,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  visaBrand: {
    position: 'absolute',
    top: 7,
    right: 8,
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  visaNumber: { color: 'rgba(255,255,255,0.9)', fontSize: 9, fontWeight: '600', letterSpacing: 1 },
  balanceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '500' },
  balanceAmount: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 4, letterSpacing: 0.3 },
  balanceHint: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '400', marginTop: 2 },
  balanceActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  balanceBtnFilled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#fff',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 13,
  },
  balanceBtnFilledText: { color: '#1e40af', fontSize: 13, fontWeight: '700' },
  balanceBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  balanceBtnOutlineText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // ─── Actions rapides ───
  quickActionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  quickAction: { flex: 1, alignItems: 'center', gap: 6 },
  quickDivider: { width: 1, height: 38, opacity: 0.7 },
  quickIconCircle: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  quickLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center', lineHeight: 13 },

  // ─── Catégories ───
  categoriesRow: { gap: 16, paddingRight: 8, paddingTop: 8 },
  categoryItem: { alignItems: 'center', gap: 6, width: 66 },
  categoryTile: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  categoryCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
    zIndex: 2,
  },
  categoryCountText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  categoryLabel: { fontSize: 10, fontWeight: '500', textAlign: 'center' },

  // ─── Promo / avantages ───
  promoCard: {
    borderRadius: 18,
    padding: 14,
    height: 120,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  promoIconBubble: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoArrow: { position: 'absolute', top: 18, right: 14 },
  promoBadge: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  promoTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 2 },
  promoSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '400', marginTop: 3, lineHeight: 15 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 12 },
  dot: { height: 6, borderRadius: 3 },

  // ─── Transactions ───
  emptyTx: { fontSize: 12, fontWeight: '400', paddingVertical: 10 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  txIcon: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1, minWidth: 0 },
  txTitle: { fontSize: 13, fontWeight: '600' },
  txSubtitle: { fontSize: 11, fontWeight: '400', marginTop: 1 },
  txAmountWrap: { alignItems: 'flex-end' },
  txAmount: { fontSize: 13, fontWeight: '700' },
  txDate: { fontSize: 10, fontWeight: '400', marginTop: 1 },
});

// app/(app)/dashboard.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import NotificationBadge from '../../src/components/NotificationBadge';
import ServicesScroller from '../../src/components/ServicesScroller';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useNavigation } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useWallet } from '../../src/contexts/WalletContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useLocale } from '../../src/contexts/LocaleContext';
import * as Location from 'expo-location';
import {
  billersApi,
  type PublicBiller,
} from '../../src/services/billersApi';

const screenWidth = Dimensions.get('window').width;

// Données des produits de vente
const mealProducts = [
  { id: 'm1', name: 'Burger Classic', price: 8500, image: '🍔', restaurant: 'Fast Food Express' },
  { id: 'm2', name: 'Pizza Margherita', price: 12500, image: '🍕', restaurant: 'Pizza House' },
  { id: 'm3', name: 'Salade César', price: 7500, image: '🥗', restaurant: 'Healthy Food' },
  { id: 'm4', name: 'Plat du jour', price: 9500, image: '🍲', restaurant: 'Chez Maman' },
  { id: 'm5', name: 'Sushi Mix', price: 18500, image: '🍱', restaurant: 'Sushi Bar' },
  { id: 'm6', name: 'Tacos', price: 6500, image: '🌮', restaurant: 'Mexican Grill' },
];

const clothingProducts = [
  { id: 'c1', name: 'T-shirt Premium', price: 25000, image: '👕', brand: 'Urban Wear' },
  { id: 'c2', name: 'Jean Slim', price: 55000, image: '👖', brand: 'Denim Co' },
  { id: 'c3', name: 'Robe élégante', price: 75000, image: '👗', brand: 'Fashion Luxe' },
  { id: 'c4', name: 'Casquette', price: 15000, image: '🧢', brand: 'Sport Style' },
  { id: 'c5', name: 'Chaussures sport', price: 85000, image: '👟', brand: 'Nike' },
  { id: 'c6', name: 'Veste en cuir', price: 125000, image: '🧥', brand: 'Leather Co' },
];

const otherProducts = [
  { id: 'o1', name: 'Smartphone', price: 350000, image: '📱', seller: 'Tech Store' },
  { id: 'o2', name: 'Écouteurs BT', price: 45000, image: '🎧', seller: 'Audio Shop' },
  { id: 'o3', name: 'Montre connectée', price: 125000, image: '⌚', seller: 'Gadget World' },
  { id: 'o4', name: 'Sac à dos', price: 55000, image: '🎒', seller: 'Bag Store' },
  { id: 'o5', name: 'Lampe LED', price: 18500, image: '💡', seller: 'Home Decor' },
  { id: 'o6', name: 'Parfum', price: 65000, image: '🧴', seller: 'Beauty Shop' },
];

export default function Dashboard() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { balance, fetchBalance } = useWallet();
  const { colors } = useTheme();
  const { t, formatCurrency } = useLocale();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState('home');
  const [selectedSaleCategory, setSelectedSaleCategory] = useState<'meals' | 'clothing' | 'others'>('meals');
  const [showBalance, setShowBalance] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Recherche dashboard : on charge tous les billers et on filtre en local
  // (la liste est petite et utile aussi pour le ServicesScroller).
  const [allBillers, setAllBillers] = useState<PublicBiller[]>([]);
  const [launchingFromSearch, setLaunchingFromSearch] = useState<string | null>(null);

  useEffect(() => {
    fetchBalance();
  }, []);

  useEffect(() => {
    billersApi
      .list()
      .then((r) => setAllBillers(Array.isArray(r.data) ? r.data : []))
      .catch(() => {
        // silencieux : si HS, la recherche affichera "aucun résultat"
      });
  }, []);

  // Résultats filtrés
  const searchResults = useMemo<PublicBiller[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allBillers
      .filter((b) => {
        const haystack = [
          b.name,
          b.description ?? '',
          b.serviceType?.label ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 15);
  }, [allBillers, searchQuery]);

  const openBillerFromSearch = async (b: PublicBiller) => {
    setSearchQuery('');
    if (b.integrationType === 'NATIVE') {
      try {
        router.push(b.redirectPath as any);
      } catch {
        Alert.alert(
          'Erreur',
          `Impossible d'ouvrir "${b.redirectPath}"`,
        );
      }
      return;
    }
    setLaunchingFromSearch(b.id);
    try {
      const r = await billersApi.launchToken(b.id);
      router.push({
        pathname: '/biller-webview',
        params: { url: r.data.url, name: b.name, color: b.color || '#6366F1' },
      });
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message ?? "Impossible d'ouvrir le service");
    } finally {
      setLaunchingFromSearch(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBalance();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString() + ' Ar';
  };

  const mainActions = [
    { id: 'scan', name: 'Scanner', icon: 'scan-outline', color: '#1e40af', gradient: ['#3b82f6', '#1e40af'] as const, route: '/qr-payment' },
    { id: 'pay', name: 'Payer et\nRecevoir', icon: 'swap-horizontal-outline', color: '#1e40af', gradient: ['#3b82f6', '#1e40af'] as const, route: '/transfers' },
    { id: 'services', name: 'Services', icon: 'apps-outline', color: '#1e40af', gradient: ['#3b82f6', '#1e40af'] as const, route: '/bills' },
    { id: 'wallet', name: 'Portefeuille', icon: 'wallet-outline', color: '#1e40af', gradient: ['#3b82f6', '#1e40af'] as const, route: '/portfolio' },
  ];

  // 🆕 Les sections "Home Apps / Voyage / Bank Card" sont maintenant
  // dynamiques via ServicesScroller (alimenté par l'admin). Les listes
  // hardcodées ci-dessous ont été supprimées.

  const saleCategories = [
    { id: 'meals', name: '🍽️ Repas', icon: 'restaurant-outline' },
    { id: 'clothing', name: '👕 Vêtements', icon: 'shirt-outline' },
    { id: 'others', name: '📦 Autres', icon: 'cube-outline' },
  ];

  const paymentMethods = [
    { id: 'visa', name: 'VISA', icon: 'card-outline', color: '#1e40af' },
    { id: 'mastercard', name: 'Mastercard', icon: 'card-outline', color: '#1e40af' },
    { id: 'unionpay', name: 'UnionPay', icon: 'card-outline', color: '#1e40af' },
  ];

  const messages = [
    { id: 1, name: 'Jean Dupont', message: 'Merci pour le paiement', time: '10:30', unread: true },
    { id: 2, name: 'Marie Claire', message: 'Transfert reçu !', time: '09:15', unread: false },
    { id: 3, name: 'Support M\'Paye', message: 'Votre compte est vérifié', time: 'Hier', unread: false },
  ];

  // Section Vente - Repas
  const renderMealsSection = () => (
    <View style={styles.saleProductsGrid}>
      {mealProducts.map((product) => (
        <TouchableOpacity
          key={product.id}
          style={[styles.saleProductCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => Alert.alert(product.name, `Prix: ${formatPrice(product.price)}\nRestaurant: ${product.restaurant}\nVoulez-vous acheter ce produit ?`, [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Acheter', onPress: () => Alert.alert('Achat', `${product.name} ajouté au panier`) }
          ])}
        >
          <View style={styles.saleProductEmojiContainer}>
            <Text style={styles.saleProductEmoji}>{product.image}</Text>
          </View>
          <Text style={[styles.saleProductName, { color: colors.text }]} numberOfLines={1}>{product.name}</Text>
          <Text style={[styles.saleProductPrice, { color: colors.primary }]}>{formatPrice(product.price)}</Text>
          <Text style={[styles.saleProductSub, { color: colors.textSecondary }]} numberOfLines={1}>{product.restaurant}</Text>
          <LinearGradient
            colors={['#3b82f6', '#1e40af']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buyButton}
          >
            <Text style={styles.buyButtonText}>Acheter</Text>
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Section Vente - Vêtements
  const renderClothingSection = () => (
    <View style={styles.saleProductsGrid}>
      {clothingProducts.map((product) => (
        <TouchableOpacity
          key={product.id}
          style={[styles.saleProductCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => Alert.alert(product.name, `Prix: ${formatPrice(product.price)}\nMarque: ${product.brand}\nVoulez-vous acheter ce produit ?`, [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Acheter', onPress: () => Alert.alert('Achat', `${product.name} ajouté au panier`) }
          ])}
        >
          <View style={styles.saleProductEmojiContainer}>
            <Text style={styles.saleProductEmoji}>{product.image}</Text>
          </View>
          <Text style={[styles.saleProductName, { color: colors.text }]} numberOfLines={1}>{product.name}</Text>
          <Text style={[styles.saleProductPrice, { color: colors.primary }]}>{formatPrice(product.price)}</Text>
          <Text style={[styles.saleProductSub, { color: colors.textSecondary }]} numberOfLines={1}>{product.brand}</Text>
          <LinearGradient
            colors={['#3b82f6', '#1e40af']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buyButton}
          >
            <Text style={styles.buyButtonText}>Acheter</Text>
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Section Vente - Autres produits
  const renderOthersSection = () => (
    <View style={styles.saleProductsGrid}>
      {otherProducts.map((product) => (
        <TouchableOpacity
          key={product.id}
          style={[styles.saleProductCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => Alert.alert(product.name, `Prix: ${formatPrice(product.price)}\nVendeur: ${product.seller}\nVoulez-vous acheter ce produit ?`, [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Acheter', onPress: () => Alert.alert('Achat', `${product.name} ajouté au panier`) }
          ])}
        >
          <View style={styles.saleProductEmojiContainer}>
            <Text style={styles.saleProductEmoji}>{product.image}</Text>
          </View>
          <Text style={[styles.saleProductName, { color: colors.text }]} numberOfLines={1}>{product.name}</Text>
          <Text style={[styles.saleProductPrice, { color: colors.primary }]}>{formatPrice(product.price)}</Text>
          <Text style={[styles.saleProductSub, { color: colors.textSecondary }]} numberOfLines={1}>{product.seller}</Text>
          <LinearGradient
            colors={['#3b82f6', '#1e40af']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buyButton}
          >
            <Text style={styles.buyButtonText}>Acheter</Text>
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Section Vente principale
  const renderPromoSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>
          {t('dashboard.advantages')}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4, gap: 12 }}
      >
        {/* Cashback 5% */}
        <LinearGradient
          colors={['#1e3a8a', '#3b82f6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.promoCard}
        >
          <View style={styles.promoIconBubble}>
            <Ionicons name="cash" size={22} color="#fff" />
          </View>
          <Text style={styles.promoBadge}>5%</Text>
          <Text style={styles.promoTitle}>{t('dashboard.cashback')}</Text>
          <Text style={styles.promoSubtitle}>
            5% remboursés sur chaque paiement marchand
          </Text>
        </LinearGradient>

        {/* Transferts gratuits */}
        <LinearGradient
          colors={['#0f172a', '#1e40af']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.promoCard}
        >
          <View style={styles.promoIconBubble}>
            <Ionicons name="send" size={22} color="#fff" />
          </View>
          <Text style={styles.promoBadge}>0 Ar</Text>
          <Text style={styles.promoTitle}>{t('dashboard.freeTransfers')}</Text>
          <Text style={styles.promoSubtitle}>
            Aucun frais entre comptes M'Paye
          </Text>
        </LinearGradient>

        {/* Bonus parrainage */}
        <LinearGradient
          colors={['#1e40af', '#60a5fa']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.promoCard}
        >
          <View style={styles.promoIconBubble}>
            <Ionicons name="gift" size={22} color="#fff" />
          </View>
          <Text style={styles.promoBadge}>+5 000 Ar</Text>
          <Text style={styles.promoTitle}>{t('dashboard.referral')}</Text>
          <Text style={styles.promoSubtitle}>
            Invitez un proche, gagnez 5 000 Ar
          </Text>
        </LinearGradient>
      </ScrollView>
    </View>
  );

  const renderSalesSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.salesTitleRow}>
          <View style={styles.salesFlashBadge}>
            <Text style={styles.salesFlashEmoji}>⚡</Text>
          </View>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Vente Flash</Text>
            <Text style={[styles.salesSubtitle, { color: colors.textSecondary }]}>Offres limitées dans le temps</Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.seeAllBtn, { backgroundColor: `${colors.primary}15` }]}>
          <Text style={[styles.seeAllText, { color: colors.primary }]}>Voir tout</Text>
          <Ionicons name="arrow-forward" size={12} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Catégories de vente */}
      <View style={styles.saleCategoriesContainer}>
        {saleCategories.map((cat) => {
          const isActive = selectedSaleCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setSelectedSaleCategory(cat.id as any)}
              activeOpacity={0.8}
              style={{ flex: 1 }}
            >
              {isActive ? (
                <LinearGradient
                  colors={['#3b82f6', '#1e40af']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.saleCategoryItem, styles.saleCategoryItemActive]}
                >
                  <Text style={styles.saleCategoryEmoji}>{cat.name.split(' ')[0]}</Text>
                  <Text style={[styles.saleCategoryText, { color: '#fff', fontWeight: '700' }]}>
                    {cat.name.split(' ')[1]}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={[styles.saleCategoryItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={styles.saleCategoryEmoji}>{cat.name.split(' ')[0]}</Text>
                  <Text style={[styles.saleCategoryText, { color: colors.textSecondary }]}>
                    {cat.name.split(' ')[1]}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Contenu dynamique selon catégorie */}
      {selectedSaleCategory === 'meals' && renderMealsSection()}
      {selectedSaleCategory === 'clothing' && renderClothingSection()}
      {selectedSaleCategory === 'others' && renderOthersSection()}
    </View>
  );

  // Les sections Home Apps / Voyage / Bank Card hardcodées ont été remplacées
  // par <ServicesScroller /> alimenté par /billers (admin-driven).

  const renderMessagesSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Messages</Text>
      {messages.map((msg) => (
        <TouchableOpacity key={msg.id} style={[styles.messageItem, { borderBottomColor: colors.border }]}>
          <View style={styles.messageAvatar}>
            <Text style={styles.messageAvatarText}>{msg.name.charAt(0)}</Text>
          </View>
          <View style={styles.messageContent}>
            <View style={styles.messageHeader}>
              <Text style={[styles.messageName, { color: colors.text }]}>{msg.name}</Text>
              <Text style={[styles.messageTime, { color: colors.textSecondary }]}>{msg.time}</Text>
            </View>
            <Text style={[styles.messageText, { color: colors.textSecondary }]}>{msg.message}</Text>
          </View>
          {msg.unread && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderProfileSection = () => (
    <View style={styles.section}>
      <View style={styles.profileHeader}>
        <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.profileAvatarText}>{user?.prenom?.[0] || user?.email?.[0] || 'U'}</Text>
        </View>
        <View>
          <Text style={[styles.profileName, { color: colors.text }]}>
            {user?.prenom ? `${user.prenom} ${user.nom}` : user?.email?.split('@')[0]}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
        </View>
      </View>
      <TouchableOpacity style={[styles.profileMenuItem, { borderBottomColor: colors.border }]} onPress={() => router.push('/profile')}>
        <Ionicons name="person-outline" size={22} color={colors.primary} />
        <Text style={[styles.profileMenuText, { color: colors.text }]}>Mon Profil</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.profileMenuItem, { borderBottomColor: colors.border }]} onPress={() => router.push('/settings')}>
        <Ionicons name="settings-outline" size={22} color={colors.primary} />
        <Text style={[styles.profileMenuText, { color: colors.text }]}>Paramètres</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.profileMenuItem, { borderBottomColor: colors.border }]} onPress={() => router.push('/security')}>
        <Ionicons name="shield-outline" size={22} color={colors.primary} />
        <Text style={[styles.profileMenuText, { color: colors.text }]}>Sécurité</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  /**
   * Contenu SCROLLABLE (seuls le hero + les actions principales sont fixes).
   * Home Apps + promo + sales scrollent ensemble sur l'onglet 'home'.
   *
   * Quand l'user tape dans la barre de recherche du hero, on remplace le
   * contenu normal par les résultats (services filtrés).
   */
  const renderScrollableBody = () => {
    // ─── Mode RECHERCHE ───
    if (searchQuery.trim().length > 0) {
      return renderSearchResults();
    }

    // ─── Mode normal ───
    if (activeBottomTab === 'home') {
      return (
        <>
          {/* Section dynamique : chips Home Apps + grille des billers */}
          <ServicesScroller maxItems={7} />
          {renderPromoSection()}
          {renderSalesSection()}
        </>
      );
    } else if (activeBottomTab === 'message') {
      return renderMessagesSection();
    } else {
      return renderProfileSection();
    }
  };

  const renderSearchResults = () => {
    return (
      <View style={styles.searchResultsWrap}>
        <Text style={[styles.searchResultsHint, { color: colors.textSecondary }]}>
          {searchResults.length === 0
            ? `Aucun service ne correspond à "${searchQuery.trim()}"`
            : `${searchResults.length} résultat${searchResults.length > 1 ? 's' : ''}`}
        </Text>

        {searchResults.map((b) => (
          <TouchableOpacity
            key={b.id}
            onPress={() => openBillerFromSearch(b)}
            disabled={!!launchingFromSearch}
            style={[
              styles.searchResultRow,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: launchingFromSearch && launchingFromSearch !== b.id ? 0.5 : 1 },
            ]}
          >
            <View
              style={[
                styles.searchResultIcon,
                { backgroundColor: b.color || '#6366F1' },
              ]}
            >
              <Ionicons name="apps-outline" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[styles.searchResultName, { color: colors.text }]}
                numberOfLines={1}
              >
                {b.name}
              </Text>
              <Text
                style={[styles.searchResultMeta, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {b.serviceType?.label ?? 'Service'}
                {b.description ? ` · ${b.description}` : ''}
              </Text>
            </View>
            {launchingFromSearch === b.id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* ════════════════════════════════════════════════════════
            HEADER FIXE — hero + actions + Home Apps (onglet 'home')
            Ne scroll pas avec le contenu.
            ════════════════════════════════════════════════════════ */}
        <View>
          {/* === BANNIÈRE TOP DÉGRADÉ VIOLET === */}
          <LinearGradient
            colors={['#3b82f6', '#1e40af', '#1e3a8a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.topBanner, { paddingTop: insets.top + 8 }]}
          >
            <View style={styles.topBannerDecor1} />
            <View style={styles.topBannerDecor2} />

            {/* Row 1: localisation + recherche + notifications (même niveau) */}
            <View style={styles.topBannerHeader}>
              <TouchableOpacity style={styles.locationBtn}>
                <Ionicons name="location" size={14} color="#fff" />
                <Text style={styles.locationText}>Antananarivo</Text>
                <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>

              <View style={styles.searchBar}>
                <Ionicons name="search" size={16} color="rgba(255,255,255,0.7)" />
                <TextInput
                  placeholder="Rechercher un service..."
                  placeholderTextColor="rgba(255,255,255,0.7)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={styles.searchInput}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.9)" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={styles.topIconBtn}
                onPress={() => router.push('/notifications')}
              >
                <Ionicons name="notifications-outline" size={20} color="#fff" />
                <NotificationBadge size={18} borderColor="#1e40af" />
              </TouchableOpacity>
            </View>

            {/* Row 3: solde compact */}
            <View style={styles.greetingRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.balancePreviewRow}>
                  <Text style={styles.balancePreviewLabel}>Solde:</Text>
                  <Text style={styles.balancePreviewAmount}>
                    {showBalance ? formatCurrency(balance) : '••••••'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowBalance(!showBalance)} hitSlop={8}>
                    <Ionicons
                      name={showBalance ? 'eye-outline' : 'eye-off-outline'}
                      size={16}
                      color="rgba(255,255,255,0.9)"
                    />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity
                style={styles.detailsBtn}
                onPress={() => router.push('/portfolio')}
              >
                <Text style={styles.detailsBtnText}>Détails</Text>
                <Ionicons name="chevron-forward" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* === CARTE FLOTTANTE D'ACTIONS (overlap header) === */}
          <View style={styles.contentWrapper}>
            <View style={[styles.floatingActionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {mainActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={styles.mainActionItem}
                  onPress={() => router.push(action.route as any)}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={action.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.mainActionIcon, { shadowColor: action.color }]}
                  >
                    <Ionicons name={action.icon as any} size={22} color="#fff" />
                  </LinearGradient>
                  <Text style={[styles.mainActionLabel, { color: colors.text }]}>{action.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ════════════════════════════════════════════════════════
            BODY SCROLLABLE — Home Apps, promo, sales, messages ou profile.
            Refresh control accessible depuis ici (pull-to-refresh).
            ════════════════════════════════════════════════════════ */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {renderScrollableBody()}
        </ScrollView>

        {/* Bottom Tab Bar moderne */}
        <View style={[styles.bottomTabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { id: 'home', label: 'Accueil', icon: 'apps-outline', activeIcon: 'apps' },
            { id: 'message', label: 'Messages', icon: 'chatbubble-outline', activeIcon: 'chatbubble', badge: true },
            { id: 'profile', label: 'Profil', icon: 'person-outline', activeIcon: 'person' },
          ].map((tab) => {
            const isActive = activeBottomTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={styles.bottomTabItem}
                onPress={() => {
                  if (tab.id === 'profile') {
                    (navigation as any).openDrawer();
                  } else if (tab.id === 'message') {
                    router.push('/messages' as any);
                  } else {
                    setActiveBottomTab(tab.id);
                  }
                }}
                activeOpacity={0.7}
              >
                {isActive ? (
                  <LinearGradient
                    colors={['#3b82f6', '#1e40af']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.bottomTabActivePill}
                  >
                    <View style={styles.messageIconContainer}>
                      <Ionicons name={tab.activeIcon as any} size={20} color="#fff" />
                      {tab.badge && <View style={[styles.messageBadge, { borderColor: '#1e40af' }]} />}
                    </View>
                    <Text style={styles.bottomTabActiveLabel}>{tab.label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.bottomTabInactive}>
                    <View style={styles.messageIconContainer}>
                      <Ionicons name={tab.icon as any} size={22} color={colors.textSecondary} />
                      {tab.badge && <View style={styles.messageBadge} />}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },

  // === Bannière TOP dégradé violet ===
  topBanner: {
    paddingHorizontal: 16,
    paddingBottom: 60,
    position: 'relative',
    overflow: 'hidden',
  },
  topBannerDecor1: {
    position: 'absolute',
    top: -50,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  topBannerDecor2: {
    position: 'absolute',
    bottom: 20,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  topBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    zIndex: 1,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  locationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  topIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  topNotifBadge: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#1e40af',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    padding: 0,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  balancePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balancePreviewLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  balancePreviewAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  detailsBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // === Wrapper du contenu (avec padding horizontal) ===
  contentWrapper: {
    paddingHorizontal: 16,
    marginTop: -44,
  },

  // === Carte flottante avec actions principales ===
  floatingActionsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 18,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  // === Carousel promo ===
  promoScroll: {
    marginBottom: 20,
    marginHorizontal: -16,
  },
  promoScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  promoBanner: {
    width: screenWidth * 0.75,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  promoTextWrap: {
    flex: 1,
  },
  // (anciennes définitions promoTitle/promoSubtitle supprimées — voir plus bas)
  promoEmoji: {
    fontSize: 40,
    marginLeft: 12,
  },

  mainActionItem: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  mainActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  mainActionLabel: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 14,
  },
  menuContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 24,
    padding: 5,
    gap: 4,
  },
  menuItem: {
    flex: 1,
  },
  menuItemActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  menuItemInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 16,
  },
  menuText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  promoCard: {
    width: 200,
    padding: 16,
    borderRadius: 18,
    gap: 6,
    shadowColor: '#1e40af',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 5,
  },
  promoIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  promoBadge: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  promoTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  promoSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    lineHeight: 15,
  },
  salesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  salesFlashBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  salesFlashEmoji: {
    fontSize: 18,
  },
  salesSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    marginBottom: 16 
  },
  servicesGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between' 
  },
  serviceItem: { 
    alignItems: 'center', 
    width: (screenWidth - 40) / 5, 
    marginBottom: 16, 
    gap: 6 
  },
  serviceIcon: { 
    width: 52, 
    height: 52, 
    borderRadius: 26, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  serviceName: { 
    fontSize: 10, 
    textAlign: 'center', 
    lineHeight: 14 
  },
  paymentMethodsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  paymentMethodItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  paymentIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentName: {
    fontSize: 11,
    fontWeight: '500',
  },
  addCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  addCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCardTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  addCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  addCardSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  messageItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14, 
    borderBottomWidth: 1 
  },
  messageAvatar: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    backgroundColor: '#1e40af', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12 
  },
  messageAvatarText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  messageContent: { 
    flex: 1 
  },
  messageHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 4 
  },
  messageName: { 
    fontSize: 15, 
    fontWeight: '600' 
  },
  messageTime: { 
    fontSize: 11 
  },
  messageText: { 
    fontSize: 13 
  },
  unreadDot: { 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    backgroundColor: '#1e40af', 
    marginLeft: 8 
  },
  messageIconContainer: { 
    position: 'relative' 
  },
  messageBadge: { 
    position: 'absolute', 
    top: -2, 
    right: -4, 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#ef4444' 
  },
  profileHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16, 
    marginBottom: 24, 
    padding: 16, 
    borderRadius: 16, 
    backgroundColor: '#33415530' 
  },
  profileAvatar: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  profileAvatarText: { 
    color: '#fff', 
    fontSize: 24, 
    fontWeight: 'bold' 
  },
  profileName: { 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  profileEmail: { 
    fontSize: 13, 
    marginTop: 2 
  },
  profileMenuItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    paddingVertical: 14, 
    borderBottomWidth: 1 
  },
  profileMenuText: { 
    flex: 1, 
    fontSize: 15 
  },
  bottomTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    paddingBottom: 20,
    paddingHorizontal: 12,
    borderTopWidth: 1,
  },
  bottomTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabInactive: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 24,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bottomTabActiveLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  // Styles pour la section Vente
  saleCategoriesContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  saleCategoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  saleCategoryItemActive: {
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    borderColor: 'transparent',
  },
  saleCategoryEmoji: {
    fontSize: 18,
  },
  saleCategoryText: {
    fontSize: 13,
    fontWeight: '500',
  },
  saleProductsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  saleProductCard: {
    width: (screenWidth - 52) / 2,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  saleProductEmojiContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.08)',
    marginBottom: 10,
  },
  saleProductEmoji: {
    fontSize: 36,
  },
  saleProductName: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  saleProductPrice: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  saleProductSub: {
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
  buyButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ─── Résultats de recherche ──────────────
  searchResultsWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 8,
  },
  searchResultsHint: {
    fontSize: 12,
    marginBottom: 6,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchResultIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchResultMeta: {
    fontSize: 11,
    marginTop: 2,
  },
});
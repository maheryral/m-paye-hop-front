// app/(app)/_layout.tsx
import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  View,
  ScrollView,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { resolveAssetUrl } from '../../src/services/api';
import { secureStorage } from '../../src/services/secureStorage';
import { useState, useEffect } from 'react';

function CustomDrawerContent({ navigation }: any) {
  const router = useRouter();
  const { logout, user } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [merchantProfile, setMerchantProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showMerchantMenu, setShowMerchantMenu] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    checkMerchantStatus();
  }, [user]);

  const checkMerchantStatus = async () => {
    try {
      const { merchantApi } = await import('../../src/services/merchantApi');
      const response = await merchantApi.getStatus();
      if (response.data?.hasMerchant && response.data?.merchant) {
        setMerchantProfile(response.data.merchant);
      } else {
        setMerchantProfile(null);
      }
    } catch (err) {
      console.log('Erreur vérification statut commerçant:', err);
      setMerchantProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Êtes-vous sûr de vouloir vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const goToProfile = () => navigation.navigate('profile');
  const handleMerchantSignup = () => navigation.navigate('merchant-signup');

  const switchToMerchant = async () => {
    const status = merchantProfile?.validationStatus;
    if (status && status !== 'APPROVED') {
      const messages: Record<string, string> = {
        PENDING: 'Votre demande est en cours d\'examen (max 48h).',
        REJECTED: merchantProfile?.rejectionReason
          ? `Demande rejetée : ${merchantProfile.rejectionReason}`
          : 'Votre demande a été rejetée. Contactez le support.',
        RESUBMIT_REQUIRED: merchantProfile?.rejectionReason
          ? `Documents complémentaires requis : ${merchantProfile.rejectionReason}`
          : 'Veuillez resoumettre votre demande.',
      };
      Alert.alert('Espace commerçant indisponible', messages[status] || 'Statut inconnu');
      return;
    }

    const merchantId = merchantProfile?.id;
    if (!merchantId) {
      Alert.alert('Erreur', 'Profil marchand introuvable.');
      return;
    }

    setIsSwitching(true);
    try {
      const { merchantApi } = await import('../../src/services/merchantApi');
      const res = await merchantApi.switch(merchantId);
      await Promise.all([
        secureStorage.setItem('accessToken', res.data.accessToken),
        secureStorage.setItem('refreshToken', res.data.refreshToken),
      ]);
      setShowMerchantMenu(true);
      router.push('/(app)/(tabs)/merchant/dashboard');
    } catch (error: any) {
      console.error('Erreur lors du basculement marchand:', error?.response?.data || error?.message);
      Alert.alert(
        'Basculement impossible',
        error?.response?.data?.message || 'Impossible de basculer en mode marchand.',
      );
    } finally {
      setTimeout(() => setIsSwitching(false), 300);
    }
  };

  const switchToClient = async () => {
    setIsSwitching(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setShowMerchantMenu(false);
      navigation.navigate('dashboard');
    } catch (error) {
      console.error('Erreur lors du basculement:', error);
    } finally {
      setTimeout(() => setIsSwitching(false), 300);
    }
  };

  const navigateToMerchantRoute = (route: string) => {
    router.push(`/(app)/(tabs)/${route}` as any);
  };

  const userMenuItems = [
    { name: 'Accueil', route: 'dashboard', icon: 'home-outline', color: '#2563eb', desc: 'Tableau de bord' },
    { name: 'Portefeuille', route: 'portfolio', icon: 'wallet-outline', color: '#3b82f6', desc: 'Gérez vos moyens' },
    { name: 'QR Code', route: 'qr-payment', icon: 'qr-code-outline', color: '#8b5cf6', desc: 'Scanner et payer' },
    { name: 'Recevoir un paiement', route: 'seller-mode', icon: 'cash-outline', color: '#10b981', desc: 'Demander un paiement' },
    { name: 'Transferts', route: 'transfers', icon: 'send-outline', color: '#0ea5e9', desc: "Envoyer de l'argent" },
    { name: 'Messages', route: 'messages', icon: 'chatbubbles-outline', color: '#8b5cf6', desc: 'Notifications & alertes' },
    { name: 'Historique', route: 'history', icon: 'time-outline', color: '#64748b', desc: 'Vos transactions' },
    { name: 'Fidélité', route: 'loyalty', icon: 'gift-outline', color: '#f59e0b', desc: 'Points et récompenses' },
    { name: 'Services', route: 'bills', icon: 'apps-outline', color: '#6366f1', desc: 'Factures et services' },
    { name: 'Bénéficiaires', route: 'beneficiaries', icon: 'people-outline', color: '#2563eb', desc: 'Vos contacts' },
  ];

  const settingsMenuItems = [
    { name: 'Paramètres', route: 'settings', icon: 'settings-outline', color: '#64748b', desc: 'Préférences' },
    { name: 'Sécurité', route: 'security', icon: 'shield-outline', color: '#0ea5e9', desc: 'Mot de passe & PIN' },
  ];

  const isAdmin = (user as any)?.role === 'ADMIN';
  const adminMenuItems = isAdmin
    ? [
        { name: 'Validation paiements', route: 'admin-payments', icon: 'shield-checkmark-outline', color: '#2563eb', desc: 'À examiner' },
        { name: 'Revenus plateforme', route: 'admin-revenue', icon: 'trending-up-outline', color: '#10b981', desc: 'Chiffre & commissions' },
      ]
    : [];

  const merchantMenuItems = [
    { name: 'Dashboard', route: 'merchant/dashboard', icon: 'stats-chart-outline', color: '#2563eb', section: 'Gestion des ventes' },
    { name: 'Scanner QR', route: 'merchant/scanner', icon: 'scan-outline', color: '#3b82f6', section: 'Gestion des ventes' },
    { name: 'QR Code', route: 'merchant/qrcode', icon: 'qr-code-outline', color: '#8b5cf6', section: 'Gestion des ventes' },
    { name: 'Liens de paiement', route: 'merchant/payment-links', icon: 'link-outline', color: '#3b82f6', section: 'Gestion des ventes' },
    { name: 'Transactions', route: 'merchant/transactions', icon: 'list-outline', color: '#2563eb', section: 'Gestion des ventes' },
    { name: 'Mes boutiques', route: 'merchant/store', icon: 'storefront-outline', color: '#2563eb', section: 'Gestion du commerce' },
    { name: 'Catalogue produits', route: 'merchant/products', icon: 'cube-outline', color: '#3b82f6', section: 'Gestion du commerce' },
    { name: 'Équipe', route: 'merchant/employees', icon: 'people-outline', color: '#10b981', section: 'Gestion du commerce' },
    { name: 'Coupons', route: 'merchant/coupons', icon: 'pricetag-outline', color: '#2563eb', section: 'Gestion du commerce' },
    { name: 'Fidélité', route: 'merchant/loyalty', icon: 'gift-outline', color: '#8b5cf6', section: 'Gestion du commerce' },
    { name: 'Remboursements', route: 'merchant/refunds', icon: 'refresh-outline', color: '#ef4444', section: 'Gestion du commerce' },
    { name: 'Mon solde', route: 'merchant/balance', icon: 'cash-outline', color: '#3b82f6', section: 'Finances' },
    { name: 'Retrait', route: 'merchant/withdraw', icon: 'arrow-down-outline', color: '#2563eb', section: 'Finances' },
    { name: 'Statistiques', route: 'merchant/analytics', icon: 'trending-up-outline', color: '#2563eb', section: 'Finances' },
    { name: 'Rapports', route: 'merchant/reports', icon: 'document-text-outline', color: '#2563eb', section: 'Finances' },
    { name: 'Mon entreprise', route: 'merchant/profile', icon: 'business-outline', color: '#64748b', section: 'Configuration' },
    { name: 'Paramètres', route: 'merchant/settings', icon: 'settings-outline', color: '#64748b', section: 'Configuration' },
    { name: 'Aide', route: 'merchant/help', icon: 'help-circle-outline', color: '#64748b', section: 'Configuration' },
  ];

  const groupedMerchantMenu = merchantMenuItems.reduce((acc: any, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});

  // ─── En-tête commun (logo + bouton fermer) ───
  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={styles.logoContainer}>
        <LinearGradient colors={['#2563eb', '#1e40af']} style={styles.logoIcon}>
          <Ionicons name="wallet" size={22} color="#fff" />
        </LinearGradient>
        <Text style={[styles.logoText, { color: colors.text }]}>M'Paye</Text>
      </View>
      <TouchableOpacity
        style={[styles.closeBtn, { backgroundColor: colors.borderLight }]}
        onPress={() => navigation.closeDrawer()}
        hitSlop={8}
      >
        <Ionicons name="close" size={22} color={colors.text} />
      </TouchableOpacity>
    </View>
  );

  // ─── Carte d'un item de menu ───
  const renderMenuCard = (item: any, onPress: () => void) => (
    <TouchableOpacity
      key={item.route}
      style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIcon, { backgroundColor: item.color }]}>
        <Ionicons name={item.icon as any} size={20} color="#fff" />
      </View>
      <View style={styles.menuTextWrap}>
        <Text style={[styles.menuTitle, { color: colors.text }]}>{item.name}</Text>
        {item.desc && <Text style={[styles.menuDesc, { color: colors.textSecondary }]}>{item.desc}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  if (loading || isSwitching) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderHeader()}
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          {isSwitching && (
            <>
              <Text style={[styles.switchingText, { color: colors.text }]}>Basculement en cours...</Text>
              <Text style={[styles.switchingSub, { color: colors.textSecondary }]}>Veuillez patienter</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
      >
        {/* ─── Carte profil ─── */}
        <TouchableOpacity
          onPress={goToProfile}
          style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            {user?.avatarUrl ? (
              <Image source={{ uri: resolveAssetUrl(user.avatarUrl) }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {user?.prenom?.[0] || user?.email?.[0] || 'U'}
                {user?.nom?.[0] || ''}
              </Text>
            )}
            <View style={[styles.onlineBadge, { borderColor: colors.card }]} />
          </View>
          <View style={styles.profileText}>
            <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
              {user?.prenom ? `${user.prenom} ${user.nom || ''}` : user?.email?.split('@')[0] || 'Utilisateur'}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]} numberOfLines={1}>
              {user?.email}
            </Text>
            <View style={styles.kycBadge}>
              <Ionicons name="shield-checkmark" size={11} color="#3b82f6" />
              <Text style={styles.kycText}>KYC {user?.kycLevel || 'BASIC'}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        {showMerchantMenu ? (
          <>
            {/* Bannière espace commerçant actif */}
            <LinearGradient colors={['#2563eb', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBanner}>
              <View style={styles.ctaIcon}>
                <Ionicons name="storefront" size={22} color="#fff" />
              </View>
              <View style={styles.ctaTextWrap}>
                <Text style={styles.ctaTitle}>Espace Commerçant</Text>
                <Text style={styles.ctaSubtitle} numberOfLines={1}>
                  {merchantProfile?.businessName || 'Mon entreprise'}
                </Text>
              </View>
              <TouchableOpacity onPress={switchToClient} style={styles.switchBtn}>
                <Ionicons name="person-outline" size={16} color="#fff" />
                <Text style={styles.switchBtnText}>Client</Text>
              </TouchableOpacity>
            </LinearGradient>

            {Object.entries(groupedMerchantMenu).map(([section, items]: [string, any]) => (
              <View key={section}>
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>{section}</Text>
                {items.map((item: any) => renderMenuCard(item, () => navigateToMerchantRoute(item.route)))}
              </View>
            ))}
          </>
        ) : (
          <>
            {/* ─── CTA Commerçant (selon statut) ─── */}
            {(() => {
              const status = merchantProfile?.validationStatus;

              // Pas de merchant → Devenir commerçant (bannière dégradée)
              if (!merchantProfile) {
                return (
                  <TouchableOpacity activeOpacity={0.85} onPress={handleMerchantSignup}>
                    <LinearGradient colors={['#2563eb', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBanner}>
                      <View style={styles.ctaIcon}>
                        <Ionicons name="storefront" size={22} color="#fff" />
                      </View>
                      <View style={styles.ctaTextWrap}>
                        <Text style={styles.ctaTitle}>Devenir Commerçant</Text>
                        <Text style={styles.ctaSubtitle}>Développez votre activité</Text>
                      </View>
                      <View style={styles.proBadge}>
                        <Text style={styles.proBadgeText}>PRO</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
                    </LinearGradient>
                  </TouchableOpacity>
                );
              }

              // États intermédiaires → carte de statut
              const statusMap: Record<string, { icon: any; color: string; title: string; sub: string; onPress: () => void }> = {
                PENDING: { icon: 'time-outline', color: '#f59e0b', title: 'Demande en attente', sub: 'Validation sous 48h', onPress: switchToMerchant },
                REJECTED: {
                  icon: 'close-circle-outline',
                  color: '#ef4444',
                  title: 'Demande rejetée',
                  sub: merchantProfile.rejectionReason ?? 'Voir les détails',
                  onPress: switchToMerchant,
                },
                RESUBMIT_REQUIRED: {
                  icon: 'document-text-outline',
                  color: '#f59e0b',
                  title: 'Documents à compléter',
                  sub: 'Resoumission requise',
                  onPress: handleMerchantSignup,
                },
              };

              if (status && statusMap[status]) {
                const s = statusMap[status];
                return (
                  <TouchableOpacity
                    style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={s.onPress}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuIcon, { backgroundColor: s.color }]}>
                      <Ionicons name={s.icon} size={20} color="#fff" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={[styles.menuTitle, { color: s.color }]}>{s.title}</Text>
                      <Text style={[styles.menuDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                        {s.sub}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                );
              }

              // APPROVED → bannière espace commerçant
              return (
                <TouchableOpacity activeOpacity={0.85} onPress={switchToMerchant}>
                  <LinearGradient colors={['#2563eb', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBanner}>
                    <View style={styles.ctaIcon}>
                      <Ionicons name="storefront" size={22} color="#fff" />
                    </View>
                    <View style={styles.ctaTextWrap}>
                      <Text style={styles.ctaTitle}>Espace Commerçant</Text>
                      <Text style={styles.ctaSubtitle} numberOfLines={1}>
                        {merchantProfile.businessName || 'Accéder à mon espace'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              );
            })()}

            {/* ─── Services ─── */}
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Services</Text>
            {userMenuItems.map((item) => renderMenuCard(item, () => navigation.navigate(item.route)))}

            {/* ─── Compte ─── */}
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Compte</Text>
            {settingsMenuItems.map((item) => renderMenuCard(item, () => navigation.navigate(item.route)))}

            {/* ─── Administration ─── */}
            {adminMenuItems.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Administration</Text>
                {adminMenuItems.map((item) => renderMenuCard(item, () => navigation.navigate(item.route)))}
              </>
            )}

            {/* ─── Carte Premium ─── */}
            <TouchableOpacity
              style={[styles.proCard, { backgroundColor: `${colors.secondary}14`, borderColor: `${colors.secondary}30` }]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('premium')}
            >
              <View style={styles.proCardIcon}>
                <Ionicons name="ribbon" size={20} color="#f59e0b" />
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={[styles.menuTitle, { color: colors.text }]}>Plus avec M'Paye Pro</Text>
                <Text style={[styles.menuDesc, { color: colors.textSecondary }]}>Des outils avancés pour aller plus loin.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>

            {/* ─── Déconnexion ─── */}
            <TouchableOpacity
              style={[styles.logoutBtn, { borderColor: '#ef444455', backgroundColor: '#ef44440d' }]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
              <Text style={styles.logoutText}>Déconnexion</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* ─── Footer : mode sombre + paramètres ─── */}
      <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: insets.bottom > 0 ? insets.bottom : 14 }]}>
        <View style={styles.footerItem}>
          <Ionicons name={isDark ? 'moon' : 'moon-outline'} size={18} color={colors.textSecondary} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>Mode sombre</Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
            style={styles.footerSwitch}
          />
        </View>
        <TouchableOpacity style={styles.footerItem} onPress={() => navigation.navigate('settings')}>
          <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>Paramètres</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AppDrawer() {
  const { colors } = useTheme();
  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: colors.background, width: '100%' },
        drawerType: 'front',
        overlayColor: 'rgba(0,0,0,0.5)',
      }}
    >
      <Drawer.Screen name="dashboard" options={{ title: "M'Paye" }} />
      <Drawer.Screen name="portfolio" options={{ title: 'Portefeuille' }} />
      <Drawer.Screen name="qr-payment" options={{ title: 'QR Code' }} />
      <Drawer.Screen name="pay-link" options={{ title: 'Paiement', drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="transfers" options={{ title: 'Transferts' }} />
      <Drawer.Screen name="history" options={{ title: 'Historique' }} />
      <Drawer.Screen name="bills" options={{ title: 'Services' }} />
      <Drawer.Screen
        name="vehicle-rentals"
        options={{
          title: 'Location voiture',
          drawerIcon: ({ color, size }) => <Ionicons name="car-sport-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="tontines"
        options={{
          title: 'Tontines',
          drawerIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen name="transport-scolaire" options={{ title: 'Transport scolaire', drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="biller-webview" options={{ title: 'Service', drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="loyalty" options={{ title: 'Fidélité' }} />
      <Drawer.Screen name="beneficiaries" options={{ title: 'Bénéficiaires' }} />
      <Drawer.Screen name="profile" options={{ title: 'Mon Profil' }} />
      <Drawer.Screen name="settings" options={{ title: 'Paramètres' }} />
      <Drawer.Screen name="security" options={{ title: 'Sécurité' }} />
      <Drawer.Screen name="complete-profile" options={{ title: 'Compléter profil' }} />
      <Drawer.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Drawer.Screen name="merchant-signup" options={{ title: 'Devenir Commerçant' }} />
      <Drawer.Screen name="admin-payments" options={{ title: 'Validation paiements' }} />
      <Drawer.Screen name="admin-revenue" options={{ title: 'Revenus plateforme' }} />
      <Drawer.Screen name="premium" options={{ title: 'Premium' }} />
      <Drawer.Screen name="seller-mode" options={{ title: 'Recevoir un paiement' }} />
      <Drawer.Screen name="merchant/dashboard" options={{ title: 'Dashboard' }} />
      <Drawer.Screen name="merchant/scanner" options={{ title: 'Scanner QR' }} />
      <Drawer.Screen name="merchant/qrcode" options={{ title: 'QR Code' }} />
      <Drawer.Screen name="merchant/transactions" options={{ title: 'Transactions' }} />
      <Drawer.Screen name="merchant/store" options={{ title: 'Mes boutiques' }} />
      <Drawer.Screen name="merchant/products" options={{ title: 'Catalogue produits' }} />
      <Drawer.Screen name="merchant/employees" options={{ title: 'Équipe' }} />
      <Drawer.Screen name="merchant/coupons" options={{ title: 'Coupons' }} />
      <Drawer.Screen name="merchant/refunds" options={{ title: 'Remboursements' }} />
      <Drawer.Screen name="merchant/balance" options={{ title: 'Mon solde' }} />
      <Drawer.Screen name="merchant/withdraw" options={{ title: 'Retrait' }} />
      <Drawer.Screen name="merchant/analytics" options={{ title: 'Statistiques' }} />
      <Drawer.Screen name="merchant/reports" options={{ title: 'Rapports' }} />
      <Drawer.Screen name="merchant/profile" options={{ title: 'Mon entreprise' }} />
      <Drawer.Screen name="merchant/settings" options={{ title: 'Paramètres' }} />
      <Drawer.Screen name="merchant/help" options={{ title: 'Aide' }} />
      <Drawer.Screen name="trade-pay" options={{ title: 'Paiement', drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="oauth-consent" options={{ title: 'Autorisation', drawerItemStyle: { display: 'none' } }} />
    </Drawer>
  );
}

export default function AppLayout() {
  return <AppDrawer />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontSize: 20, fontWeight: '700' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  switchingText: { fontSize: 17, fontWeight: '600', marginTop: 18 },
  switchingSub: { fontSize: 13, marginTop: 6 },

  scroll: { flex: 1 },

  // ─── Carte profil ───
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  avatarImage: { width: '100%', height: '100%' },
  onlineBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2.5,
  },
  profileText: { flex: 1, marginLeft: 12, minWidth: 0 },
  profileName: { fontSize: 16, fontWeight: '700', marginBottom: 1 },
  profileEmail: { fontSize: 12, marginBottom: 5 },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#3b82f618',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  kycText: { color: '#3b82f6', fontSize: 10, fontWeight: '700' },

  // ─── CTA commerçant (bannière dégradée) ───
  ctaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaTextWrap: { flex: 1, minWidth: 0 },
  ctaTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ctaSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  proBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  proBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  switchBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // ─── Section ───
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 10,
    marginLeft: 4,
  },

  // ─── Carte d'item ───
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  menuIcon: { width: 44, height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuTextWrap: { flex: 1, minWidth: 0 },
  menuTitle: { fontSize: 15, fontWeight: '600' },
  menuDesc: { fontSize: 12, marginTop: 2 },

  // ─── Carte Pro ───
  proCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 18,
  },
  proCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#f59e0b22',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  // ─── Déconnexion ───
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
  },
  logoutText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },

  // ─── Footer ───
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerText: { fontSize: 13, fontWeight: '500' },
  footerSwitch: { transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] },
});

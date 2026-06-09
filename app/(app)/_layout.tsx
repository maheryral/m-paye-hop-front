// app/(app)/_layout.tsx
import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, Text, StyleSheet, Alert, View, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { resolveAssetUrl } from '../../src/services/api';
import { secureStorage } from '../../src/services/secureStorage';
import { useState, useEffect } from 'react';

function CustomDrawerContent({ navigation }: any) {
  const router = useRouter();
  const { logout, user } = useAuth();
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
      // response.data = { hasMerchant: boolean, merchant: {validationStatus, ...} | null }
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
      Alert.alert(
        'Espace commerçant indisponible',
        messages[status] || 'Statut inconnu',
      );
      return;
    }

    const merchantId = merchantProfile?.id;
    if (!merchantId) {
      Alert.alert('Erreur', 'Profil marchand introuvable.');
      return;
    }

    setIsSwitching(true);
    try {
      // 🔑 Demande au backend un JWT contenant activeMerchantId — nécessaire pour
      // les routes marchand (génération QR, etc.) qui lisent req.user.activeMerchantId.
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
      setTimeout(() => {
        setIsSwitching(false);
      }, 300);
    }
  };

  const switchToClient = async () => {
    setIsSwitching(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      setShowMerchantMenu(false);
      navigation.navigate('dashboard');
    } catch (error) {
      console.error('Erreur lors du basculement:', error);
    } finally {
      setTimeout(() => {
        setIsSwitching(false);
      }, 300);
    }
  };

  const navigateToMerchantRoute = (route: string) => {
    router.push(`/(app)/(tabs)/${route}` as any);
  };

  const userMenuItems = [
    { name: 'Accueil', route: 'dashboard', icon: 'home-outline', color: '#1e40af' },
    { name: 'Portefeuille', route: 'portfolio', icon: 'wallet-outline', color: '#3b82f6' },
    { name: 'QR Code', route: 'qr-payment', icon: 'qr-code-outline', color: '#1e40af' },
    { name: 'Recevoir un paiement', route: 'seller-mode', icon: 'cash-outline', color: '#10b981' },
    { name: 'Transferts', route: 'transfers', icon: 'send-outline', color: '#1e40af' },
    { name: 'Messages', route: 'messages', icon: 'chatbubbles-outline', color: '#3b82f6' },
    { name: 'Historique', route: 'history', icon: 'time-outline', color: '#64748b' },
    { name: 'Fidélité', route: 'loyalty', icon: 'gift-outline', color: '#8b5cf6' },
    { name: 'Services', route: 'bills', icon: 'apps-outline', color: '#8b5cf6' },
    { name: 'Bénéficiaires', route: 'beneficiaries', icon: 'people-outline', color: '#1e40af' },
    { name: 'Premium', route: 'premium', icon: 'star-outline', color: '#3b82f6' },
  ];

  const settingsMenuItems = [
    { name: 'Paramètres', route: 'settings', icon: 'settings-outline', color: '#64748b' },
    { name: 'Sécurité', route: 'security', icon: 'shield-outline', color: '#64748b' },
  ];

  const isAdmin = (user as any)?.role === 'ADMIN';
  const adminMenuItems = isAdmin ? [
    { name: 'Validation paiements', route: 'admin-payments', icon: 'shield-checkmark-outline', color: '#1e40af' },
    { name: 'Revenus plateforme', route: 'admin-revenue', icon: 'trending-up-outline', color: '#10b981' },
  ] : [];

  const merchantMenuItems = [
    { name: 'Dashboard', route: 'merchant/dashboard', icon: 'stats-chart-outline', color: '#1e40af', section: 'Gestion des ventes' },
    { name: 'Scanner QR', route: 'merchant/scanner', icon: 'scan-outline', color: '#3b82f6', section: 'Gestion des ventes' },
    { name: 'QR Code', route: 'merchant/qrcode', icon: 'qr-code-outline', color: '#1e40af', section: 'Gestion des ventes' },
    { name: 'Liens de paiement', route: 'merchant/payment-links', icon: 'link-outline', color: '#3b82f6', section: 'Gestion des ventes' },
    { name: 'Transactions', route: 'merchant/transactions', icon: 'list-outline', color: '#1e40af', section: 'Gestion des ventes' },
    { name: 'Mes boutiques', route: 'merchant/store', icon: 'storefront-outline', color: '#1e40af', section: 'Gestion du commerce' },
    { name: 'Catalogue produits', route: 'merchant/products', icon: 'cube-outline', color: '#3b82f6', section: 'Gestion du commerce' },
    { name: 'Équipe', route: 'merchant/employees', icon: 'people-outline', color: '#10b981', section: 'Gestion du commerce' },
    { name: 'Coupons', route: 'merchant/coupons', icon: 'pricetag-outline', color: '#1e40af', section: 'Gestion du commerce' },
    { name: 'Fidélité', route: 'merchant/loyalty', icon: 'gift-outline', color: '#8b5cf6', section: 'Gestion du commerce' },
    { name: 'Remboursements', route: 'merchant/refunds', icon: 'refresh-outline', color: '#ef4444', section: 'Gestion du commerce' },
    { name: 'Mon solde', route: 'merchant/balance', icon: 'cash-outline', color: '#3b82f6', section: 'Finances' },
    { name: 'Retrait', route: 'merchant/withdraw', icon: 'arrow-down-outline', color: '#1e40af', section: 'Finances' },
    { name: 'Statistiques', route: 'merchant/analytics', icon: 'trending-up-outline', color: '#1e40af', section: 'Finances' },
    { name: 'Rapports', route: 'merchant/reports', icon: 'document-text-outline', color: '#1e40af', section: 'Finances' },
    { name: 'Mon entreprise', route: 'merchant/profile', icon: 'business-outline', color: '#64748b', section: 'Configuration' },
    { name: 'Paramètres', route: 'merchant/settings', icon: 'settings-outline', color: '#64748b', section: 'Configuration' },
    { name: 'Aide', route: 'merchant/help', icon: 'help-circle-outline', color: '#64748b', section: 'Configuration' },
  ];

  const groupedMerchantMenu = merchantMenuItems.reduce((acc: any, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});

  if (loading) {
    return (
      <View style={styles.drawerContainer}>
        <View style={styles.drawerHeader}>
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Ionicons name="wallet-outline" size={28} color="#1e40af" />
            </View>
            <Text style={styles.logoText}>M'Paye</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      </View>
    );
  }

  if (isSwitching) {
    return (
      <View style={styles.drawerContainer}>
        <View style={styles.drawerHeader}>
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Ionicons name="wallet-outline" size={28} color="#1e40af" />
            </View>
            <Text style={styles.logoText}>M'Paye</Text>
          </View>
        </View>
        <View style={styles.switchingContainer}>
          <ActivityIndicator size="large" color="#1e40af" />
          <Text style={styles.switchingText}>Basculement en cours...</Text>
          <Text style={styles.switchingSubText}>Veuillez patienter</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.drawerContainer}>
      <View style={styles.drawerHeader}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Ionicons name="wallet-outline" size={28} color="#1e40af" />
          </View>
          <Text style={styles.logoText}>M'Paye</Text>
        </View>
      </View>

      <TouchableOpacity onPress={goToProfile} style={styles.userInfo} activeOpacity={0.7}>
        <View style={styles.avatar}>
          {user?.avatarUrl ? (
            <Image
              source={{ uri: resolveAssetUrl(user.avatarUrl) }}
              style={styles.avatarImage}
            />
          ) : (
            <Text style={styles.avatarText}>
              {user?.prenom?.[0] || user?.email?.[0] || 'U'}
              {user?.nom?.[0] || ''}
            </Text>
          )}
          <View style={styles.onlineBadge} />
        </View>
        <View style={styles.userInfoText}>
          <Text style={styles.userName}>
            {user?.prenom ? `${user.prenom} ${user.nom || ''}` : user?.email?.split('@')[0] || 'Utilisateur'}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>{user?.email}</Text>
          <View style={styles.kycBadge}>
            <Ionicons name="shield-checkmark" size={10} color="#3b82f6" />
            <Text style={styles.kycText}>KYC {user?.kycLevel || 'BASIC'}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#64748b" />
      </TouchableOpacity>

      <View style={styles.separator} />

      {showMerchantMenu ? (
        <>
          <View style={[styles.merchantBanner, { backgroundColor: '#1e40af15' }]}>
            <View style={[styles.merchantBannerIcon, { backgroundColor: '#1e40af20' }]}>
              <Ionicons name="storefront" size={24} color="#1e40af" />
            </View>
            <View style={styles.merchantBannerText}>
              <Text style={styles.merchantBannerTitle}>Espace Commerçant</Text>
              <Text style={styles.merchantBannerSubtitle}>
                {merchantProfile?.businessName || 'Mon entreprise'}
              </Text>
            </View>
            <TouchableOpacity onPress={switchToClient} style={styles.switchButton}>
              <Ionicons name="person-outline" size={18} color="#fff" />
              <Text style={styles.switchButtonText}>Client</Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {Object.entries(groupedMerchantMenu).map(([section, items]: [string, any]) => (
              <View key={section}>
                <Text style={styles.sectionTitle}>{section}</Text>
                {items.map((item: any) => (
                  <TouchableOpacity
                    key={item.route}
                    style={styles.menuItem}
                    onPress={() => navigateToMerchantRoute(item.route)}
                  >
                    <View style={[styles.menuIconContainer, { backgroundColor: `${item.color}20` }]}>
                      <Ionicons name={item.icon as any} size={22} color={item.color} />
                    </View>
                    <Text style={styles.menuItemText}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        </>
      ) : (
        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {(() => {
            const status = merchantProfile?.validationStatus;

            // Pas de merchant du tout → CTA inscription
            if (!merchantProfile) {
              return (
                <TouchableOpacity
                  style={[styles.menuItem, styles.merchantMenuItem]}
                  onPress={handleMerchantSignup}
                >
                  <View style={[styles.menuIconContainer, styles.merchantIcon]}>
                    <Ionicons name="storefront-outline" size={22} color="#1e40af" />
                  </View>
                  <Text style={[styles.menuItemText, styles.merchantText]}>
                    Devenir Commerçant
                  </Text>
                  <View style={styles.merchantBadge}>
                    <Text style={styles.merchantBadgeText}>PRO</Text>
                  </View>
                </TouchableOpacity>
              );
            }

            // En attente
            if (status === 'PENDING') {
              return (
                <TouchableOpacity
                  style={[styles.menuItem, styles.merchantMenuItem]}
                  onPress={switchToMerchant}
                >
                  <View style={[styles.menuIconContainer, { backgroundColor: '#f59e0b20' }]}>
                    <Ionicons name="time-outline" size={22} color="#f59e0b" />
                  </View>
                  <View style={styles.merchantInfo}>
                    <Text style={[styles.menuItemText, { color: '#f59e0b' }]}>
                      Demande en attente
                    </Text>
                    <Text style={styles.merchantStoreName} numberOfLines={1}>
                      Validation sous 48h
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }

            // Rejetée
            if (status === 'REJECTED') {
              return (
                <TouchableOpacity
                  style={[styles.menuItem, styles.merchantMenuItem]}
                  onPress={switchToMerchant}
                >
                  <View style={[styles.menuIconContainer, { backgroundColor: '#ef444420' }]}>
                    <Ionicons name="close-circle-outline" size={22} color="#ef4444" />
                  </View>
                  <View style={styles.merchantInfo}>
                    <Text style={[styles.menuItemText, { color: '#ef4444' }]}>
                      Demande rejetée
                    </Text>
                    <Text style={styles.merchantStoreName} numberOfLines={1}>
                      {merchantProfile.rejectionReason ?? 'Voir les détails'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }

            // Resoumission requise
            if (status === 'RESUBMIT_REQUIRED') {
              return (
                <TouchableOpacity
                  style={[styles.menuItem, styles.merchantMenuItem]}
                  onPress={handleMerchantSignup}
                >
                  <View style={[styles.menuIconContainer, { backgroundColor: '#f59e0b20' }]}>
                    <Ionicons name="document-text-outline" size={22} color="#f59e0b" />
                  </View>
                  <View style={styles.merchantInfo}>
                    <Text style={[styles.menuItemText, { color: '#f59e0b' }]}>
                      Documents à compléter
                    </Text>
                    <Text style={styles.merchantStoreName} numberOfLines={1}>
                      Resoumission requise
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }

            // APPROVED → accès complet
            return (
              <TouchableOpacity
                style={[styles.menuItem, styles.merchantMenuItem]}
                onPress={switchToMerchant}
              >
                <View style={[styles.menuIconContainer, styles.merchantIcon]}>
                  <Ionicons name="storefront-outline" size={22} color="#1e40af" />
                </View>
                <View style={styles.merchantInfo}>
                  <Text style={[styles.menuItemText, styles.merchantText]}>
                    Espace Commerçant
                  </Text>
                  {merchantProfile.businessName && (
                    <Text style={styles.merchantStoreName} numberOfLines={1}>
                      {merchantProfile.businessName}
                    </Text>
                  )}
                </View>
                <View style={styles.activeMerchantBadge}>
                  <Ionicons name="chevron-forward" size={16} color="#1e40af" />
                </View>
              </TouchableOpacity>
            );
          })()}

          <Text style={styles.sectionTitle}>Services</Text>
          {userMenuItems.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.menuItem}
              onPress={() => navigation.navigate(item.route)}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: `${item.color}20` }]}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <Text style={styles.menuItemText}>{item.name}</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.sectionTitle}>Paramètres</Text>
          {settingsMenuItems.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.menuItem}
              onPress={() => navigation.navigate(item.route)}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: `${item.color}20` }]}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <Text style={styles.menuItemText}>{item.name}</Text>
            </TouchableOpacity>
          ))}

          {adminMenuItems.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Administration</Text>
              {adminMenuItems.map((item) => (
                <TouchableOpacity
                  key={item.route}
                  style={styles.menuItem}
                  onPress={() => navigation.navigate(item.route)}
                >
                  <View style={[styles.menuIconContainer, { backgroundColor: `${item.color}20` }]}>
                    <Ionicons name={item.icon as any} size={22} color={item.color} />
                  </View>
                  <Text style={styles.menuItemText}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <View style={styles.separator} />
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <View style={styles.logoutIconContainer}>
            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          </View>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AppLayout() {
  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: '#1e293b', width: '100%' },
        drawerType: 'front',
        overlayColor: 'rgba(0,0,0,0.5)',
      }}
    >
      <Drawer.Screen name="dashboard" options={{ title: "M'Paye" }} />
      <Drawer.Screen name="portfolio" options={{ title: 'Portefeuille' }} />
      <Drawer.Screen name="qr-payment" options={{ title: 'QR Code' }} />
      <Drawer.Screen
        name="pay-link"
        options={{ title: 'Paiement', drawerItemStyle: { display: 'none' } }}
      />
      <Drawer.Screen name="transfers" options={{ title: 'Transferts' }} />
      <Drawer.Screen name="history" options={{ title: 'Historique' }} />
      <Drawer.Screen name="bills" options={{ title: 'Services' }} />
      <Drawer.Screen
        name="vehicle-rentals"
        options={{
          title: 'Location voiture',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="car-sport-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="transport-scolaire"
        options={{ title: 'Transport scolaire', drawerItemStyle: { display: 'none' } }}
      />
      {/* Écran WebView ouvert depuis Bills — caché du drawer */}
      <Drawer.Screen
        name="biller-webview"
        options={{
          title: 'Service',
          drawerItemStyle: { display: 'none' },
        }}
      />
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
      {/* OAuth Partners — pages ouvertes via deep-link, cachées du drawer */}
      <Drawer.Screen
        name="trade-pay"
        options={{ title: 'Paiement', drawerItemStyle: { display: 'none' } }}
      />
      <Drawer.Screen
        name="oauth-consent"
        options={{ title: 'Autorisation', drawerItemStyle: { display: 'none' } }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  drawerContainer: { flex: 1, backgroundColor: '#1e293b' },
  drawerHeader: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#334155' },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1e40af20', justifyContent: 'center', alignItems: 'center' },
  logoText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  switchingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  switchingText: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 20 },
  switchingSubText: { color: '#94a3b8', fontSize: 14, marginTop: 8 },
  userInfo: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, backgroundColor: '#33415530', marginHorizontal: 16, marginTop: 16, marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1e40af', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  avatarImage: { width: '100%', height: '100%' },
  onlineBadge: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#3b82f6', borderWidth: 2, borderColor: '#1e293b' },
  userInfoText: { flex: 1, marginLeft: 12 },
  userName: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 2 },
  userEmail: { color: '#94a3b8', fontSize: 12, marginBottom: 4 },
  kycBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#3b82f620', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, alignSelf: 'flex-start' },
  kycText: { color: '#3b82f6', fontSize: 10, fontWeight: '500' },
  separator: { height: 1, backgroundColor: '#334155', marginHorizontal: 16, marginVertical: 12 },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  sectionTitle: { color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 20, marginTop: 16, marginBottom: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, marginHorizontal: 12, borderRadius: 12 },
  menuIconContainer: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  menuItemText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  footer: { marginTop: 'auto', marginBottom: 30 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, marginHorizontal: 16, borderRadius: 12, backgroundColor: '#ef444420' },
  logoutIconContainer: { width: 36, alignItems: 'center' },
  logoutText: { color: '#ef4444', fontSize: 15, fontWeight: '500', marginLeft: 8 },
  merchantBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, marginBottom: 16, padding: 12, borderRadius: 16, gap: 12 },
  merchantBannerIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  merchantBannerText: { flex: 1 },
  merchantBannerTitle: { color: '#1e40af', fontSize: 14, fontWeight: '600' },
  merchantBannerSubtitle: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  switchButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e40af', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
  switchButtonText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  merchantMenuItem: { backgroundColor: '#1e40af10', marginTop: 4, marginBottom: 8 },
  merchantIcon: { backgroundColor: '#1e40af20' },
  merchantText: { color: '#1e40af', fontWeight: '600' },
  merchantInfo: { flex: 1, marginLeft: 8 },
  merchantStoreName: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  activeMerchantBadge: { marginLeft: 'auto' },
  merchantBadge: { backgroundColor: '#1e40af', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 'auto' },
  merchantBadgeText: { color: '#1e293b', fontSize: 10, fontWeight: 'bold' },
});
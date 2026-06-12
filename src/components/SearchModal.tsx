// src/components/SearchModal.tsx
// Recherche réelle : services (billers) + pages de l'app. Ouverte depuis
// l'icône recherche du dashboard.
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { billersApi, type PublicBiller } from '../services/billersApi';

type Page = { label: string; route: string; icon: keyof typeof Ionicons.glyphMap; kw?: string };
const PAGES: Page[] = [
  { label: 'Tableau de bord', route: '/dashboard', icon: 'home-outline', kw: 'accueil' },
  { label: 'Portefeuille', route: '/portfolio', icon: 'wallet-outline', kw: 'dépôt retrait recharge carte' },
  { label: 'Transferts', route: '/transfers', icon: 'send-outline', kw: 'envoyer argent' },
  { label: 'Historique', route: '/history', icon: 'time-outline', kw: 'transactions reçu' },
  { label: 'Services', route: '/bills', icon: 'apps-outline', kw: 'factures' },
  { label: 'Bénéficiaires', route: '/beneficiaries', icon: 'people-outline', kw: 'contacts' },
  { label: 'Scanner QR', route: '/qr-payment', icon: 'qr-code-outline', kw: 'payer scan code' },
  { label: 'Recevoir un paiement', route: '/seller-mode', icon: 'cash-outline', kw: 'vendeur encaisser' },
  { label: 'Fidélité', route: '/loyalty', icon: 'gift-outline', kw: 'points récompenses' },
  { label: 'Notifications', route: '/notifications', icon: 'notifications-outline', kw: 'alertes' },
  { label: 'Premium', route: '/premium', icon: 'star-outline', kw: 'cashback avantages' },
  { label: 'Paramètres', route: '/settings', icon: 'settings-outline', kw: 'préférences thème' },
  { label: 'Sécurité', route: '/security', icon: 'shield-outline', kw: 'mot de passe pin' },
  { label: 'Profil', route: '/profile', icon: 'person-outline', kw: 'compte' },
];

export default function SearchModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [billers, setBillers] = useState<PublicBiller[]>([]);
  const [launching, setLaunching] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setQ('');
    billersApi
      .list()
      .then((r) => setBillers(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, [visible]);

  const query = q.trim().toLowerCase();
  const pageHits = query
    ? PAGES.filter((p) => `${p.label} ${p.kw ?? ''}`.toLowerCase().includes(query)).slice(0, 6)
    : [];
  const billerHits = query
    ? billers
        .filter((b) =>
          `${b.name} ${b.description ?? ''} ${b.serviceType?.label ?? ''}`
            .toLowerCase()
            .includes(query),
        )
        .slice(0, 8)
    : [];

  const openBiller = async (b: PublicBiller) => {
    if (b.integrationType === 'NATIVE') {
      onClose();
      try {
        router.push(b.redirectPath as any);
      } catch {
        Alert.alert('Erreur', `Impossible d'ouvrir "${b.redirectPath}"`);
      }
      return;
    }
    setLaunching(b.id);
    try {
      const r = await billersApi.launchToken(b.id);
      onClose();
      router.push({
        pathname: '/biller-webview',
        params: { url: r.data.url, name: b.name, color: b.color || '#6366F1' },
      } as any);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message ?? "Impossible d'ouvrir le service");
    } finally {
      setLaunching(null);
    }
  };

  const goPage = (route: string) => {
    onClose();
    router.push(route as any);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          {/* Barre de recherche */}
          <View style={styles.searchRow}>
            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput
                autoFocus
                value={q}
                onChangeText={setQ}
                placeholder="Rechercher un service, une page…"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text }]}
                returnKeyType="search"
              />
              {q.length > 0 && (
                <TouchableOpacity onPress={() => setQ('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={[styles.cancel, { color: colors.primary }]}>Annuler</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {query.length === 0 ? (
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                Tape pour chercher un service ou une page.
              </Text>
            ) : pageHits.length === 0 && billerHits.length === 0 ? (
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                Aucun résultat pour « {q.trim()} ».
              </Text>
            ) : (
              <>
                {billerHits.length > 0 && (
                  <Text style={[styles.section, { color: colors.textTertiary }]}>SERVICES</Text>
                )}
                {billerHits.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}
                    onPress={() => openBiller(b)}
                    disabled={!!launching}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: b.color || '#2563eb' }]}>
                      <Text style={styles.rowIconTxt}>{b.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                        {b.name}
                      </Text>
                      <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>
                        {b.serviceType?.label ?? 'Service'}
                      </Text>
                    </View>
                    {launching === b.id ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    )}
                  </TouchableOpacity>
                ))}

                {pageHits.length > 0 && (
                  <Text
                    style={[
                      styles.section,
                      { color: colors.textTertiary, marginTop: billerHits.length ? 12 : 0 },
                    ]}
                  >
                    PAGES
                  </Text>
                )}
                {pageHits.map((p) => (
                  <TouchableOpacity
                    key={p.route}
                    style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}
                    onPress={() => goPage(p.route)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: `${colors.primary}20` }]}>
                      <Ionicons name={p.icon} size={16} color={colors.primary} />
                    </View>
                    <Text style={[styles.rowTitle, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                      {p.label}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14, padding: 0 },
  cancel: { fontSize: 14, fontWeight: '600' },
  body: { padding: 16, gap: 8 },
  hint: { fontSize: 13, textAlign: 'center', marginTop: 24 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  rowIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  rowIconTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 11, marginTop: 2 },
});

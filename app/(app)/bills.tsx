// app/(app)/bills.tsx
// Page Services & Factures — 100 % dynamique depuis /billers (gérés par l'admin).
// Click → ouvre le mini-program web dans un écran WebView plein écran.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import GradientHeader from '../../src/components/GradientHeader';
import {
  billersApi,
  type PublicBiller,
  type PublicServiceType,
} from '../../src/services/billersApi';

/**
 * Convertit un nom d'icône (lucide / lucide-react) reçu du backend en icône
 * Ionicons (set utilisé côté mobile). Tableau de correspondances pour les
 * icônes les plus courantes ; fallback sur 'apps-outline'.
 */
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
  };
  return map[name] || 'apps-outline';
}

export default function Bills() {
  const router = useRouter();
  const { colors } = useTheme();

  const [billers, setBillers] = useState<PublicBiller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await billersApi.list();
      setBillers(Array.isArray(r.data) ? r.data : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Impossible de charger les services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Regroupe par type de service, en respectant les sortOrder. */
  const grouped = useMemo(() => {
    const groups = new Map<
      string,
      { type: PublicServiceType; items: PublicBiller[] }
    >();
    for (const b of billers) {
      const key = b.serviceType.id;
      const existing = groups.get(key);
      if (existing) existing.items.push(b);
      else groups.set(key, { type: b.serviceType, items: [b] });
    }
    return Array.from(groups.values()).sort(
      (a, b) => a.type.sortOrder - b.type.sortOrder,
    );
  }, [billers]);

  /**
   * Click sur un biller — deux comportements selon `integrationType` :
   *   • NATIVE → navigation directe vers un écran RN existant (taxi-brousse,
   *     téléphérique, etc.). Pas de WebView, pas de token.
   *   • WEB    → demande un launch-token au backend, puis ouvre l'URL en
   *     WebView plein écran (BillerWebView).
   */
  async function openBiller(b: PublicBiller) {
    if (launchingId) return;

    // Native : on push direct, c'est tout.
    if (b.integrationType === 'NATIVE') {
      try {
        router.push(b.redirectPath as any);
      } catch (e: any) {
        Alert.alert(
          'Erreur',
          `Impossible d'ouvrir "${b.redirectPath}" — vérifiez que l'écran existe dans l'app.`,
        );
      }
      return;
    }

    // WEB : token éphémère + WebView plein écran
    setLaunchingId(b.id);
    try {
      const r = await billersApi.launchToken(b.id);
      router.push({
        pathname: '/biller-webview',
        params: {
          url: r.data.url,
          name: b.name,
          color: b.color || '#6366F1',
        },
      });
    } catch (e: any) {
      Alert.alert(
        'Erreur',
        e?.response?.data?.message || 'Impossible d\'ouvrir le service',
      );
    } finally {
      setLaunchingId(null);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title="Services & Factures"
        subtitle="Tous vos services en un seul endroit"
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={[styles.errorCard, { borderColor: colors.border }]}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.textSecondary} />
            <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
            <TouchableOpacity onPress={load} style={styles.retryBtn}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : grouped.length === 0 ? (
          <View style={[styles.errorCard, { borderColor: colors.border }]}>
            <Ionicons name="apps-outline" size={32} color={colors.textSecondary} />
            <Text style={[styles.errorText, { color: colors.text }]}>
              Aucun service disponible pour le moment.
            </Text>
          </View>
        ) : (
          grouped.map((group) => {
            const typeColor = group.type.color || '#6366F1';
            return (
            <View key={group.type.id} style={{ marginBottom: 28 }}>
              {/* En-tête type — large, coloré, avec séparateur */}
              <View
                style={[
                  styles.groupHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.groupIcon,
                    { backgroundColor: typeColor + '22' },
                  ]}
                >
                  <Ionicons
                    name={lucideToIonicons(group.type.iconName)}
                    size={20}
                    color={typeColor}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.groupLabel, { color: colors.text }]}>
                    {group.type.label}
                  </Text>
                  <Text style={[styles.groupCount, { color: colors.textSecondary }]}>
                    {group.items.length} service{group.items.length > 1 ? 's' : ''}{' '}
                    disponible{group.items.length > 1 ? 's' : ''}
                  </Text>
                </View>
              </View>

              {/* Grille de billers */}
              <View style={styles.grid}>
                {group.items.map((b) => {
                  const isLaunching = launchingId === b.id;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[
                        styles.billerCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          opacity: launchingId && !isLaunching ? 0.5 : 1,
                        },
                      ]}
                      onPress={() => openBiller(b)}
                      disabled={!!launchingId}
                    >
                      <View style={styles.billerIconWrap}>
                        {b.logoUrl ? (
                          <Image
                            source={{ uri: b.logoUrl }}
                            style={styles.billerLogo}
                            resizeMode="contain"
                          />
                        ) : (
                          <View
                            style={[
                              styles.billerIconBg,
                              { backgroundColor: b.color || '#6366F1' },
                            ]}
                          >
                            <Ionicons
                              name={lucideToIonicons(b.iconName)}
                              size={20}
                              color="#fff"
                            />
                          </View>
                        )}
                        {isLaunching && (
                          <View style={styles.billerLoading}>
                            <ActivityIndicator size="small" color="#fff" />
                          </View>
                        )}
                      </View>
                      <Text
                        style={[styles.billerName, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {b.name}
                      </Text>
                      {b.description ? (
                        <Text
                          style={[
                            styles.billerDesc,
                            { color: colors.textSecondary },
                          ]}
                          numberOfLines={2}
                        >
                          {b.description}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  errorCard: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  errorText: { fontSize: 14, textAlign: 'center' },
  retryBtn: { marginTop: 8, padding: 8 },

  // Groupes
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  groupIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupLabel: { fontSize: 14, fontWeight: '700' },
  groupCount: { fontSize: 12 },

  // Grille
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  billerCard: {
    width: '48%',
    margin: '1%',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  billerIconWrap: {
    width: 44,
    height: 44,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  billerIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billerLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  billerLoading: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  billerName: { fontSize: 13, fontWeight: '700' },
  billerDesc: { fontSize: 11, marginTop: 2 },
});

// src/components/ServicesScroller.tsx
// Composant réutilisable utilisé dans le dashboard mobile :
//   1. Scroll horizontal de "chips" : Home Apps + chaque type de service actif
//   2. Grille en-dessous : billers filtrés par chip actif
//      - "Home Apps"   → billers.filter(b => b.isEssential)
//      - <typeId>      → billers.filter(b => b.serviceType.id === typeId)
//   3. La grille est limitée à `maxItems` (défaut 7) + une tuile "Tout" qui
//      navigue vers /bills (page Services & Factures complète).

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import {
  billersApi,
  type PublicBiller,
  type PublicServiceType,
} from '../services/billersApi';

// Catégorie virtuelle "Home Apps" (services essentiels, scope cross-types).
const HOME_APPS_KEY = '__HOME_APPS__';

/** lucide-react → Ionicons (mêmes correspondances que page Services). */
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
    Star: 'star',
  };
  return map[name] || 'apps-outline';
}

export default function ServicesScroller({ maxItems = 7 }: { maxItems?: number }) {
  const router = useRouter();
  const { colors } = useTheme();

  const [billers, setBillers] = useState<PublicBiller[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChip, setActiveChip] = useState<string>(HOME_APPS_KEY);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    billersApi
      .list()
      .then((r) => {
        if (!cancelled) setBillers(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => {
        // silencieux : si le backend est down, la section reste vide
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Liste unique des types de service trouvés dans les billers, triés.
  const types = useMemo<PublicServiceType[]>(() => {
    const seen = new Map<string, PublicServiceType>();
    for (const b of billers) {
      if (!seen.has(b.serviceType.id)) seen.set(b.serviceType.id, b.serviceType);
    }
    return Array.from(seen.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [billers]);

  // Billers à afficher selon le chip actif.
  const filtered = useMemo<PublicBiller[]>(() => {
    if (activeChip === HOME_APPS_KEY) {
      return billers.filter((b) => b.isEssential);
    }
    return billers.filter((b) => b.serviceType.id === activeChip);
  }, [billers, activeChip]);

  // Limite + tuile "Tout"
  const displayed = filtered.slice(0, maxItems);
  const showTout = filtered.length > maxItems || displayed.length > 0;

  async function openBiller(b: PublicBiller) {
    if (launchingId) return;
    if (b.integrationType === 'NATIVE') {
      try {
        router.push(b.redirectPath as any);
      } catch {
        Alert.alert(
          'Erreur',
          `Impossible d'ouvrir "${b.redirectPath}" — vérifiez que l'écran existe dans l'app.`,
        );
      }
      return;
    }
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
        e?.response?.data?.message || "Impossible d'ouvrir le service",
      );
    } finally {
      setLaunchingId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  // Le chip "Home Apps" est toujours affiché, même si aucun biller n'a encore
  // été configuré par l'admin — pour que la section reste prévisible visuellement.

  return (
    <View style={{ marginVertical: 12 }}>
      {/* "Home Apps" reste fixe à gauche ; les autres types scrollent
          horizontalement dans leur propre ScrollView. */}
      <View style={styles.chipsContainer}>
        <View style={styles.chipsFixed}>
          <Chip
            label="Home Apps"
            iconName="star"
            color="#FBBF24"
            active={activeChip === HOME_APPS_KEY}
            onPress={() => setActiveChip(HOME_APPS_KEY)}
            textColor={colors.text}
            borderColor={colors.border}
            cardBg={colors.card}
          />
        </View>
        {types.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScrollable}
            style={{ flex: 1 }}
          >
            {types.map((t) => (
              <Chip
                key={t.id}
                label={t.label}
                iconName={lucideToIonicons(t.iconName)}
                color={t.color || '#6366F1'}
                active={activeChip === t.id}
                onPress={() => setActiveChip(t.id)}
                textColor={colors.text}
                borderColor={colors.border}
                cardBg={colors.card}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Grille */}
      {filtered.length === 0 ? (
        <View style={[styles.emptyBox, { borderColor: colors.border }]}>
          <Ionicons name="apps-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {activeChip === HOME_APPS_KEY
              ? 'Aucun service essentiel pour le moment'
              : 'Aucun service dans cette catégorie'}
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {displayed.map((b) => {
            const isLaunching = launchingId === b.id;
            return (
              <TouchableOpacity
                key={b.id}
                style={[
                  styles.cell,
                  {
                    opacity: launchingId && !isLaunching ? 0.5 : 1,
                  },
                ]}
                onPress={() => openBiller(b)}
                disabled={!!launchingId}
              >
                {b.logoUrl ? (
                  <Image
                    source={{ uri: b.logoUrl }}
                    style={[styles.cellLogo, { backgroundColor: '#fff' }]}
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    style={[
                      styles.cellIcon,
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
                  <View style={styles.cellLoading}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
                <Text
                  style={[styles.cellLabel, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {b.name}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Tuile "Tout" → page Services & Factures */}
          {showTout && (
            <TouchableOpacity
              style={styles.cell}
              onPress={() => router.push('/bills' as any)}
            >
              <View
                style={[
                  styles.cellIcon,
                  {
                    backgroundColor: colors.background,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="grid-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <Text
                style={[styles.cellLabel, { color: colors.primary }]}
                numberOfLines={1}
              >
                Tout
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function Chip({
  label,
  iconName,
  color,
  active,
  onPress,
  textColor,
  borderColor,
  cardBg,
}: {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  color: string;
  active: boolean;
  onPress: () => void;
  textColor: string;
  borderColor: string;
  cardBg: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? color + '22' : cardBg,
          borderColor: active ? color : borderColor,
        },
      ]}
    >
      <Ionicons name={iconName} size={14} color={active ? color : textColor} />
      <Text
        style={[
          styles.chipLabel,
          { color: active ? color : textColor, fontWeight: active ? '700' : '500' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  loading: { padding: 16, alignItems: 'center' },

  chipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  chipsFixed: { flexShrink: 0 },
  chipsScrollable: { gap: 8, paddingRight: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipLabel: { fontSize: 12 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  cell: {
    width: '25%', // 4 colonnes
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  cellIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  cellLogo: {
    width: 48,
    height: 48,
    borderRadius: 14,
    marginBottom: 6,
  },
  cellLoading: {
    position: 'absolute',
    top: 8,
    left: 4,
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellLabel: { fontSize: 11, textAlign: 'center', maxWidth: 80 },

  emptyBox: {
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 6,
  },
  emptyText: { fontSize: 12, textAlign: 'center' },
});

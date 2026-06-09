// app/(app)/vehicle-rentals/index.tsx
// Liste / recherche des annonces de location de voiture (phase 1 : lecture seule).
//
// Filtres : ville, type, avec/sans chauffeur, places min, prix max.
// Tri serveur : prix croissant.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import GradientHeader from '../../../src/components/GradientHeader';
import { vehicleRentalService, resolveAssetUrl } from '../../../src/services/api';

interface Listing {
  id: string;
  city: string;
  pricePerDay: number | string;
  withDriver: boolean;
  deposit: number | string;
  minDays: number;
  notes?: string | null;
  vehicle: {
    id: string;
    brand: string;
    model: string;
    type: string;
    seats: number;
    hasAC: boolean;
    transmission: string;
    fuel: string;
    photos?: string[] | null;
    description?: string | null;
  };
  partner: {
    id: string;
    name: string;
    logoUrl?: string | null;
    city: string;
    phone: string;
  };
}

type DriverFilter = 'all' | 'with' | 'self';

const TYPES: { key: string; label: string; icon: any }[] = [
  { key: '', label: 'Tous', icon: 'car-outline' },
  { key: '4x4', label: '4×4', icon: 'car-sport-outline' },
  { key: 'sedan', label: 'Berline', icon: 'car-outline' },
  { key: 'suv', label: 'SUV', icon: 'car-outline' },
  { key: 'minibus', label: 'Minibus', icon: 'bus-outline' },
  { key: 'city', label: 'Citadine', icon: 'car-outline' },
];

export default function VehicleRentals() {
  const router = useRouter();
  const { colors } = useTheme();

  const [items, setItems] = useState<Listing[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtres
  const [city, setCity] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [driverFilter, setDriverFilter] = useState<DriverFilter>('all');

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params: any = {};
      if (city) params.city = city;
      if (typeFilter) params.type = typeFilter;
      if (driverFilter === 'with') params.withDriver = true;
      if (driverFilter === 'self') params.withDriver = false;
      const res = await vehicleRentalService.search(params);
      setItems(res?.items || []);
    } catch (e) {
      // silent — affiche liste vide
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Premier chargement + à chaque changement de filtre
  useEffect(() => {
    load();
  }, [city, typeFilter, driverFilter]);

  // Liste des villes en autocomplete (chargée une fois)
  useEffect(() => {
    vehicleRentalService.cities().then((c) => setCities(Array.isArray(c) ? c : [])).catch(() => {});
  }, []);

  const formatPrice = (p: number | string) => {
    const n = Number(p);
    return n.toLocaleString('fr-FR') + ' Ar';
  };

  const renderCard = ({ item }: { item: Listing }) => {
    const photo = item.vehicle.photos?.[0];
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push(`/vehicle-rentals/${item.id}` as any)}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {photo ? (
          <Image source={{ uri: resolveAssetUrl(photo) }} style={styles.cardPhoto} />
        ) : (
          <View style={[styles.cardPhotoPlaceholder, { backgroundColor: `${colors.primary}15` }]}>
            <Ionicons name="car-sport-outline" size={40} color={colors.primary} />
          </View>
        )}

        <View style={styles.cardBody}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {item.vehicle.brand} {item.vehicle.model}
            </Text>
            {item.withDriver ? (
              <View style={[styles.badge, { backgroundColor: `${colors.success}20` }]}>
                <Ionicons name="person" size={10} color={colors.success} />
                <Text style={[styles.badgeText, { color: colors.success }]}>Avec chauffeur</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: `${colors.primary}20` }]}>
                <Ionicons name="key-outline" size={10} color={colors.primary} />
                <Text style={[styles.badgeText, { color: colors.primary }]}>Self-drive</Text>
              </View>
            )}
          </View>

          <View style={styles.cardSpecs}>
            <Spec icon="people-outline" label={`${item.vehicle.seats} pl.`} colors={colors} />
            <Spec
              icon={item.vehicle.transmission === 'automatic' ? 'sync-outline' : 'cog-outline'}
              label={item.vehicle.transmission === 'automatic' ? 'Auto' : 'Manuelle'}
              colors={colors}
            />
            {item.vehicle.hasAC && <Spec icon="snow-outline" label="Clim" colors={colors} />}
            <Spec icon="location-outline" label={item.city} colors={colors} />
          </View>

          <View style={styles.cardFooter}>
            <View>
              <Text style={[styles.partnerName, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.partner.name}
              </Text>
              <Text style={[styles.price, { color: colors.text }]}>
                {formatPrice(item.pricePerDay)}
                <Text style={[styles.priceUnit, { color: colors.textSecondary }]}> /jour</Text>
              </Text>
            </View>
            <View style={[styles.cta, { backgroundColor: colors.primary }]}>
              <Text style={styles.ctaText}>Détails</Text>
              <Ionicons name="chevron-forward" size={14} color="#fff" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title="Location voiture"
        subtitle="Avec ou sans chauffeur"
        rightIcon="receipt-outline"
        onRightPress={() => router.push('/vehicle-rentals/my-bookings' as any)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.content}>
          {/* Filtres ville */}
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Ville de prise en charge..."
              placeholderTextColor={colors.textSecondary}
              value={city}
              onChangeText={setCity}
              autoCorrect={false}
            />
            {city.length > 0 && (
              <TouchableOpacity onPress={() => setCity('')}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Suggestions villes — uniquement si pas de saisie en cours */}
          {!city && cities.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cityChipsRow}>
              {cities.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCity(c)}
                  style={[styles.cityChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                  <Text style={[styles.cityChipText, { color: colors.text }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Toggle With Driver / Self-drive */}
          <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {([
              { key: 'all' as DriverFilter, label: 'Tous' },
              { key: 'with' as DriverFilter, label: 'Avec chauffeur' },
              { key: 'self' as DriverFilter, label: 'Self-drive' },
            ]).map((opt) => {
              const active = driverFilter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setDriverFilter(opt.key)}
                  style={[
                    styles.toggleBtn,
                    active && { backgroundColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      { color: active ? '#fff' : colors.textSecondary, fontWeight: active ? '700' : '500' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Type véhicule */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typesRow}>
            {TYPES.map((t) => {
              const active = typeFilter === t.key;
              return (
                <TouchableOpacity
                  key={t.key || 'all'}
                  onPress={() => setTypeFilter(t.key)}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: active ? `${colors.primary}25` : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Ionicons name={t.icon} size={14} color={active ? colors.primary : colors.textSecondary} />
                  <Text
                    style={[
                      styles.typeText,
                      { color: active ? colors.primary : colors.textSecondary, fontWeight: active ? '700' : '500' },
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Liste */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="car-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucune annonce</Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                Essayez d'élargir vos filtres ou de changer de ville.
              </Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(it) => it.id}
              renderItem={renderCard}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Spec({ icon, label, colors }: { icon: any; label: string; colors: any }) {
  return (
    <View style={styles.spec}>
      <Ionicons name={icon} size={12} color={colors.textSecondary} />
      <Text style={[styles.specText, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },

  cityChipsRow: { marginTop: 10 },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 8,
  },
  cityChipText: { fontSize: 12, fontWeight: '500' },

  toggleRow: {
    flexDirection: 'row',
    marginTop: 14,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleText: { fontSize: 12 },

  typesRow: { marginTop: 12, marginBottom: 4 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  typeText: { fontSize: 12 },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 14,
  },
  cardPhoto: { width: '100%', height: 140 },
  cardPhotoPlaceholder: { width: '100%', height: 140, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 14 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },

  cardSpecs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  spec: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  specText: { fontSize: 11 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  partnerName: { fontSize: 11 },
  price: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  priceUnit: { fontSize: 12, fontWeight: '500' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  ctaText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  loadingBox: { paddingVertical: 40, alignItems: 'center' },
  emptyBox: { paddingVertical: 48, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyHint: { fontSize: 13, textAlign: 'center', paddingHorizontal: 30 },
});

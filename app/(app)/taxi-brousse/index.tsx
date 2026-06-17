// app/(app)/taxi-brousse/index.tsx — Recherche de voyages taxi-brousse
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../../src/contexts/ThemeContext';
import {
  taxiBrousseApi,
  VoyageSearchResult,
} from '../../../src/services/taxiBrousseApi';

export default function TaxiBrousseSearch() {
  const router = useRouter();
  const { colors } = useTheme();

  const [depart, setDepart] = useState('');
  const [arrivee, setArrivee] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<VoyageSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prochains départs (à venir, places dispo) — affichés par défaut
  const [upcoming, setUpcoming] = useState<VoyageSearchResult[]>([]);
  const [loadingUp, setLoadingUp] = useState(true);

  // Autocomplete villes
  const [departSugg, setDepartSugg] = useState<string[]>([]);
  const [arriveeSugg, setArriveeSugg] = useState<string[]>([]);
  const [activeField, setActiveField] = useState<'depart' | 'arrivee' | null>(
    null,
  );
  const departDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arriveeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (departDebounce.current) clearTimeout(departDebounce.current);
    if (!depart.trim() || activeField !== 'depart') {
      setDepartSugg([]);
      return;
    }
    departDebounce.current = setTimeout(async () => {
      try {
        const res = await taxiBrousseApi.suggestCities(depart.trim(), 'depart');
        setDepartSugg(res.data);
      } catch {
        setDepartSugg([]);
      }
    }, 300);
    return () => {
      if (departDebounce.current) clearTimeout(departDebounce.current);
    };
  }, [depart, activeField]);

  useEffect(() => {
    if (arriveeDebounce.current) clearTimeout(arriveeDebounce.current);
    if (!arrivee.trim() || activeField !== 'arrivee') {
      setArriveeSugg([]);
      return;
    }
    arriveeDebounce.current = setTimeout(async () => {
      try {
        const res = await taxiBrousseApi.suggestCities(arrivee.trim(), 'arrivee');
        setArriveeSugg(res.data);
      } catch {
        setArriveeSugg([]);
      }
    }, 300);
    return () => {
      if (arriveeDebounce.current) clearTimeout(arriveeDebounce.current);
    };
  }, [arrivee, activeField]);

  // Charge les prochains départs (places dispo, à venir)
  useEffect(() => {
    (async () => {
      setLoadingUp(true);
      try {
        const res = await taxiBrousseApi.searchVoyages('', '');
        const list = Array.isArray(res.data) ? res.data : [];
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        setUpcoming(
          list
            .filter((v) => (v.placesDisponibles?.placeLibre ?? 0) > 0)
            .filter((v) => {
              const d = new Date(v.dateDepart);
              return isNaN(d.getTime()) || d >= startOfToday;
            }),
        );
      } catch {
        setUpcoming([]);
      } finally {
        setLoadingUp(false);
      }
    })();
  }, []);

  const pickSuggestion = (which: 'depart' | 'arrivee', value: string) => {
    if (which === 'depart') {
      setDepart(value);
      setDepartSugg([]);
    } else {
      setArrivee(value);
      setArriveeSugg([]);
    }
    setActiveField(null);
    Keyboard.dismiss();
  };

  const handleSearch = async () => {
    if (!depart.trim() || !arrivee.trim()) {
      setError('Veuillez remplir départ et arrivée');
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const isoDate = date.toISOString().split('T')[0];
      const response = await taxiBrousseApi.searchVoyages(
        depart.trim(),
        arrivee.trim(),
        isoDate,
      );
      setResults(response.data);
    } catch (e: any) {
      console.error('Search error:', e?.response?.data || e?.message);
      setError(
        e?.response?.data?.message ||
          'Impossible de rechercher les voyages',
      );
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const swapCities = () => {
    const tmp = depart;
    setDepart(arrivee);
    setArrivee(tmp);
  };

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('fr-FR').format(n) + ' Ar';

  // Carte voyage réutilisable (résultats + prochains départs)
  const renderVoyage = (v: VoyageSearchResult) => (
    <TouchableOpacity
      key={v.id}
      style={[styles.voyageCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/taxi-brousse/voyage/${v.id}` as any)}
      activeOpacity={0.85}
    >
      <View style={styles.voyageHeader}>
        <View style={[styles.classeBadge, classeColor(v.classe.type)]}>
          <Text style={styles.classeBadgeText}>{v.classe.type.toUpperCase()}</Text>
        </View>
        {v.cooperative && (
          <Text style={[styles.coopName, { color: colors.textSecondary }]}>{v.cooperative.nom}</Text>
        )}
      </View>

      <View style={styles.voyageRoute}>
        <View style={styles.routePoint}>
          <Text style={[styles.routeTime, { color: colors.text }]}>{v.heureDepart}</Text>
          <Text style={[styles.routeCity, { color: colors.text }]}>{v.villeDepart}</Text>
        </View>
        <View style={styles.routeArrow}>
          <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
          <Ionicons name="bus" size={20} color="#1e40af" />
          <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
        </View>
        <View style={[styles.routePoint, { alignItems: 'flex-end' }]}>
          <Text style={[styles.routeTime, { color: colors.text }]}>{v.heureArrivee}</Text>
          <Text style={[styles.routeCity, { color: colors.text }]}>{v.villeArrivee}</Text>
        </View>
      </View>

      <View style={styles.voyageFooter}>
        <View style={styles.voyageInfo}>
          <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.voyageInfoText, { color: colors.textSecondary }]}>
            {v.placesDisponibles?.placeLibre ?? '?'} / {v.voiture.capacite} libres
          </Text>
        </View>
        <Text style={styles.voyagePrice}>{formatPrice(v.prix)}</Text>
      </View>
    </TouchableOpacity>
  );

  // Prochains départs groupés par catégorie (classe.type)
  const grouped = upcoming.reduce<Record<string, VoyageSearchResult[]>>((acc, v) => {
    const k = v.classe?.type || 'Standard';
    (acc[k] = acc[k] || []).push(v);
    return acc;
  }, {});
  const groupNames = Object.keys(grouped).sort();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Taxi-Brousse
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/taxi-brousse/my-reservations')}
          style={styles.iconBtn}
        >
          <Ionicons name="receipt-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Form de recherche */}
        <View
          style={[
            styles.searchCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
            VILLE DE DÉPART
          </Text>
          <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
            <Ionicons name="locate-outline" size={20} color="#1e40af" />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Antananarivo, Toamasina, etc."
              placeholderTextColor={colors.textSecondary}
              value={depart}
              onChangeText={setDepart}
              onFocus={() => setActiveField('depart')}
              autoCapitalize="words"
            />
          </View>
          {activeField === 'depart' && departSugg.length > 0 && (
            <View
              style={[
                styles.suggBox,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {departSugg.map((city) => (
                <TouchableOpacity
                  key={`d-${city}`}
                  style={[styles.suggItem, { borderBottomColor: colors.border }]}
                  onPress={() => pickSuggestion('depart', city)}
                >
                  <Ionicons name="location-outline" size={16} color="#1e40af" />
                  <Text style={[styles.suggText, { color: colors.text }]}>
                    {city}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.swapContainer}>
            <TouchableOpacity onPress={swapCities} style={styles.swapBtn}>
              <Ionicons name="swap-vertical" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
            VILLE D'ARRIVÉE
          </Text>
          <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
            <Ionicons name="flag-outline" size={20} color="#ef4444" />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Destination"
              placeholderTextColor={colors.textSecondary}
              value={arrivee}
              onChangeText={setArrivee}
              onFocus={() => setActiveField('arrivee')}
              autoCapitalize="words"
            />
          </View>
          {activeField === 'arrivee' && arriveeSugg.length > 0 && (
            <View
              style={[
                styles.suggBox,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {arriveeSugg.map((city) => (
                <TouchableOpacity
                  key={`a-${city}`}
                  style={[styles.suggItem, { borderBottomColor: colors.border }]}
                  onPress={() => pickSuggestion('arrivee', city)}
                >
                  <Ionicons name="location-outline" size={16} color="#ef4444" />
                  <Text style={[styles.suggText, { color: colors.text }]}>
                    {city}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={[styles.formLabel, { color: colors.textSecondary, marginTop: 12 }]}>
            DATE DE VOYAGE
          </Text>
          <TouchableOpacity
            style={[styles.inputRow, { borderBottomColor: colors.border }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#1e40af" />
            <Text style={[styles.input, { color: colors.text }]}>
              {date.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              minimumDate={new Date()}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, selected) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selected) setDate(selected);
              }}
            />
          )}

          <TouchableOpacity
            style={styles.searchBtn}
            onPress={handleSearch}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="search" size={18} color="#fff" />
                <Text style={styles.searchBtnText}>Rechercher</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Erreur */}
        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={18} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Résultats OU prochains départs par catégorie */}
        {searched ? (
          <>
            {!loading && results.length === 0 && !error && (
              <View style={styles.emptyState}>
                <Ionicons name="bus-outline" size={56} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucun voyage trouvé</Text>
                <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                  Essayez d'autres villes ou une autre date
                </Text>
              </View>
            )}
            {results.length > 0 && (
              <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
                {results.length} voyage{results.length > 1 ? 's' : ''} disponible{results.length > 1 ? 's' : ''}
              </Text>
            )}
            {results.map(renderVoyage)}
          </>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Prochains départs</Text>
            <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
              Voyages à venir avec places disponibles
            </Text>
            {loadingUp ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
            ) : groupNames.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="bus-outline" size={56} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucun départ à venir</Text>
              </View>
            ) : (
              groupNames.map((cat) => (
                <View key={cat} style={{ marginBottom: 6 }}>
                  <View style={styles.catHeader}>
                    <View style={[styles.classeBadge, classeColor(cat)]}>
                      <Text style={styles.classeBadgeText}>{cat.toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.catCount, { color: colors.textSecondary }]}>
                      {grouped[cat].length} voyage{grouped[cat].length > 1 ? 's' : ''}
                    </Text>
                  </View>
                  {grouped[cat].map(renderVoyage)}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function classeColor(type: string) {
  const t = type.toLowerCase();
  if (t.includes('vip')) return { backgroundColor: '#7c3aed' };
  if (t.includes('luxe')) return { backgroundColor: '#0891b2' };
  if (t.includes('confort') || t.includes('premium'))
    return { backgroundColor: '#f59e0b' };
  return { backgroundColor: '#1e40af' };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  searchCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  formLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },
  swapContainer: { alignItems: 'center', marginVertical: -2 },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
  },

  suggBox: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: -6,
    marginBottom: 8,
    overflow: 'hidden',
  },
  suggItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  suggText: { fontSize: 14, fontWeight: '500' },

  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1e40af',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  searchBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ef444415',
    borderWidth: 1,
    borderColor: '#ef4444',
    marginBottom: 12,
  },
  errorText: { color: '#ef4444', flex: 1, fontSize: 12 },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyHint: { fontSize: 13 },

  resultsCount: { fontSize: 12, marginBottom: 8, fontWeight: '600' },

  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  sectionSub: { fontSize: 12, marginBottom: 14 },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  catCount: { fontSize: 12, fontWeight: '600' },

  voyageCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  voyageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  classeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  classeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  coopName: { fontSize: 12 },

  voyageRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  routePoint: { flex: 1 },
  routeTime: { fontSize: 18, fontWeight: '700' },
  routeCity: { fontSize: 13, marginTop: 2 },
  routeArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: 10,
  },
  routeLine: { width: 24, height: 1 },

  voyageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  voyageInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  voyageInfoText: { fontSize: 12 },
  voyagePrice: { fontSize: 17, fontWeight: '800', color: '#1e40af' },
});

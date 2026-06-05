// app/(app)/transport-scolaire/students.tsx
// Liste des enfants du parent + bouton ajouter.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import {
  transportScolaireApi,
  type Student,
} from '../../../src/services/transportScolaireApi';

export default function StudentsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [items, setItems] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await transportScolaireApi.listStudents();
      setItems(res.data ?? []);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message ?? 'Impossible de charger');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refetch à chaque retour sur la page (après création/édition)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDelete = (s: Student) => {
    Alert.alert(
      'Désactiver',
      `Désactiver ${s.prenom} ${s.nom} ? L'historique de ses abonnements sera conservé.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Désactiver',
          style: 'destructive',
          onPress: async () => {
            try {
              await transportScolaireApi.removeStudent(s.id);
              load();
            } catch (e: any) {
              Alert.alert('Erreur', e?.response?.data?.message ?? 'Échec');
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mes enfants</Text>
        <TouchableOpacity
          onPress={() => router.push('/transport-scolaire/student-form')}
          style={[styles.iconBtn, { backgroundColor: colors.primary, borderRadius: 20 }]}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={56} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucun enfant</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Ajoutez vos enfants pour les abonner au bus scolaire.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/transport-scolaire/student-form')}
            style={[styles.cta, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.ctaText}>Ajouter un enfant</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <View
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.avatarLetter, { color: colors.primary }]}>
                  {item.prenom.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, { color: colors.text }]}>
                  {item.prenom} {item.nom}
                </Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  {[item.classe, item.niveau].filter(Boolean).join(' · ') || 'Non renseigné'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/transport-scolaire/student-form',
                    params: { id: item.id },
                  })
                }
                style={styles.actionBtn}
              >
                <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                style={styles.actionBtn}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyDesc: { fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 20 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaText: { color: '#fff', fontWeight: '600' },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 18, fontWeight: '700' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600' },
  cardMeta: { fontSize: 12, marginTop: 2 },
  actionBtn: { padding: 8 },
});

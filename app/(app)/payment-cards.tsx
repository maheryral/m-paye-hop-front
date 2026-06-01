// app/(app)/payment-cards.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CardField, useConfirmSetupIntent } from '@stripe/stripe-react-native';
import { useTheme } from '../../src/contexts/ThemeContext';
import { cardsApi, type SavedCard } from '../../src/services/cardsApi';

export default function PaymentCards() {
  const { colors } = useTheme();
  const { confirmSetupIntent } = useConfirmSetupIntent();
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await cardsApi.list();
      setCards(Array.isArray(r.data) ? r.data : []);
    } catch (e: any) {
      console.error('cards load:', e?.response?.data || e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addCard = async () => {
    if (!cardComplete) {
      Alert.alert('Carte incomplète', 'Renseignez les informations de la carte.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await cardsApi.createSetupIntent();
      const { setupIntent, error } = await confirmSetupIntent(data.clientSecret, {
        paymentMethodType: 'Card',
      });
      if (error) {
        Alert.alert('Erreur', error.message || 'Échec de l’enregistrement');
        return;
      }
      const pmId = setupIntent?.paymentMethod?.id;
      if (!pmId) {
        Alert.alert('Erreur', 'Carte non enregistrée');
        return;
      }
      await cardsApi.saveCard(pmId);
      setShowAdd(false);
      setCardComplete(false);
      load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Stripe non configuré ?');
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (id: string) => {
    await cardsApi.setDefault(id);
    load();
  };

  const remove = (id: string) => {
    Alert.alert('Supprimer', 'Supprimer cette carte ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await cardsApi.remove(id);
          load();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Mes cartes</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : cards.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="card-outline" size={44} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Aucune carte. Ajoutez-en une pour payer directement, sans passer
              par votre solde.
            </Text>
          </View>
        ) : (
          cards.map((c) => (
            <View key={c.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.cardIcon, { backgroundColor: `${colors.primary}20` }]}>
                <Ionicons name="card" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardBrand, { color: colors.text }]}>
                  {c.brand?.toUpperCase()} •••• {c.last4}
                </Text>
                <Text style={[styles.cardExp, { color: colors.textSecondary }]}>
                  Expire {c.expiration}
                  {c.isDefault ? ' · par défaut' : ''}
                </Text>
              </View>
              {!c.isDefault && (
                <TouchableOpacity onPress={() => setDefault(c.id)} style={styles.iconBtn}>
                  <Ionicons name="star-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => remove(c.id)} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={styles.secureRow}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.secureText, { color: colors.textSecondary }]}>
            Vos données de carte sont tokenisées par Stripe et ne transitent pas
            par nos serveurs.
          </Text>
        </View>
      </ScrollView>

      {/* Modal ajout carte */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Ajouter une carte</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <CardField
              postalCodeEnabled={false}
              placeholders={{ number: '4242 4242 4242 4242' }}
              cardStyle={{
                backgroundColor: colors.background,
                textColor: colors.text,
                placeholderColor: colors.textSecondary,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
              }}
              style={styles.cardField}
              onCardChange={(d) => setCardComplete(d.complete)}
            />
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={addCard}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Enregistrer la carte</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: 'bold' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 60, paddingHorizontal: 30 },
  emptyText: { fontSize: 13, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardBrand: { fontSize: 15, fontWeight: '600' },
  cardExp: { fontSize: 12, marginTop: 2 },
  iconBtn: { padding: 6 },
  secureRow: { flexDirection: 'row', gap: 8, marginTop: 16, paddingHorizontal: 4 },
  secureText: { flex: 1, fontSize: 11 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: 'bold' },
  cardField: { width: '100%', height: 50 },
  saveBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

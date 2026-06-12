// src/components/CardsModal.tsx
// Modal de gestion des cartes (liste + ajout via Stripe) — ouverte depuis le
// dashboard (clic sur la mini-carte) ou ailleurs. Réutilise la logique du
// Portefeuille. Nécessite le StripeProvider (déjà en place au root).
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CardField, useConfirmSetupIntent } from '@stripe/stripe-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { cardsApi, type SavedCard } from '../services/cardsApi';

export default function CardsModal({
  visible,
  onClose,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { colors } = useTheme();
  const { confirmSetupIntent } = useConfirmSetupIntent();

  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setAdding(false);
      setCardComplete(false);
      void load();
    }
  }, [visible]);

  const load = async () => {
    try {
      setLoading(true);
      const r = await cardsApi.list();
      setCards(Array.isArray(r.data) ? r.data : []);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  const addCard = async () => {
    if (!cardComplete) {
      Alert.alert('Carte incomplète', 'Renseignez les informations de la carte.');
      return;
    }
    setSaving(true);
    try {
      const setup = await cardsApi.createSetupIntent();
      const { setupIntent, error } = await confirmSetupIntent(setup.data.clientSecret, {
        paymentMethodType: 'Card',
      });
      if (error) {
        Alert.alert('Erreur', error.message || "Échec de l'enregistrement");
        return;
      }
      const pmId = setupIntent?.paymentMethod?.id;
      if (!pmId) {
        Alert.alert('Erreur', 'Carte non tokenisée');
        return;
      }
      await cardsApi.saveCard(pmId);
      setAdding(false);
      setCardComplete(false);
      await load();
      onChanged?.();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Stripe non configuré côté serveur ?');
    } finally {
      setSaving(false);
    }
  };

  const removeCard = (id: string) => {
    Alert.alert('Supprimer la carte', 'Confirmer la suppression ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await cardsApi.remove(id);
            await load();
            onChanged?.();
          } catch (e: any) {
            Alert.alert('Erreur', e?.response?.data?.message || 'Échec');
          }
        },
      },
    ]);
  };

  const setDefault = async (id: string) => {
    try {
      await cardsApi.setDefault(id);
      await load();
      onChanged?.();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Échec');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="card" size={18} color={colors.primary} />
              <Text style={[styles.title, { color: colors.text }]}>Mes cartes</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
            ) : cards.length === 0 ? (
              <View style={[styles.empty, { borderColor: colors.border }]}>
                <Ionicons name="card-outline" size={28} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucune carte enregistrée</Text>
                <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                  Ajoutez une carte pour payer plus vite.
                </Text>
              </View>
            ) : (
              cards.map((c) => (
                <View
                  key={c.id}
                  style={[styles.cardRow, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <View style={[styles.cardIcon, { backgroundColor: `${colors.primary}20` }]}>
                    <Ionicons name="card" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.cardBrand, { color: colors.text }]} numberOfLines={1}>
                      {c.brand?.toUpperCase()} •••• {c.last4}
                    </Text>
                    <Text style={[styles.cardExp, { color: colors.textSecondary }]}>
                      Expire {c.expiration}
                      {c.isDefault ? ' · Par défaut' : ''}
                    </Text>
                  </View>
                  {!c.isDefault && (
                    <TouchableOpacity onPress={() => setDefault(c.id)} style={styles.iconBtn}>
                      <Ionicons name="star-outline" size={18} color="#f59e0b" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => removeCard(c.id)} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* Ajout */}
            {adding ? (
              <View style={{ gap: 10, marginTop: 6 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>NOUVELLE CARTE</Text>
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
                  style={{ width: '100%', height: 50 }}
                  onCardChange={(d) => setCardComplete(d.complete)}
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
                  onPress={addCard}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="lock-closed" size={16} color="#fff" />
                      <Text style={styles.primaryBtnText}>Enregistrer la carte</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAdding(false)}>
                  <Text style={[styles.cancel, { color: colors.textSecondary }]}>Annuler</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => setAdding(true)}
              >
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Ajouter une carte</Text>
              </TouchableOpacity>
            )}

            <View style={styles.secureRow}>
              <Ionicons name="lock-closed-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.secureText, { color: colors.textSecondary }]}>
                Cartes tokenisées par Stripe — jamais stockées chez nous.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  backdropTouch: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  empty: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyTitle: { fontSize: 14, fontWeight: '600' },
  emptyHint: { fontSize: 12, textAlign: 'center' },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardBrand: { fontSize: 14, fontWeight: '700' },
  cardExp: { fontSize: 11, marginTop: 2 },
  iconBtn: { padding: 6 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cancel: { fontSize: 12, textAlign: 'center', paddingVertical: 4 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 },
  secureText: { fontSize: 11 },
});

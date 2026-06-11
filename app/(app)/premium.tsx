// app/(app)/premium.tsx — Plans d'abonnement Premium / Business
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useWallet } from '../../src/contexts/WalletContext';
import { useBiometricGuard } from '../../src/contexts/BiometricGuardContext';
import GradientHeader from '../../src/components/GradientHeader';
import {
  monetizationApi,
  Plan,
  Subscription,
} from '../../src/services/monetizationApi';

export default function Premium() {
  const { colors } = useTheme();
  const { balance, fetchBalance } = useWallet();
  const { requireBiometric } = useBiometricGuard();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        monetizationApi.listPlans(),
        monetizationApi.myPlan(),
      ]);
      setPlans(p.data);
      setCurrent(c.data);
    } catch (e: any) {
      console.error(e?.response?.data || e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubscribe = async (plan: Plan) => {
    if (plan.id === 'BASIC') {
      Alert.alert('Info', 'BASIC est votre plan par défaut, pas besoin de souscrire.');
      return;
    }
    if (balance < plan.price) {
      Alert.alert(
        'Solde insuffisant',
        `Vous avez ${balance.toLocaleString('fr-FR')} Ar, requis ${plan.price.toLocaleString('fr-FR')} Ar. Rechargez votre portefeuille.`,
      );
      return;
    }

    const ok = await requireBiometric(
      `Souscrire au plan ${plan.name} (${plan.price.toLocaleString('fr-FR')} Ar)`,
    );
    if (!ok) return;

    Alert.alert(
      `Confirmer l'abonnement ${plan.name}`,
      `${plan.price.toLocaleString('fr-FR')} Ar seront débités de votre wallet pour 30 jours.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Souscrire',
          onPress: async () => {
            setSubscribing(plan.id);
            try {
              await monetizationApi.subscribe(plan.id);
              Alert.alert(
                'Abonnement activé 🎉',
                `Vous bénéficiez maintenant des avantages ${plan.name}.`,
              );
              await Promise.all([load(), fetchBalance()]);
            } catch (e: any) {
              Alert.alert(
                'Erreur',
                e?.response?.data?.message || 'Abonnement échoué',
              );
            } finally {
              setSubscribing(null);
            }
          },
        },
      ],
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Annuler l\'abonnement',
      'Vous garderez vos avantages jusqu\'à la fin de la période en cours.',
      [
        { text: 'Garder', style: 'cancel' },
        {
          text: 'Annuler le renouvellement',
          style: 'destructive',
          onPress: async () => {
            try {
              await monetizationApi.cancelPlan();
              load();
            } catch (e: any) {
              Alert.alert('Erreur', e?.response?.data?.message || 'Annulation échouée');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GradientHeader title="Premium" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title="Plans d'abonnement"
        subtitle="Économisez sur tous vos paiements"
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Statut actuel */}
        <LinearGradient
          colors={['#2563eb', '#1e40af']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.currentCard}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons
              name={current?.plan === 'BASIC' ? 'person-outline' : 'star'}
              size={24}
              color="#fff"
            />
            <View>
              <Text style={styles.currentLabel}>Votre plan actuel</Text>
              <Text style={styles.currentPlan}>{current?.plan || 'BASIC'}</Text>
            </View>
          </View>
          {current?.endDate && (
            <Text style={styles.currentExpiry}>
              Expire le {new Date(current.endDate).toLocaleDateString('fr-FR')}
            </Text>
          )}
          {current && current.plan !== 'BASIC' && current.endDate && (
            <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Annuler le renouvellement</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* Plans */}
        {plans.map((plan) => {
          const isCurrent = current?.plan === plan.id;
          const isFree = plan.price === 0;

          return (
            <View
              key={plan.id}
              style={[
                styles.planCard,
                { backgroundColor: colors.card, borderColor: plan.color },
                plan.recommended && { borderWidth: 2 },
              ]}
            >
              {plan.recommended && (
                <View style={[styles.recommendedBadge, { backgroundColor: plan.color }]}>
                  <Ionicons name="star" size={12} color="#fff" />
                  <Text style={styles.recommendedText}>RECOMMANDÉ</Text>
                </View>
              )}

              <View style={styles.planHeader}>
                <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                <Text style={[styles.planPrice, { color: colors.text }]}>
                  {plan.priceLabel}
                </Text>
              </View>

              <View style={styles.featuresList}>
                {plan.features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color={plan.color} />
                    <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
                  </View>
                ))}
              </View>

              {isCurrent ? (
                <View style={[styles.activeBtn, { backgroundColor: plan.color + '15', borderColor: plan.color }]}>
                  <Ionicons name="checkmark-circle" size={16} color={plan.color} />
                  <Text style={[styles.activeBtnText, { color: plan.color }]}>
                    Plan actif
                  </Text>
                </View>
              ) : isFree ? (
                <View style={[styles.activeBtn, { backgroundColor: colors.border + '30', borderColor: colors.border }]}>
                  <Text style={[styles.activeBtnText, { color: colors.textSecondary }]}>
                    Plan par défaut
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.subscribeBtn, { backgroundColor: plan.color }]}
                  onPress={() => handleSubscribe(plan)}
                  disabled={subscribing === plan.id}
                >
                  {subscribing === plan.id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="flash" size={16} color="#fff" />
                      <Text style={styles.subscribeText}>
                        {current?.plan === 'BASIC' ? 'Souscrire' : 'Changer de plan'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Info bas */}
        <View style={[styles.infoBox, { borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={16} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Le montant est débité de votre wallet M'Paye. Renouvellement automatique chaque
            30 jours sauf annulation.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  currentCard: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 18,
    gap: 6,
  },
  currentLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  currentPlan: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  currentExpiry: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 },
  cancelBtn: { marginTop: 8 },
  cancelText: { color: '#fca5a5', fontSize: 12, textDecorationLine: 'underline' },

  planCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    position: 'relative',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  recommendedText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  planHeader: { marginBottom: 14 },
  planName: { fontSize: 18, fontWeight: '800' },
  planPrice: { fontSize: 14, fontWeight: '600', marginTop: 4 },

  featuresList: { gap: 8, marginBottom: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, flex: 1 },

  subscribeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 10,
  },
  subscribeText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  activeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1,
  },
  activeBtnText: { fontWeight: '700', fontSize: 13 },

  infoBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 8,
  },
  infoText: { flex: 1, fontSize: 11, lineHeight: 16 },
});

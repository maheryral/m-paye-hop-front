// app/(app)/tontines/new.tsx
//
// Formulaire de création d'une tontine. À la soumission, on récupère le
// `inviteCode` et on redirige vers l'écran détail où l'organisateur peut
// le partager pour recruter les membres.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import GradientHeader from '../../../src/components/GradientHeader';
import { tontineService } from '../../../src/services/api';

const PRESETS = [
  { amount: 25000, label: '25 k' },
  { amount: 50000, label: '50 k' },
  { amount: 100000, label: '100 k' },
  { amount: 200000, label: '200 k' },
];

const SIZE_PRESETS = [5, 8, 10, 12, 15];

export default function CreateTontine() {
  const router = useRouter();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('50000');
  const [members, setMembers] = useState(10);
  const [cycleDay, setCycleDay] = useState(5);
  const [busy, setBusy] = useState(false);

  // Aperçu calculé en temps réel — aide l'user à valider mentalement.
  const monthlyN = Number(amount) || 0;
  const pot = monthlyN * members;
  const durationMonths = members;

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert('Nom requis', 'Donnez un nom à votre tontine.');
      return;
    }
    if (monthlyN < 1000) {
      Alert.alert('Montant invalide', 'Le minimum est de 1 000 Ar.');
      return;
    }
    if (members < 2 || members > 30) {
      Alert.alert('Taille invalide', 'Entre 2 et 30 membres.');
      return;
    }
    if (cycleDay < 1 || cycleDay > 28) {
      Alert.alert('Jour invalide', 'Choisissez un jour entre 1 et 28.');
      return;
    }

    setBusy(true);
    try {
      const created = await tontineService.create({
        name: name.trim(),
        description: description.trim() || undefined,
        monthlyAmount: monthlyN,
        totalMembers: members,
        cycleDay,
      });
      router.replace(`/tontines/${created.id}` as any);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader title="Nouvelle tontine" subtitle="Épargne collective" />

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          {/* Nom */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>Nom de la tontine</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="Ex: Tontine famille Rakoto"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
            maxLength={100}
          />

          {/* Description */}
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>
            Description (optionnel)
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.inputMultiline,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
            ]}
            placeholder="Ex: Pour notre projet immobilier 2026"
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={500}
          />

          {/* Montant mensuel */}
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>
            Cotisation par membre / mois
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="50000"
            placeholderTextColor={colors.textSecondary}
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
          />
          <View style={styles.presetsRow}>
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p.amount}
                style={[styles.presetChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setAmount(String(p.amount))}
              >
                <Text style={[styles.presetText, { color: colors.text }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Nombre de membres */}
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>
            Nombre de membres (organisateur compris)
          </Text>
          <View style={[styles.stepper, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setMembers((m) => Math.max(2, m - 1))}
              style={styles.stepperBtn}
            >
              <Ionicons name="remove" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.stepperValue, { color: colors.text }]}>{members}</Text>
            <TouchableOpacity
              onPress={() => setMembers((m) => Math.min(30, m + 1))}
              style={styles.stepperBtn}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.presetsRow}>
            {SIZE_PRESETS.map((n) => (
              <TouchableOpacity
                key={n}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: members === n ? `${colors.primary}25` : colors.card,
                    borderColor: members === n ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setMembers(n)}
              >
                <Text style={[styles.presetText, { color: members === n ? colors.primary : colors.text }]}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Jour du mois */}
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>
            Jour du mois pour le cycle (1-28)
          </Text>
          <View style={[styles.stepper, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setCycleDay((d) => Math.max(1, d - 1))}
              style={styles.stepperBtn}
            >
              <Ionicons name="remove" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.stepperValue, { color: colors.text }]}>{cycleDay}</Text>
            <TouchableOpacity
              onPress={() => setCycleDay((d) => Math.min(28, d + 1))}
              style={styles.stepperBtn}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Le 1er round aura lieu le prochain {cycleDay} du mois.
          </Text>

          {/* Récap */}
          <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>Aperçu</Text>
            <SummaryRow
              label="Pot mensuel"
              value={pot.toLocaleString('fr-FR') + ' Ar'}
              bold
              colors={colors}
            />
            <SummaryRow
              label="Durée totale"
              value={`${durationMonths} mois`}
              colors={colors}
            />
            <SummaryRow
              label="Ce que vous verserez"
              value={`${(monthlyN * durationMonths).toLocaleString('fr-FR')} Ar au total`}
              colors={colors}
            />
            <SummaryRow
              label="Ce que vous recevrez"
              value={`${pot.toLocaleString('fr-FR')} Ar (1× sur ${durationMonths} mois)`}
              colors={colors}
            />
          </View>

          <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
            Après création, vous recevrez un code à partager pour inviter
            {' '}{members - 1} autres personnes. La tontine démarre quand le quota
            de {members} membres est atteint.
          </Text>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: busy ? 0.5 : 1 }]}
            onPress={submit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.submitText}>Créer la tontine</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  bold,
  colors,
}: {
  label: string;
  value: string;
  bold?: boolean;
  colors: any;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={{ fontSize: 13, color: colors.textSecondary }}>{label}</Text>
      <Text
        style={{
          fontSize: bold ? 15 : 13,
          fontWeight: bold ? '800' : '600',
          color: bold ? colors.primary : colors.text,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  hint: { fontSize: 11, marginTop: 6 },

  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  presetChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  presetText: { fontSize: 12, fontWeight: '600' },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 6,
    height: 52,
  },
  stepperBtn: { padding: 12 },
  stepperValue: { fontSize: 20, fontWeight: '800' },

  summary: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  summaryTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },

  disclaimer: { fontSize: 12, marginTop: 14, lineHeight: 17, textAlign: 'center', paddingHorizontal: 8 },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

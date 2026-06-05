// app/(app)/transport-scolaire/student-form.tsx
// Création OU édition d'un enfant (selon présence du query param ?id=...).

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import {
  transportScolaireApi,
  type UpsertStudentDto,
} from '../../../src/services/transportScolaireApi';

export default function StudentForm() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id: paramId } = useLocalSearchParams<{ id?: string }>();
  const id = Array.isArray(paramId) ? paramId[0] : paramId;
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<UpsertStudentDto>({
    nom: '',
    prenom: '',
    classe: '',
    niveau: '',
    notes: '',
  });

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await transportScolaireApi.getStudent(id!);
        const s = res.data;
        setForm({
          nom: s.nom,
          prenom: s.prenom,
          classe: s.classe ?? '',
          niveau: s.niveau ?? '',
          notes: s.notes ?? '',
        });
      } catch (e: any) {
        Alert.alert('Erreur', e?.response?.data?.message ?? 'Chargement échoué');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  const handleSubmit = async () => {
    if (!form.nom?.trim() || !form.prenom?.trim()) {
      Alert.alert('Champs requis', 'Nom et prénom obligatoires');
      return;
    }
    setSubmitting(true);
    try {
      const payload: UpsertStudentDto = {
        nom: form.nom?.trim(),
        prenom: form.prenom?.trim(),
        classe: form.classe?.trim() || null,
        niveau: form.niveau?.trim() || null,
        notes: form.notes?.trim() || null,
      };
      if (isEdit) {
        await transportScolaireApi.updateStudent(id!, payload);
      } else {
        await transportScolaireApi.createStudent(payload);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message ?? 'Sauvegarde échouée');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isEdit ? 'Modifier enfant' : 'Ajouter un enfant'}
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.form}>
          <Field
            label="Prénom *"
            value={form.prenom ?? ''}
            onChangeText={(v) => setForm({ ...form, prenom: v })}
            placeholder="Mialy"
            colors={colors}
          />
          <Field
            label="Nom *"
            value={form.nom ?? ''}
            onChangeText={(v) => setForm({ ...form, nom: v })}
            placeholder="Rakoto"
            colors={colors}
          />
          <Field
            label="Classe"
            value={form.classe ?? ''}
            onChangeText={(v) => setForm({ ...form, classe: v })}
            placeholder="CM2"
            colors={colors}
          />
          <Field
            label="Niveau"
            value={form.niveau ?? ''}
            onChangeText={(v) => setForm({ ...form, niveau: v })}
            placeholder="Primaire / Secondaire"
            colors={colors}
          />
          <Field
            label="Notes (allergies, urgence…)"
            value={form.notes ?? ''}
            onChangeText={(v) => setForm({ ...form, notes: v })}
            placeholder="Optionnel"
            colors={colors}
            multiline
          />
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submit, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {isEdit ? 'Enregistrer' : 'Ajouter l\'enfant'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  colors: any;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        multiline={multiline}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.card,
            borderColor: colors.border,
            minHeight: multiline ? 90 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
    </View>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  form: { padding: 16, gap: 14 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  footer: {
    borderTopWidth: 1,
    padding: 16,
    paddingBottom: 24,
  },
  submit: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// app/(app)/(tabs)/coupons/create.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../../../src/contexts/ThemeContext';

export default function CreateCouponScreen() {
  const { colors } = useTheme();
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: '',
    minPurchase: '',
    maxDiscount: '',
    validFrom: '',
    validUntil: '',
    usageLimit: '',
    description: '',
  });

  const handleSubmit = () => {
    Alert.alert(
      'Succès',
      'Coupon créé avec succès',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Créer un coupon</Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.formGroup]}>
          <Text style={[styles.label, { color: colors.text }]}>Code du coupon *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="EX: PROMO20"
            placeholderTextColor={colors.textSecondary}
            value={formData.code}
            onChangeText={(text) => setFormData({...formData, code: text.toUpperCase()})}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.formGroup, styles.halfWidth]}>
            <Text style={[styles.label, { color: colors.text }]}>Type de réduction</Text>
            <View style={styles.rowButtons}>
              <TouchableOpacity
                style={[styles.typeButton, formData.discountType === 'percentage' && { backgroundColor: colors.primary }]}
                onPress={() => setFormData({...formData, discountType: 'percentage'})}
              >
                <Text style={[styles.typeButtonText, formData.discountType === 'percentage' && { color: '#fff' }]}>
                  Pourcentage
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, formData.discountType === 'fixed' && { backgroundColor: colors.primary }]}
                onPress={() => setFormData({...formData, discountType: 'fixed'})}
              >
                <Text style={[styles.typeButtonText, formData.discountType === 'fixed' && { color: '#fff' }]}>
                  Montant fixe
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.formGroup, styles.halfWidth]}>
            <Text style={[styles.label, { color: colors.text }]}>
              Valeur {formData.discountType === 'percentage' ? '(%)' : '(Ar)'} *
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder={formData.discountType === 'percentage' ? '10' : '5000'}
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={formData.discountValue}
              onChangeText={(text) => setFormData({...formData, discountValue: text})}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.formGroup, styles.halfWidth]}>
            <Text style={[styles.label, { color: colors.text }]}>Montant minimum</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="0 Ar"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={formData.minPurchase}
              onChangeText={(text) => setFormData({...formData, minPurchase: text})}
            />
          </View>

          <View style={[styles.formGroup, styles.halfWidth]}>
            <Text style={[styles.label, { color: colors.text }]}>Réduction max</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="Illimité"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={formData.maxDiscount}
              onChangeText={(text) => setFormData({...formData, maxDiscount: text})}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.formGroup, styles.halfWidth]}>
            <Text style={[styles.label, { color: colors.text }]}>Date de début</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              value={formData.validFrom}
              onChangeText={(text) => setFormData({...formData, validFrom: text})}
            />
          </View>

          <View style={[styles.formGroup, styles.halfWidth]}>
            <Text style={[styles.label, { color: colors.text }]}>Date de fin</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              value={formData.validUntil}
              onChangeText={(text) => setFormData({...formData, validUntil: text})}
            />
          </View>
        </View>

        <View style={[styles.formGroup]}>
          <Text style={[styles.label, { color: colors.text }]}>Limite d'utilisation</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="Illimité"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={formData.usageLimit}
            onChangeText={(text) => setFormData({...formData, usageLimit: text})}
          />
        </View>

        <View style={[styles.formGroup]}>
          <Text style={[styles.label, { color: colors.text }]}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="Description du coupon..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            value={formData.description}
            onChangeText={(text) => setFormData({...formData, description: text})}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
          onPress={handleSubmit}
        >
          <Text style={styles.submitButtonText}>Créer le coupon</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', marginLeft: 12 },
  content: { padding: 16 },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  halfWidth: { flex: 1 },
  rowButtons: { flexDirection: 'row', gap: 10 },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  typeButtonText: { fontSize: 13, fontWeight: '500' },
  submitButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
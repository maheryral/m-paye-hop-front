// app/(app)/complete-profile.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import GradientHeader from '../../src/components/GradientHeader';

interface Step {
  id: number;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export default function CompleteProfile() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, updateUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    dateOfBirth: '',
    placeOfBirth: '',
    nationality: 'Malagasy',
    email: user?.email || '',
    phone: user?.telephone || '',
    address: '',
    city: '',
    postalCode: '',
    idType: 'cin',
    idNumber: '',
    idExpiryDate: '',
    profession: '',
    employer: '',
    monthlyIncome: '',
  });

  const steps: Step[] = [
    { id: 1, title: 'Identité', icon: 'person-outline' },
    { id: 2, title: 'Contact', icon: 'call-outline' },
    { id: 3, title: 'Pièce ID', icon: 'card-outline' },
    { id: 4, title: 'Profession', icon: 'briefcase-outline' },
    { id: 5, title: 'Confirmation', icon: 'checkmark-circle-outline' },
  ];

  const currentLimits = { daily: '500 000 Ar', monthly: '2 000 000 Ar', transaction: '200 000 Ar' };
  const newLimits = { daily: '5 000 000 Ar', monthly: '20 000 000 Ar', transaction: '2 000 000 Ar' };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setShowSuccess(true);
      // Mettre à jour l'utilisateur avec les nouvelles infos
      updateUser({ firstName: formData.firstName, lastName: formData.lastName });
    }, 2000);
  };

  if (showSuccess) {
    return (
      <View style={[styles.successContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.successCard, { backgroundColor: colors.card }]}>
          <View style={[styles.successIcon, { backgroundColor: `${colors.success}20` }]}>
            <Ionicons name="checkmark-circle" size={60} color={colors.success} />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>Profil complété !</Text>
          <Text style={[styles.successText, { color: colors.textSecondary }]}>
            Votre profil est en cours de vérification. Vous serez notifié sous 24-48h.
          </Text>

          <View style={[styles.limitsCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.limitsTitle, { color: colors.text }]}>Nouvelles limites proposées</Text>
            <View style={styles.limitRow}>
              <Text style={[styles.limitLabel, { color: colors.textSecondary }]}>Plafond journalier</Text>
              <View style={styles.limitValues}>
                <Text style={[styles.oldLimit, { color: colors.textSecondary }]}>{currentLimits.daily}</Text>
                <Text style={[styles.newLimit, { color: colors.success }]}>{newLimits.daily}</Text>
              </View>
            </View>
            <View style={styles.limitRow}>
              <Text style={[styles.limitLabel, { color: colors.textSecondary }]}>Plafond mensuel</Text>
              <View style={styles.limitValues}>
                <Text style={[styles.oldLimit, { color: colors.textSecondary }]}>{currentLimits.monthly}</Text>
                <Text style={[styles.newLimit, { color: colors.success }]}>{newLimits.monthly}</Text>
              </View>
            </View>
            <View style={styles.limitRow}>
              <Text style={[styles.limitLabel, { color: colors.textSecondary }]}>Plafond transaction</Text>
              <View style={styles.limitValues}>
                <Text style={[styles.oldLimit, { color: colors.textSecondary }]}>{currentLimits.transaction}</Text>
                <Text style={[styles.newLimit, { color: colors.success }]}>{newLimits.transaction}</Text>
              </View>
            </View>
          </View>

          <View style={styles.successButtons}>
            <TouchableOpacity
              style={[styles.successButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/dashboard' as any)}
            >
              <Text style={styles.successButtonText}>Retour à l'accueil</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Informations personnelles</Text>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Prénom *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formData.firstName}
                onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                placeholder="Jean"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Nom *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formData.lastName}
                onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                placeholder="Dupont"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Date de naissance *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formData.dateOfBirth}
                onChangeText={(text) => setFormData({ ...formData, dateOfBirth: text })}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Lieu de naissance</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formData.placeOfBirth}
                onChangeText={(text) => setFormData({ ...formData, placeOfBirth: text })}
                placeholder="Antananarivo"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Coordonnées</Text>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                placeholder="jean@email.com"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Téléphone *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                placeholder="032 12 345 67"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Adresse *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                placeholder="123 Rue principale"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Ville</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={formData.city}
                  onChangeText={(text) => setFormData({ ...formData, city: text })}
                  placeholder="Antananarivo"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Code postal</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={formData.postalCode}
                  onChangeText={(text) => setFormData({ ...formData, postalCode: text })}
                  placeholder="101"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Pièce d'identité</Text>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Type de pièce</Text>
              <View style={styles.idTypeContainer}>
                {['cin', 'passport', 'permit'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.idTypeButton,
                      { borderColor: colors.border },
                      formData.idType === type && { borderColor: colors.primary, backgroundColor: `${colors.primary}20` },
                    ]}
                    onPress={() => setFormData({ ...formData, idType: type })}
                  >
                    <Text style={[styles.idTypeText, { color: formData.idType === type ? colors.primary : colors.text }]}>
                      {type === 'cin' ? 'CIN' : type === 'passport' ? 'Passeport' : 'Permis'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Numéro *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formData.idNumber}
                onChangeText={(text) => setFormData({ ...formData, idNumber: text })}
                placeholder="123 456 789"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Date d'expiration *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formData.idExpiryDate}
                onChangeText={(text) => setFormData({ ...formData, idExpiryDate: text })}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Situation professionnelle</Text>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Profession *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formData.profession}
                onChangeText={(text) => setFormData({ ...formData, profession: text })}
                placeholder="Développeur, Commerçant..."
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Employeur</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formData.employer}
                onChangeText={(text) => setFormData({ ...formData, employer: text })}
                placeholder="Nom de l'entreprise"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Revenu mensuel *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formData.monthlyIncome}
                onChangeText={(text) => setFormData({ ...formData, monthlyIncome: text })}
                placeholder="Salaire mensuel"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
            </View>
          </View>
        );
      case 5:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Vérification des informations</Text>
            <View style={[styles.summaryCard, { backgroundColor: colors.background }]}>
              <Text style={[styles.summaryName, { color: colors.text }]}>
                {formData.firstName} {formData.lastName}
              </Text>
              <Text style={[styles.summaryDetail, { color: colors.textSecondary }]}>{formData.email}</Text>
              <Text style={[styles.summaryDetail, { color: colors.textSecondary }]}>{formData.phone}</Text>
              <Text style={[styles.summaryDetail, { color: colors.textSecondary }]}>
                Pièce: {formData.idType.toUpperCase()} - {formData.idNumber}
              </Text>
              <Text style={[styles.summaryDetail, { color: colors.textSecondary }]}>Profession: {formData.profession}</Text>
            </View>

            <View style={[styles.infoCard, { backgroundColor: `${colors.info}15`, borderColor: colors.info }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.info} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Vos informations sont sécurisées et conformes au RGPD.
              </Text>
            </View>

            <View style={[styles.limitsPreview, { backgroundColor: `${colors.success}15`, borderColor: colors.success }]}>
              <Text style={[styles.limitsPreviewTitle, { color: colors.success }]}>Nouvelles limites après vérification</Text>
              <View style={styles.limitRow}>
                <Text style={[styles.limitLabel, { color: colors.textSecondary }]}>Journalier:</Text>
                <Text style={[styles.newLimit, { color: colors.success }]}>{newLimits.daily}</Text>
              </View>
              <View style={styles.limitRow}>
                <Text style={[styles.limitLabel, { color: colors.textSecondary }]}>Mensuel:</Text>
                <Text style={[styles.newLimit, { color: colors.success }]}>{newLimits.monthly}</Text>
              </View>
              <View style={styles.limitRow}>
                <Text style={[styles.limitLabel, { color: colors.textSecondary }]}>Transaction:</Text>
                <Text style={[styles.newLimit, { color: colors.success }]}>{newLimits.transaction}</Text>
              </View>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader title="Compléter mon profil" subtitle="Vérification KYC" />

      <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
        Augmentez vos limites de transaction
      </Text>

      {/* Steps Indicator */}
      <View style={styles.stepsContainer}>
        {steps.map((step) => (
          <TouchableOpacity
            key={step.id}
            style={[
              styles.stepItem,
              currentStep === step.id && styles.activeStepItem,
              currentStep > step.id && styles.completedStepItem,
            ]}
            onPress={() => setCurrentStep(step.id)}
          >
            <View
              style={[
                styles.stepCircle,
                { borderColor: colors.border },
                currentStep === step.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                currentStep > step.id && { backgroundColor: colors.success, borderColor: colors.success },
              ]}
            >
              {currentStep > step.id ? (
                <Ionicons name="checkmark" size={16} color="#fff" />
              ) : (
                <Ionicons name={step.icon} size={16} color={currentStep === step.id ? '#fff' : colors.textSecondary} />
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                { color: colors.textSecondary },
                currentStep === step.id && { color: colors.primary },
              ]}
            >
              {step.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView showsVerticalScrollIndicator={false} style={styles.stepContentContainer}>
        {renderStepContent()}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.navigationButtons}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={[styles.navButton, styles.prevButton, { borderColor: colors.border }]}
            onPress={handlePrevious}
          >
            <Text style={[styles.prevButtonText, { color: colors.text }]}>Précédent</Text>
          </TouchableOpacity>
        )}
        {currentStep < steps.length ? (
          <TouchableOpacity
            style={[styles.navButton, styles.nextButton, { backgroundColor: colors.primary }]}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>Suivant</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navButton, styles.submitButton, { backgroundColor: colors.success }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.submitButtonText}>Soumettre ma demande</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 13,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  activeStepItem: {},
  completedStepItem: {},
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepLabel: {
    fontSize: 10,
  },
  stepContentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContent: {
    gap: 16,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  idTypeContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  idTypeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  idTypeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    gap: 6,
  },
  summaryName: {
    fontSize: 16,
    fontWeight: '600',
  },
  summaryDetail: {
    fontSize: 13,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
  },
  limitsPreview: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  limitsPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  limitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitLabel: {
    fontSize: 12,
  },
  limitValues: {
    flexDirection: 'row',
    gap: 8,
  },
  oldLimit: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  newLimit: {
    fontSize: 12,
    fontWeight: '600',
  },
  navigationButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  navButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  prevButton: {
    borderWidth: 1,
  },
  prevButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  nextButton: {},
  nextButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {},
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successCard: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  successText: {
    fontSize: 14,
    textAlign: 'center',
  },
  limitsCard: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  limitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  successButtons: {
    width: '100%',
    marginTop: 8,
  },
  successButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  successButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
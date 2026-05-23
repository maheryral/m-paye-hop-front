// app/(app)/upgrade-merchant.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { merchantApi } from '../../src/services/merchantApi';

// Types pour les documents
interface DocumentAsset {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
}

export default function UpgradeMerchant() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  // Formulaire étape 1 - Informations entreprise
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: '',
    registrationNumber: '',
    taxId: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    website: '',
    description: '',
  });
  
  // Formulaire étape 2 - Documents
  const [documents, setDocuments] = useState({
    registrationDoc: null as DocumentAsset | null,
    taxDoc: null as DocumentAsset | null,
    idDoc: null as DocumentAsset | null,
  });
  
  // Formulaire étape 3 - Informations bancaires
  const [bankInfo, setBankInfo] = useState({
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    iban: '',
    bic: '',
  });
  
  const businessTypes = [
    'Commerce de détail',
    'Restauration',
    'Services',
    'Artisanat',
    'Hôtellerie',
    'Transport',
    'Agence de voyage',
    'E-commerce',
    'Autre',
  ];

  const pickDocument = async (type: keyof typeof documents) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
      });
      
      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setDocuments({ 
          ...documents, 
          [type]: {
            uri: asset.uri,
            name: asset.name,
            mimeType: asset.mimeType,
            size: asset.size,
          }
        });
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner le document');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Nous avons besoin de la caméra pour prendre une photo');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setDocuments({ 
        ...documents, 
        idDoc: {
          uri: asset.uri,
          name: `id_photo_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        }
      });
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Nous avons besoin d\'accéder à vos photos');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setDocuments({ 
        ...documents, 
        idDoc: {
          uri: asset.uri,
          name: asset.fileName || `id_image_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        }
      });
    }
  };

  const showImagePickerOptions = () => {
    Alert.alert(
      'Ajouter une pièce d\'identité',
      'Choisissez une option',
      [
        { text: 'Prendre une photo', onPress: takePhoto },
        { text: 'Choisir dans la galerie', onPress: pickImage },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const validateStep1 = () => {
    if (!formData.businessName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer le nom de votre entreprise');
      return false;
    }
    if (!formData.businessType) {
      Alert.alert('Erreur', 'Veuillez sélectionner le type d\'activité');
      return false;
    }
    if (!formData.registrationNumber.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre numéro d\'enregistrement');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!documents.registrationDoc) {
      Alert.alert('Erreur', 'Veuillez fournir votre licence commerciale');
      return false;
    }
    if (!documents.idDoc) {
      Alert.alert('Erreur', 'Veuillez fournir votre pièce d\'identité');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!bankInfo.bankName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer le nom de votre banque');
      return false;
    }
    if (!bankInfo.accountNumber.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre numéro de compte');
      return false;
    }
    if (!bankInfo.accountHolder.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer le titulaire du compte');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;
    
    setLoading(true);
    try {
      const formDataToSend = new FormData();
      
      // Informations entreprise
      formDataToSend.append('businessName', formData.businessName);
      formDataToSend.append('businessType', formData.businessType);
      formDataToSend.append('registrationNumber', formData.registrationNumber);
      if (formData.taxId) formDataToSend.append('taxId', formData.taxId);
      if (formData.address) formDataToSend.append('address', formData.address);
      if (formData.city) formDataToSend.append('city', formData.city);
      if (formData.phone) formDataToSend.append('phone', formData.phone);
      if (formData.email) formDataToSend.append('email', formData.email);
      if (formData.website) formDataToSend.append('website', formData.website);
      if (formData.description) formDataToSend.append('description', formData.description);
      
      // Informations bancaires
      formDataToSend.append('bankName', bankInfo.bankName);
      formDataToSend.append('accountNumber', bankInfo.accountNumber);
      formDataToSend.append('accountHolder', bankInfo.accountHolder);
      if (bankInfo.iban) formDataToSend.append('iban', bankInfo.iban);
      if (bankInfo.bic) formDataToSend.append('bic', bankInfo.bic);
      
      // Documents
      if (documents.registrationDoc) {
        formDataToSend.append('registrationDoc', {
          uri: documents.registrationDoc.uri,
          type: documents.registrationDoc.mimeType || 'application/pdf',
          name: documents.registrationDoc.name,
        } as any);
      }
      if (documents.taxDoc) {
        formDataToSend.append('taxDoc', {
          uri: documents.taxDoc.uri,
          type: documents.taxDoc.mimeType || 'application/pdf',
          name: documents.taxDoc.name,
        } as any);
      }
      if (documents.idDoc) {
        formDataToSend.append('idDoc', {
          uri: documents.idDoc.uri,
          type: documents.idDoc.mimeType || 'image/jpeg',
          name: documents.idDoc.name,
        } as any);
      }
      
      const response = await merchantApi.upgradeRequest(formDataToSend);
      const data: any = response.data;
      const status = data?.validationStatus ?? 'PENDING';

      const title =
        status === 'APPROVED' ? 'Compte créé !' : 'Demande envoyée !';
      const message =
        data?.message ??
        (status === 'APPROVED'
          ? 'Votre compte commerçant est actif.'
          : 'Votre demande sera examinée sous 48h. Vous serez notifié dès la validation.');

      Alert.alert(title, message, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('Upgrade error:', error);
      Alert.alert(
        'Erreur', 
        error.response?.data?.message || 'Une erreur est survenue lors de l\'envoi de la demande'
      );
    } finally {
      setLoading(false);
    }
  };

  const StepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((step) => (
        <View key={step} style={styles.stepItem}>
          <View
            style={[
              styles.stepCircle,
              { backgroundColor: currentStep >= step ? colors.primary : colors.border },
              currentStep === step && { borderWidth: 2, borderColor: colors.primary },
            ]}
          >
            <Text style={[styles.stepNumber, { color: currentStep >= step ? '#fff' : colors.text }]}>
              {step}
            </Text>
          </View>
          <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>
            {step === 1 ? 'Entreprise' : step === 2 ? 'Documents' : 'Banque'}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Informations de l'entreprise</Text>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Nom de l'entreprise *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder="Nom de votre boutique"
          placeholderTextColor={colors.textSecondary}
          value={formData.businessName}
          onChangeText={(text) => setFormData({ ...formData, businessName: text })}
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Type d'activité *</Text>
        <View style={styles.businessTypesContainer}>
          {businessTypes.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.businessTypeButton,
                { backgroundColor: colors.card, borderColor: colors.border },
                formData.businessType === type && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setFormData({ ...formData, businessType: type })}
            >
              <Text
                style={[
                  styles.businessTypeText,
                  { color: formData.businessType === type ? '#fff' : colors.text },
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={[styles.label, { color: colors.text }]}>N° d'enregistrement *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="RCS / NIF"
            placeholderTextColor={colors.textSecondary}
            value={formData.registrationNumber}
            onChangeText={(text) => setFormData({ ...formData, registrationNumber: text })}
          />
        </View>
        
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={[styles.label, { color: colors.text }]}>N° TVA (optionnel)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="N° TVA"
            placeholderTextColor={colors.textSecondary}
            value={formData.taxId}
            onChangeText={(text) => setFormData({ ...formData, taxId: text })}
          />
        </View>
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Adresse</Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder="Adresse complète"
          placeholderTextColor={colors.textSecondary}
          value={formData.address}
          onChangeText={(text) => setFormData({ ...formData, address: text })}
          multiline
          numberOfLines={3}
        />
      </View>
      
      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 2, marginRight: 8 }]}>
          <Text style={[styles.label, { color: colors.text }]}>Ville</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="Ville"
            placeholderTextColor={colors.textSecondary}
            value={formData.city}
            onChangeText={(text) => setFormData({ ...formData, city: text })}
          />
        </View>
        
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={[styles.label, { color: colors.text }]}>Téléphone</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="Téléphone"
            placeholderTextColor={colors.textSecondary}
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            keyboardType="phone-pad"
          />
        </View>
      </View>
      
      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={[styles.label, { color: colors.text }]}>Email professionnel</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="email@entreprise.com"
            placeholderTextColor={colors.textSecondary}
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={[styles.label, { color: colors.text }]}>Site web (optionnel)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="www.example.com"
            placeholderTextColor={colors.textSecondary}
            value={formData.website}
            onChangeText={(text) => setFormData({ ...formData, website: text })}
            autoCapitalize="none"
          />
        </View>
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Description de l'activité</Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder="Décrivez votre activité..."
          placeholderTextColor={colors.textSecondary}
          value={formData.description}
          onChangeText={(text) => setFormData({ ...formData, description: text })}
          multiline
          numberOfLines={4}
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Documents justificatifs</Text>
      <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
        Documents requis pour valider votre compte commerçant
      </Text>
      
      {/* Licence commerciale */}
      <View style={[styles.documentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.documentHeader}>
          <Ionicons name="document-text-outline" size={24} color={colors.primary} />
          <Text style={[styles.documentTitle, { color: colors.text }]}>Licence commerciale *</Text>
        </View>
        <Text style={[styles.documentHint, { color: colors.textSecondary }]}>
          PDF ou image (JPG, PNG) - Max 5MB
        </Text>
        {documents.registrationDoc ? (
          <View style={styles.documentUploaded}>
            <Ionicons name="checkmark-circle" size={20} color="#52C41A" />
            <Text style={[styles.documentName, { color: colors.text }]} numberOfLines={1}>
              {documents.registrationDoc.name}
            </Text>
            <TouchableOpacity onPress={() => setDocuments({ ...documents, registrationDoc: null })}>
              <Ionicons name="close-circle" size={20} color="#FF4D4F" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.uploadButton, { borderColor: colors.border }]}
            onPress={() => pickDocument('registrationDoc')}
          >
            <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
            <Text style={[styles.uploadText, { color: colors.primary }]}>Télécharger le document</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Justificatif fiscal */}
      <View style={[styles.documentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.documentHeader}>
          <Ionicons name="receipt-outline" size={24} color={colors.primary} />
          <Text style={[styles.documentTitle, { color: colors.text }]}>Justificatif fiscal (optionnel)</Text>
        </View>
        <Text style={[styles.documentHint, { color: colors.textSecondary }]}>
          Avis d'imposition, attestation TVA
        </Text>
        {documents.taxDoc ? (
          <View style={styles.documentUploaded}>
            <Ionicons name="checkmark-circle" size={20} color="#52C41A" />
            <Text style={[styles.documentName, { color: colors.text }]} numberOfLines={1}>
              {documents.taxDoc.name}
            </Text>
            <TouchableOpacity onPress={() => setDocuments({ ...documents, taxDoc: null })}>
              <Ionicons name="close-circle" size={20} color="#FF4D4F" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.uploadButton, { borderColor: colors.border }]}
            onPress={() => pickDocument('taxDoc')}
          >
            <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
            <Text style={[styles.uploadText, { color: colors.primary }]}>Télécharger le document</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Pièce d'identité */}
      <View style={[styles.documentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.documentHeader}>
          <Ionicons name="card-outline" size={24} color={colors.primary} />
          <Text style={[styles.documentTitle, { color: colors.text }]}>Pièce d'identité *</Text>
        </View>
        <Text style={[styles.documentHint, { color: colors.textSecondary }]}>
          CIN, Passeport ou Permis de conduire
        </Text>
        {documents.idDoc ? (
          <View style={styles.documentUploaded}>
            <Ionicons name="checkmark-circle" size={20} color="#52C41A" />
            <Text style={[styles.documentName, { color: colors.text }]} numberOfLines={1}>
              {documents.idDoc.name}
            </Text>
            <TouchableOpacity onPress={() => setDocuments({ ...documents, idDoc: null })}>
              <Ionicons name="close-circle" size={20} color="#FF4D4F" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.uploadButton, { borderColor: colors.border }]}
            onPress={showImagePickerOptions}
          >
            <Ionicons name="camera-outline" size={24} color={colors.primary} />
            <Text style={[styles.uploadText, { color: colors.primary }]}>Ajouter une photo</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Informations bancaires</Text>
      <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
        Compte où seront reversés vos paiements
      </Text>
      
      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={[styles.label, { color: colors.text }]}>Nom de la banque *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="Ex: BNI Madagascar"
            placeholderTextColor={colors.textSecondary}
            value={bankInfo.bankName}
            onChangeText={(text) => setBankInfo({ ...bankInfo, bankName: text })}
          />
        </View>
        
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={[styles.label, { color: colors.text }]}>N° de compte *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="Numéro de compte"
            placeholderTextColor={colors.textSecondary}
            value={bankInfo.accountNumber}
            onChangeText={(text) => setBankInfo({ ...bankInfo, accountNumber: text })}
            keyboardType="numeric"
          />
        </View>
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Titulaire du compte *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder="Nom du titulaire"
          placeholderTextColor={colors.textSecondary}
          value={bankInfo.accountHolder}
          onChangeText={(text) => setBankInfo({ ...bankInfo, accountHolder: text })}
        />
      </View>
      
      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={[styles.label, { color: colors.text }]}>IBAN (optionnel)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="IBAN"
            placeholderTextColor={colors.textSecondary}
            value={bankInfo.iban}
            onChangeText={(text) => setBankInfo({ ...bankInfo, iban: text })}
          />
        </View>
        
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={[styles.label, { color: colors.text }]}>BIC/SWIFT (optionnel)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="BIC/SWIFT"
            placeholderTextColor={colors.textSecondary}
            value={bankInfo.bic}
            onChangeText={(text) => setBankInfo({ ...bankInfo, bic: text })}
          />
        </View>
      </View>
      
      <View style={[styles.infoBox, { backgroundColor: `${colors.info}15`, borderColor: colors.info }]}>
        <Ionicons name="information-circle-outline" size={20} color={colors.info} />
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Les frais de transaction sont de 1,5% par paiement reçu. Les virements sont effectués sous 48h.
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Devenir commerçant</Text>
            <View style={{ width: 40 }} />
          </View>
          
          {/* Step Indicator */}
          <StepIndicator />
          
          {/* Form Steps */}
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          
          {/* Navigation Buttons */}
          <View style={styles.buttonContainer}>
            {currentStep > 1 && (
              <TouchableOpacity
                style={[styles.button, styles.prevButton, { borderColor: colors.border }]}
                onPress={handlePrevious}
              >
                <Text style={[styles.prevButtonText, { color: colors.text }]}>Précédent</Text>
              </TouchableOpacity>
            )}
            
            {currentStep < 3 ? (
              <TouchableOpacity
                style={[styles.button, styles.nextButton, { backgroundColor: colors.primary }]}
                onPress={handleNext}
              >
                <Text style={styles.nextButtonText}>Continuer</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.submitButton, { backgroundColor: colors.success }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Soumettre la demande</Text>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepLabel: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  businessTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  businessTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  businessTypeText: {
    fontSize: 14,
  },
  documentCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  documentHint: {
    fontSize: 12,
    marginBottom: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '500',
  },
  documentUploaded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F6FFED',
  },
  documentName: {
    flex: 1,
    fontSize: 13,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  prevButton: {
    borderWidth: 1,
  },
  prevButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  nextButton: {
    backgroundColor: '#1677FF',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#52C41A',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
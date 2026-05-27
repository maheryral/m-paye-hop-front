// app/(auth)/register.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { authService } from '../../src/services/api';

export default function Register() {
  const router = useRouter();
  const { setUserFromTokens } = useAuth();
  const [step, setStep] = useState<'identifier' | 'otp'>('identifier');
  const [registrationMode, setRegistrationMode] = useState<'phone' | 'email'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const errorScaleAnim = useRef(new Animated.Value(0)).current;
  const successScaleAnim = useRef(new Animated.Value(0)).current;
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (step === 'otp') {
      startTimer();
    }
  }, [step]);

  const showError = (message: string) => {
    setErrorMessage(message);
    setShowErrorModal(true);
    Animated.spring(errorScaleAnim, {
      toValue: 1,
      friction: 8,
      tension: 120,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(errorScaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowErrorModal(false);
        setErrorMessage('');
      });
    }, 2500);
  };

  const showSuccessAndNavigate = () => {
    setShowSuccessModal(true);
    Animated.spring(successScaleAnim, {
      toValue: 1,
      friction: 8,
      tension: 120,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(successScaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowSuccessModal(false);
        router.replace('/(app)/dashboard');
      });
    }, 1500);
  };

  const startTimer = () => {
    setTimer(60);
    setCanResend(false);
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Obtenir le numéro complet avec code pays
  const getFullPhoneNumber = () => {
    const cleanNumber = phoneNumber.replace(/\s/g, '');
    // Si le numéro commence déjà par +261, le garder, sinon l'ajouter
    if (cleanNumber.startsWith('+')) {
      return cleanNumber;
    }
    return `+261${cleanNumber}`;
  };

  // Étape 1: Envoyer l'identifiant et recevoir un OTP
  const handleSendIdentifier = async () => {
  let value = registrationMode === 'phone' ? phoneNumber : email;
  
  if (registrationMode === 'phone') {
    value = getFullPhoneNumber();
  }
  
  
  
  if (!value) {
    showError(registrationMode === 'phone' ? 'Veuillez entrer votre numéro' : 'Veuillez entrer votre email');
    return;
  }

  if (registrationMode === 'phone' && phoneNumber.length < 9) {
    showError('Numéro de téléphone invalide');
    return;
  }

  if (registrationMode === 'email' && (!email.includes('@') || !email.includes('.'))) {
    showError('Email invalide');
    return;
  }

  setLoading(true);
  try {
    const requestData = registrationMode === 'phone' 
      ? { telephone: value } 
      : { email: value };
    const response = await authService.initiateRegistration(requestData);
    
    setIdentifier(response.identifier);
    setStep('otp');
  } catch (error: any) {
    console.error('Erreur:', error);
    showError(error.response?.data?.message || 'Erreur lors de l\'envoi');
  } finally {
    setLoading(false);
  }
};

  // Étape 2: Vérifier l'OTP et finaliser l'inscription
  const handleVerifyOTP = async () => {
    const otpValue = otpCode.join('');
    if (otpValue.length !== 6) {
      showError('Veuillez entrer le code à 6 chiffres');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.verifyRegistration({
        code: otpValue,
        identifier: identifier
      });
      await setUserFromTokens(response.accessToken, response.refreshToken, response.user);
      showSuccessAndNavigate();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Code invalide');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;
    
    let value = registrationMode === 'phone' ? phoneNumber : email;
    if (registrationMode === 'phone') {
      value = getFullPhoneNumber();
    }
    
    setLoading(true);
    try {
      await authService.initiateRegistration({
        [registrationMode === 'phone' ? 'telephone' : 'email']: value
      });
      startTimer();
    } catch (error: any) {
      showError('Erreur lors du renvoi');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otpCode];
    newOtp[index] = text;
    setOtpCode(newOtp);

    if (text.length === 1 && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const formatPhoneNumber = (text: string) => {
    let cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
    
    let formatted = cleaned;
    if (cleaned.length > 2) {
      formatted = `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`;
    }
    return formatted.trim();
  };

  const renderIdentifierForm = () => (
    <>
      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[styles.modeButton, registrationMode === 'phone' && styles.activeModeButton]}
          onPress={() => setRegistrationMode('phone')}
        >
          <Text style={[styles.modeButtonText, registrationMode === 'phone' && styles.activeModeText]}>Téléphone</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, registrationMode === 'email' && styles.activeModeButton]}
          onPress={() => setRegistrationMode('email')}
        >
          <Text style={[styles.modeButtonText, registrationMode === 'email' && styles.activeModeText]}>E-mail</Text>
        </TouchableOpacity>
      </View>

      {registrationMode === 'phone' ? (
        <View style={styles.inputSection}>
          <View style={styles.countryCode}>
            <Text style={styles.countryCodeText}>+261</Text>
          </View>
          <View style={styles.phoneInputContainer}>
            <TextInput
              style={styles.phoneInput}
              placeholder="32 12 345 67"
              placeholderTextColor="#6b7280"
              value={phoneNumber}
              onChangeText={(text) => setPhoneNumber(formatPhoneNumber(text))}
              keyboardType="phone-pad"
            />
          </View>
        </View>
      ) : (
        <View style={styles.emailInputSection}>
          <View style={styles.inputIcon}>
            <Ionicons name="mail-outline" size={20} color="#6b7280" />
          </View>
          <TextInput
            style={styles.emailInput}
            placeholder="Adresse e-mail"
            placeholderTextColor="#6b7280"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
      )}

      <TouchableOpacity
        style={[styles.nextButton, (!(registrationMode === 'phone' ? phoneNumber : email)) && styles.nextButtonDisabled]}
        onPress={handleSendIdentifier}
        disabled={loading || !(registrationMode === 'phone' ? phoneNumber : email)}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextButtonText}>S'inscrire</Text>}
      </TouchableOpacity>
    </>
  );

  const renderOTPForm = () => (
    <>
      <Text style={styles.otpTitle}>Vérification</Text>
      <Text style={styles.otpSubtitle}>
        Nous avons envoyé un code à{'\n'}
        <Text style={styles.otpIdentifier}>{identifier}</Text>
      </Text>

      <View style={styles.otpContainer}>
        {otpCode.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              inputRefs.current[index] = ref;
            }}
            style={styles.otpInput}
            value={digit}
            onChangeText={(text) => handleOtpChange(text, index)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
          />
        ))}
      </View>

      <View style={styles.timerContainer}>
        {!canResend ? (
          <Text style={styles.timerText}>
            Renvoyer dans <Text style={styles.timerCount}>{timer}</Text> secondes
          </Text>
        ) : (
          <TouchableOpacity onPress={handleResendCode}>
            <Text style={styles.resendText}>Renvoyer le code</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.verifyButton, otpCode.join('').length !== 6 && styles.verifyButtonDisabled]}
        onPress={handleVerifyOTP}
        disabled={loading || otpCode.join('').length !== 6}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyButtonText}>Vérifier</Text>}
      </TouchableOpacity>
    </>
  );

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#007aff" />
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ionicons name="wallet-outline" size={50} color="#007aff" />
            </View>
            <Text style={styles.logoText}>M'Paye</Text>
          </View>

          {step === 'identifier' && renderIdentifierForm()}
          {step === 'otp' && renderOTPForm()}
        </View>
      </KeyboardAvoidingView>

      {/* Modal d'erreur animé */}
      <Modal
        transparent
        visible={showErrorModal}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.errorModal, { transform: [{ scale: errorScaleAnim }] }]}>
            <View style={[styles.errorIcon, { backgroundColor: '#ef444420' }]}>
              <Ionicons name="alert-circle" size={50} color="#ef4444" />
            </View>
            <Text style={[styles.errorTitle, { color: '#fff' }]}>Erreur</Text>
            <Text style={[styles.errorMessage, { color: '#9ca3af' }]}>{errorMessage}</Text>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal de succès animé */}
      <Modal
        transparent
        visible={showSuccessModal}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.successModal, { transform: [{ scale: successScaleAnim }] }]}>
            <View style={[styles.successIcon, { backgroundColor: '#3b82f620' }]}>
              <Ionicons name="checkmark-circle" size={60} color="#3b82f6" />
            </View>
            <Text style={[styles.successTitle, { color: '#fff' }]}>Inscription réussie !</Text>
            <Text style={[styles.successMessage, { color: '#9ca3af' }]}>Bienvenue sur MyWallet</Text>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 1,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 30,
    padding: 4,
    marginBottom: 30,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 25,
    alignItems: 'center',
  },
  activeModeButton: {
    backgroundColor: '#007aff',
  },
  modeButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#9ca3af',
  },
  activeModeText: {
    color: '#fff',
  },
  inputSection: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#334155',
    borderRadius: 12,
    backgroundColor: '#1e293b',
    marginBottom: 20,
  },
  countryCode: {
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderRightWidth: 0.5,
    borderRightColor: '#334155',
  },
  countryCodeText: {
    fontSize: 16,
    color: '#ffffff',
  },
  phoneInputContainer: {
    flex: 1,
  },
  phoneInput: {
    padding: 14,
    fontSize: 16,
    color: '#ffffff',
  },
  emailInputSection: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#334155',
    borderRadius: 12,
    backgroundColor: '#1e293b',
    marginBottom: 20,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  emailInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
  },
  nextButton: {
    backgroundColor: '#007aff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  otpTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  otpSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  otpIdentifier: {
    color: '#007aff',
    fontWeight: '600',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  otpInput: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    backgroundColor: '#1e293b',
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timerText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  timerCount: {
    color: '#007aff',
    fontWeight: '600',
  },
  resendText: {
    color: '#007aff',
    fontSize: 14,
    fontWeight: '500',
  },
  verifyButton: {
    backgroundColor: '#007aff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorModal: {
    width: '80%',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  errorIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    color: '#9ca3af',
  },
  successModal: {
    width: '80%',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
    successIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  successMessage: {
    fontSize: 14,
    textAlign: 'center',
    color: '#9ca3af',
  },
});
// app/(auth)/otp-verification.tsx
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function OTPVerification() {
  const router = useRouter();
  const { email, phone } = useLocalSearchParams();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const errorScaleAnim = useRef(new Animated.Value(0)).current;
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    const countdown = setInterval(() => {
      if (timer > 0) {
        setTimer(timer - 1);
      } else {
        setCanResend(true);
        clearInterval(countdown);
      }
    }, 1000);
    return () => clearInterval(countdown);
  }, [timer]);

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

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Passer au champ suivant
    if (text.length === 1 && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      showError('Veuillez entrer le code à 6 chiffres');
      return;
    }

    setLoading(true);
    // Simuler la vérification OTP
    setTimeout(() => {
      setLoading(false);
      router.replace('/(app)/dashboard');
    }, 1500);
  };

  const handleResendCode = () => {
    if (!canResend) return;
    setTimer(60);
    setCanResend(false);
    // Appel API pour renvoyer le code
    console.log('Code renvoyé à', email || phone);
  };

  const getIdentifier = () => {
    if (email) return email;
    if (phone) return phone;
    return 'votre email ou téléphone';
  };

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
              <Ionicons name="mail-outline" size={50} color="#007aff" />
            </View>
            <Text style={styles.title}>Vérification</Text>
            <Text style={styles.subtitle}>
              Nous avons envoyé un code à{'\n'}
              <Text style={styles.identifier}>{getIdentifier()}</Text>
            </Text>
          </View>

          {/* Champs OTP */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={styles.otpInput}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
              />
            ))}
          </View>

          {/* Timer */}
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

          {/* Bouton Vérifier */}
          <TouchableOpacity
            style={[styles.verifyButton, otp.join('').length !== 6 && styles.verifyButtonDisabled]}
            onPress={handleVerifyOTP}
            disabled={loading || otp.join('').length !== 6}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.verifyButtonText}>Vérifier</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal transparent visible={showErrorModal} animationType="fade" onRequestClose={() => {}}>
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
    marginBottom: 50,
    marginTop: 20,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
  },
  identifier: {
    color: '#007aff',
    fontWeight: '600',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
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
    marginBottom: 30,
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
});
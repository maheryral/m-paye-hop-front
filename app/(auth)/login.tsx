// app/(auth)/login.tsx
import React, { useState, useRef } from 'react';
import { useRouter } from 'expo-router';
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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/contexts/AuthContext';
import { authService } from '../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from '../../src/services/secureStorage';

export default function Login() {
  const router = useRouter();
  const { login,setUser } = useAuth();
  const [step, setStep] = useState<'identifier' | 'method' | 'password' | 'otp'>('identifier');
  const [loginMode, setLoginMode] = useState<'phone' | 'email'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [userId, setUserId] = useState('');
  
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const errorScaleAnim = useRef(new Animated.Value(0)).current;
  const inputRefs = useRef<(TextInput | null)[]>([]);

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

  // Obtenir le numéro complet avec code pays
  const getFullPhoneNumber = () => {
    const cleanNumber = phoneNumber.replace(/\s/g, '');
    if (cleanNumber.startsWith('+')) {
      return cleanNumber;
    }
    return `+261${cleanNumber}`;
  };

  const checkAccountExists = async () => {
    let identifier = loginMode === 'phone' ? phoneNumber : email;
    
    if (loginMode === 'phone') {
      identifier = getFullPhoneNumber();
    }
    
    if (!identifier) {
      showError(loginMode === 'phone' ? 'Veuillez entrer votre numéro de téléphone' : 'Veuillez entrer votre email');
      return;
    }

    if (loginMode === 'email' && (!email.includes('@') || !email.includes('.'))) {
      showError('Email invalide');
      return;
    }

    if (loginMode === 'phone' && phoneNumber.length < 9) {
      showError('Numéro de téléphone invalide');
      return;
    }

    setLoading(true);
    try {
      console.log(identifier)
      const response = await authService.checkAccount({ 
        [loginMode === 'phone' ? 'telephone' : 'email']: identifier 
      });
      
      if (response.exists) {
        setUserId(response.userId);
        setStep('method');
      } else {
        router.push('/(auth)/register');
      }
    } catch (error) {
      showError('Erreur lors de la vérification');
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async () => {
    let identifier = loginMode === 'phone' ? phoneNumber : email;
    if (loginMode === 'phone') {
      identifier = getFullPhoneNumber();
    }
    
    setLoading(true);
    try {
      await authService.sendOTP({ [loginMode === 'phone' ? 'telephone' : 'email']: identifier });
      setStep('otp');
      startTimer();
    } catch (error) {
      showError('Erreur lors de l\'envoi du code');
    } finally {
      setLoading(false);
    }
  };

const verifyOTP = async () => {
  const otpValue = otpCode.join('');
  if (otpValue.length !== 6) {
    showError('Veuillez entrer le code à 6 chiffres');
    return;
  }

  setLoading(true);
  try {
    const response = await authService.verifyOTP({ code: otpValue, userId });
    if (response && response.accessToken) {
      // 🔐 Tokens dans SecureStore (Keychain/Keystore)
      await secureStorage.setItem('accessToken', response.accessToken);
      await secureStorage.setItem('refreshToken', response.refreshToken);

      if (response.user) {
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
        setUser(response.user);
      }
    }
    
    router.replace('/(app)/dashboard');
  } catch (error) {
    showError('Code invalide');
  } finally {
    setLoading(false);
  }
};

  const handlePasswordLogin = async () => {
    if (!password) {
      showError('Veuillez entrer votre mot de passe');
      return;
    }

    setLoading(true);
    try {
      const identifier = loginMode === 'phone' ? getFullPhoneNumber() : email;
      await login(identifier, password);
      router.replace('/(app)/dashboard');
    } catch (error: any) {
      // Cas spécifique : l'user n'a jamais créé de mot de passe (inscription OTP).
      // Le backend renvoie `{ nopassword: true }` — on bascule automatiquement
      // vers le flow OTP plutôt que d'afficher "Mot de passe incorrect" qui
      // serait trompeur (l'user n'en a tout simplement pas).
      const data = error?.response?.data;
      if (data?.nopassword) {
        showError('Aucun mot de passe défini sur ce compte. Envoi du code SMS…');
        // Petit délai pour que l'user lise le message avant la transition
        setTimeout(() => {
          sendOTP();
        }, 800);
        return;
      }
      showError('Mot de passe incorrect');
    } finally {
      setLoading(false);
    }
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

  const handleResendCode = () => {
    if (!canResend) return;
    sendOTP();
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
        <TouchableOpacity style={styles.modeButton} onPress={() => setLoginMode('phone')} activeOpacity={0.8}>
          {loginMode === 'phone' ? (
            <LinearGradient
              colors={['#1e3a8a', '#3b82f6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modeButtonInner}
            >
              <Ionicons name="call" size={16} color="#fff" />
              <Text style={[styles.modeButtonText, styles.activeModeText]}>Téléphone</Text>
            </LinearGradient>
          ) : (
            <View style={styles.modeButtonInner}>
              <Ionicons name="call-outline" size={16} color="#9ca3af" />
              <Text style={styles.modeButtonText}>Téléphone</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.modeButton} onPress={() => setLoginMode('email')} activeOpacity={0.8}>
          {loginMode === 'email' ? (
            <LinearGradient
              colors={['#1e3a8a', '#3b82f6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modeButtonInner}
            >
              <Ionicons name="mail" size={16} color="#fff" />
              <Text style={[styles.modeButtonText, styles.activeModeText]}>E-mail</Text>
            </LinearGradient>
          ) : (
            <View style={styles.modeButtonInner}>
              <Ionicons name="mail-outline" size={16} color="#9ca3af" />
              <Text style={styles.modeButtonText}>E-mail</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loginMode === 'phone' ? (
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
        onPress={checkAccountExists}
        disabled={loading || !(loginMode === 'phone' ? phoneNumber : email)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={(!(loginMode === 'phone' ? phoneNumber : email)) ? ['#475569', '#475569'] : ['#1e3a8a', '#3b82f6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.nextButton}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Text style={styles.nextButtonText}>Suivant</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.footerLinks}>
        <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.footerLinkText}>Créer un compte</Text>
        </TouchableOpacity>
        <Text style={styles.footerSeparator}>•</Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
          <Text style={styles.footerLinkText}>Récupérer un compte</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderMethodChoice = () => (
    <>
      <TouchableOpacity style={styles.choiceButton} onPress={sendOTP} activeOpacity={0.85}>
        <LinearGradient
          colors={['#60a5fa', '#3b82f6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.choiceIcon}
        >
          <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
        </LinearGradient>
        <View style={styles.choiceTextContainer}>
          <Text style={styles.choiceButtonTitle}>Code SMS</Text>
          <Text style={styles.choiceButtonSubtitle}>Recevez un code à 6 chiffres</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#6b7280" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.choiceButton} onPress={() => setStep('password')} activeOpacity={0.85}>
        <LinearGradient
          colors={['#1e3a8a', '#3b82f6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.choiceIcon}
        >
          <Ionicons name="lock-closed" size={22} color="#fff" />
        </LinearGradient>
        <View style={styles.choiceTextContainer}>
          <Text style={styles.choiceButtonTitle}>Mot de passe</Text>
          <Text style={styles.choiceButtonSubtitle}>Utilisez votre mot de passe</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#6b7280" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButtonChoice} onPress={() => setStep('identifier')}>
        <Ionicons name="arrow-back" size={16} color="#a78bfa" />
        <Text style={styles.backButtonChoiceText}>Retour</Text>
      </TouchableOpacity>
    </>
  );

  const renderPasswordForm = () => (
    <>
      <View style={styles.passwordContainer}>
        <View style={styles.inputIcon}>
          <Ionicons name="lock-closed-outline" size={20} color="#6b7280" />
        </View>
        <TextInput
          style={styles.passwordInput}
          placeholder="Mot de passe"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Mot de passe oublié → bascule sur le flow OTP. L'user se connecte
          par SMS, puis pourra réinitialiser depuis Paramètres > Sécurité. */}
      <TouchableOpacity
        style={styles.forgotPasswordButton}
        onPress={sendOTP}
        disabled={loading}
      >
        <Text style={styles.forgotPasswordText}>
          Mot de passe oublié ? Connectez-vous par SMS
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handlePasswordLogin}
        disabled={loading || !password}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={!password ? ['#475569', '#475569'] : ['#1e3a8a', '#3b82f6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.nextButton}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="lock-open" size={18} color="#fff" />
              <Text style={styles.nextButtonText}>Se connecter</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButtonChoice} onPress={() => setStep('method')}>
        <Ionicons name="arrow-back" size={16} color="#007aff" />
        <Text style={styles.backButtonChoiceText}>Retour</Text>
      </TouchableOpacity>
    </>
  );

  const renderOTPForm = () => (
    <>
      <Text style={styles.otpTitle}>Vérification</Text>
      <Text style={styles.otpSubtitle}>
        Nous avons envoyé un code à{'\n'}
        <Text style={styles.otpIdentifier}>{loginMode === 'phone' ? phoneNumber : email}</Text>
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
        onPress={verifyOTP}
        disabled={loading || otpCode.join('').length !== 6}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={otpCode.join('').length !== 6 ? ['#475569', '#475569'] : ['#1e3a8a', '#3b82f6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.nextButton}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.nextButtonText}>Vérifier</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButtonChoice} onPress={() => setStep('method')}>
        <Ionicons name="arrow-back" size={16} color="#007aff" />
        <Text style={styles.backButtonChoiceText}>Retour</Text>
      </TouchableOpacity>
    </>
  );

  const getStepSubtitle = () => {
    switch (step) {
      case 'identifier': return 'Connectez-vous à votre compte';
      case 'method': return 'Choisissez votre méthode';
      case 'password': return 'Entrez votre mot de passe';
      case 'otp': return 'Saisissez le code reçu';
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Halo dégradé en arrière-plan */}
        <LinearGradient
          colors={['#1e3a8a33', 'transparent']}
          style={styles.backgroundGlow}
          pointerEvents="none"
        />

        <View style={styles.content}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <LinearGradient
              colors={['#1e3a8a', '#3b82f6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoCircle}
            >
              <Ionicons name="wallet" size={42} color="#fff" />
            </LinearGradient>
            <Text style={styles.logoText}>M'Paye</Text>
            <Text style={styles.welcomeSubtitle}>{getStepSubtitle()}</Text>
          </View>

          {step === 'identifier' && renderIdentifierForm()}
          {step === 'method' && renderMethodChoice()}
          {step === 'password' && renderPasswordForm()}
          {step === 'otp' && renderOTPForm()}
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
  backgroundGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 350,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 60,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
    marginTop: 10,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  logoText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 28,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 4,
  },
  modeButton: {
    flex: 1,
  },
  modeButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 22,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  activeModeText: {
    color: '#fff',
  },
  inputSection: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    backgroundColor: '#1e293b',
    marginBottom: 18,
    overflow: 'hidden',
  },
  countryCode: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: '#334155',
    backgroundColor: 'rgba(102,126,234,0.1)',
  },
  countryCodeText: {
    fontSize: 16,
    color: '#a78bfa',
    fontWeight: '700',
  },
  phoneInputContainer: {
    flex: 1,
  },
  phoneInput: {
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  emailInputSection: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    backgroundColor: '#1e293b',
    marginBottom: 18,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  emailInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 20,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  footerLinkText: {
    color: '#a78bfa',
    fontSize: 14,
    fontWeight: '600',
  },
  footerSeparator: {
    color: '#475569',
    fontSize: 12,
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  choiceIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  choiceTextContainer: {
    flex: 1,
  },
  choiceButtonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  choiceButtonSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 3,
  },
  backButtonChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
    paddingVertical: 10,
  },
  backButtonChoiceText: {
    color: '#a78bfa',
    fontSize: 14,
    fontWeight: '600',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    backgroundColor: '#1e293b',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  forgotPasswordButton: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#a78bfa',
    fontSize: 13,
    fontWeight: '600',
  },
  otpTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
  },
  otpSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  otpIdentifier: {
    color: '#a78bfa',
    fontWeight: '700',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },
  otpInput: {
    flex: 1,
    height: 56,
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 14,
    backgroundColor: '#1e293b',
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  timerText: {
    color: '#9ca3af',
    fontSize: 13,
  },
  timerCount: {
    color: '#a78bfa',
    fontWeight: '700',
  },
  resendText: {
    color: '#a78bfa',
    fontSize: 14,
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
// app/(app)/qr-payment.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
  Animated,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import GradientHeader from '../../src/components/GradientHeader';
import { useBiometricGuard } from '../../src/contexts/BiometricGuardContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { useWallet } from '../../src/contexts/WalletContext';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { transactionService } from '../../src/services/api';

export default function QRPayment() {
  const router = useRouter();
  const { colors } = useTheme();
  const { requireBiometric } = useBiometricGuard();
  const { user } = useAuth();
  const { balance, fetchBalance } = useWallet();
  const [scanMode, setScanMode] = useState(true);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [scannedData, setScannedData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const qrCodeRef = useRef<any>(null);

  // Données du QR code
  const qrData = JSON.stringify({
    name: user?.prenom ? `${user.prenom} ${user.nom}` : 'Utilisateur MyWallet',
    email: user?.email,
    telephone: user?.telephone || '',
    type: 'payment_request',
    timestamp: new Date().toISOString(),
  });

  useEffect(() => {
    loadRecentTransactions();
    fetchBalance();
  }, []);

  const loadRecentTransactions = () => {
    setRecentTransactions([
      { id: '1', title: 'Shop Express', amount: 15000, date: new Date(), type: 'payment' },
      { id: '2', title: 'Restaurant Le Gourmet', amount: 35000, date: new Date(Date.now() - 86400000), type: 'payment' },
    ]);
  };

  const showSuccessAnimation = (amountValue: number) => {
    setSuccessAmount(amountValue);
    setShowSuccessModal(true);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Fermer automatiquement après 2.5 secondes
    setTimeout(() => {
      closeSuccessModal();
    }, 1000);
  };

  const closeSuccessModal = () => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowSuccessModal(false);
      setAmount('');
      setShowPaymentForm(false);
      setScannedData(null);
      setScanned(false);
    });
  };

  // Fonction appelée quand un QR code est scanné
  const handleBarCodeScanned = (result: any) => {
    if (scanned) return;
    setScanned(true);
    
    try {
      const data = JSON.parse(result.data);
      
      if (data.type === 'payment_request' && (data.email || data.telephone)) {
        setScannedData(data);
        setShowPaymentForm(true);
        if (data.amount) {
          setAmount(data.amount.toString());
        }
      } else {
        Alert.alert('QR Code invalide', 'Ce QR code n\'est pas un code de paiement valide');
        setScanned(false);
      }
    } catch (error) {
      if (typeof result.data === 'string' && result.data.includes('@')) {
        setScannedData({ email: result.data, name: result.data.split('@')[0] });
        setShowPaymentForm(true);
      } else {
        Alert.alert('QR Code invalide', 'Impossible de lire ce QR code');
        setScanned(false);
      }
    }
  };

  const handlePayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un montant valide');
      return;
    }
    if (parseFloat(amount) > balance) {
      Alert.alert('Erreur', 'Solde insuffisant');
      return;
    }

    const ok = await requireBiometric(
      `Confirmez le paiement de ${parseFloat(amount).toLocaleString()} Ar`,
    );
    if (!ok) return;

    setLoading(true);
    try {
      let identifier = '';
      if (scannedData.email) {
        identifier = scannedData.email;
      } else if (scannedData.telephone) {
        identifier = scannedData.telephone;
      } else {
        Alert.alert('Erreur', 'Informations du destinataire manquantes');
        setLoading(false);
        return;
      }

      await transactionService.transfer({
        toPhone: identifier,
        amount: parseFloat(amount),
        motif: 'Transfert QR code',
      });
      
      await fetchBalance();
      
      // Afficher l'animation de succès au lieu de l'alert
      showSuccessAnimation(parseFloat(amount));
      
    } catch (error: any) {
      console.error('Erreur paiement:', error);
      Alert.alert('Erreur', error.response?.data?.message || 'Erreur lors du paiement');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(qrData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareQRData = async () => {
    try {
      await Share.share({ message: qrData, title: 'Mon QR Code MyWallet' });
    } catch (error) {
      console.error('Erreur partage:', error);
    }
  };

  const downloadQRCode = async () => {
    if (!qrCodeRef.current) {
      Alert.alert('Erreur', 'Impossible de capturer le QR code');
      return;
    }

    setDownloading(true);
    try {
      const uri = await captureRef(qrCodeRef.current, {
        format: 'png',
        quality: 1,
      });

      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = uri;
        link.download = `qrcode_${user?.prenom || 'mywallet'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Alert.alert('Succès', 'QR code téléchargé !');
      } else {
        const fileName = `${FileSystem.documentDirectory}qrcode_${user?.prenom || 'mywallet'}.png`;
        await FileSystem.copyAsync({ from: uri, to: fileName });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileName, {
            mimeType: 'image/png',
            dialogTitle: 'Enregistrer le QR code',
          });
        } else {
          Alert.alert('Info', 'Le partage n\'est pas disponible sur cet appareil');
        }
      }
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      Alert.alert('Erreur', 'Impossible de télécharger le QR code');
    } finally {
      setDownloading(false);
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setShowPaymentForm(false);
    setScannedData(null);
    setAmount('');
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return 'Hier';
    return date.toLocaleDateString('fr-FR');
  };

  const getUserDisplayName = () => {
    if (user?.prenom && user?.nom) return `${user.prenom} ${user.nom}`;
    if (user?.prenom) return user.prenom;
    if (user?.email) return user.email.split('@')[0];
    return 'Utilisateur';
  };

  // Demander la permission caméra
  if (!cameraPermission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="camera-outline" size={60} color={colors.textSecondary} />
        <Text style={[styles.permissionText, { color: colors.text }]}>Permission caméra requise</Text>
        <Text style={[styles.permissionSubtext, { color: colors.textSecondary }]}>
          Nous avons besoin d'accéder à votre caméra pour scanner les QR codes
        </Text>
        <TouchableOpacity style={[styles.permissionButton, { backgroundColor: colors.primary }]} onPress={requestCameraPermission}>
          <Text style={styles.permissionButtonText}>Autoriser la caméra</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GradientHeader
          title="Paiement QR"
          subtitle="Payez ou recevez de l'argent instantanément"
        />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>

          {/* Mode Selector */}
          <View style={[styles.modeSelector, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.modeButton, scanMode && { backgroundColor: colors.primary }]}
              onPress={() => { 
                setScanMode(true); 
                setShowPaymentForm(false); 
                setScannedData(null);
                setScanned(false);
              }}
            >
              <Ionicons name="scan-outline" size={18} color={scanMode ? '#fff' : colors.textSecondary} />
              <Text style={{ color: scanMode ? '#fff' : colors.textSecondary }}>Scanner</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, !scanMode && { backgroundColor: colors.primary }]}
              onPress={() => { 
                setScanMode(false); 
                setShowPaymentForm(false);
                setScanned(false);
              }}
            >
              <Ionicons name="qr-code-outline" size={18} color={!scanMode ? '#fff' : colors.textSecondary} />
              <Text style={{ color: !scanMode ? '#fff' : colors.textSecondary }}>Mon QR</Text>
            </TouchableOpacity>
          </View>

          {scanMode ? (
            !showPaymentForm ? (
              <View style={[styles.scannerCard, { backgroundColor: colors.card }]}>
                <View style={styles.cameraContainer}>
                  <CameraView
                    style={styles.camera}
                    facing="back"
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    barcodeScannerSettings={{
                      barcodeTypes: ['qr'],
                    }}
                  />
                  <View style={styles.scannerOverlay}>
                    <View style={styles.scannerFrame} />
                  </View>
                </View>
                <View style={styles.scannerInstructions}>
                  <Ionicons name="qr-code-outline" size={24} color={colors.primary} />
                  <Text style={[styles.scannerText, { color: colors.textSecondary }]}>
                    Placez le QR code dans le cadre
                  </Text>
                </View>
                {scanned && !showPaymentForm && (
                  <TouchableOpacity style={[styles.scanAgainButton, { borderColor: colors.primary }]} onPress={resetScanner}>
                    <Text style={[styles.scanAgainText, { color: colors.primary }]}>Scanner à nouveau</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={[styles.paymentForm, { backgroundColor: colors.card }]}>
                <View style={styles.paymentHeader}>
                  <Text style={[styles.paymentTitle, { color: colors.text }]}>Paiement à confirmer</Text>
                  <TouchableOpacity onPress={resetScanner}>
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                
                {scannedData && (
                  <View style={styles.merchantInfo}>
                    <Text style={[styles.merchantLabel, { color: colors.textSecondary }]}>Destinataire</Text>
                    <Text style={[styles.merchantName, { color: colors.text }]}>
                      {scannedData.prenom || scannedData.nom || scannedData.email?.split('@')[0] || 'Commerçant'}
                    </Text>
                    {scannedData.email && (
                      <Text style={[styles.merchantEmail, { color: colors.textSecondary }]}>{scannedData.email}</Text>
                    )}
                  </View>
                )}
                
                <TextInput
                  style={[styles.amountInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="Montant (Ar)"
                  placeholderTextColor={colors.textSecondary}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
                
                <TouchableOpacity
                  style={[styles.payButton, { backgroundColor: colors.primary }]}
                  onPress={handlePayment}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.payButtonText}>Payer</Text>}
                </TouchableOpacity>
              </View>
            )
          ) : (
            <View style={[styles.qrCard, { backgroundColor: colors.card }]}>
              <View style={styles.userInfoHeader}>
                <Text style={[styles.userInfoTitle, { color: colors.text }]}>Vos informations</Text>
                <TouchableOpacity onPress={copyToClipboard} style={styles.copyButton}>
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={colors.primary} />
                  <Text style={[styles.copyText, { color: colors.primary }]}>{copied ? 'Copié !' : 'Copier'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.userDetails}>
                <Text style={[styles.userName, { color: colors.text }]}>{getUserDisplayName()}</Text>
                <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
                {user?.telephone && <Text style={[styles.userPhone, { color: colors.textSecondary }]}>{user.telephone}</Text>}
              </View>

              <View ref={qrCodeRef} collapsable={false} style={styles.qrCodeContainer}>
                <QRCode value={qrData} size={200} backgroundColor="white" color="black" />
              </View>

              <Text style={[styles.qrTitle, { color: colors.text }]}>Votre QR Code MyWallet</Text>
              <Text style={[styles.qrText, { color: colors.textSecondary }]}>Présentez ce code pour recevoir des paiements</Text>

              <View style={styles.qrActions}>
                <TouchableOpacity style={[styles.actionButton, { borderColor: colors.border }]} onPress={copyToClipboard}>
                  <Ionicons name="copy-outline" size={20} color={colors.text} />
                  <Text style={{ color: colors.text }}>Copier</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={[styles.actionButton, { borderColor: colors.border }]} onPress={shareQRData}>
                  <Ionicons name="share-outline" size={20} color={colors.text} />
                  <Text style={{ color: colors.text }}>Partager</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionButton, { backgroundColor: colors.primary }]} 
                  onPress={downloadQRCode}
                  disabled={downloading}
                >
                  {downloading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff' }}>Télécharger</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Recent Transactions */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Transactions récentes</Text>
              <TouchableOpacity><Text style={[styles.sectionAction, { color: colors.primary }]}>Voir tout</Text></TouchableOpacity>
            </View>
            {recentTransactions.map((transaction) => (
              <View key={transaction.id} style={[styles.transactionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.transactionLeft}>
                  <View style={[styles.transactionIcon, { backgroundColor: transaction.type === 'payment' ? `${colors.error}20` : `${colors.success}20` }]}>
                    <Ionicons name={transaction.type === 'payment' ? 'qr-code-outline' : 'checkmark-circle-outline'} size={20} color={transaction.type === 'payment' ? colors.error : colors.success} />
                  </View>
                  <View>
                    <Text style={[styles.transactionTitle, { color: colors.text }]}>{transaction.title}</Text>
                    <Text style={[styles.transactionDate, { color: colors.textSecondary }]}>{formatDate(transaction.date)}</Text>
                  </View>
                </View>
                <Text style={[styles.transactionAmount, { color: colors.error }]}>-{transaction.amount.toLocaleString()} Ar</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Modal de succès avec animation */}
      <Modal
        transparent
        visible={showSuccessModal}
        animationType="fade"
        onRequestClose={closeSuccessModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.successModal,
              { backgroundColor: colors.card },
              { transform: [{ scale: scaleAnim }] }
            ]}
          >
            <View style={[styles.successIcon, { backgroundColor: `${colors.success}20` }]}>
              <Ionicons name="checkmark-circle" size={60} color={colors.success} />
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>Paiement réussi !</Text>
            <Text style={[styles.successAmount, { color: colors.success }]}>
              {successAmount.toLocaleString()} Ar
            </Text>
            <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
              a été envoyé avec succès
            </Text>
          </Animated.View>
        </View>
      </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  subtitle: { fontSize: 14, marginBottom: 20 },
  modeSelector: { flexDirection: 'row', borderRadius: 12, marginBottom: 20, overflow: 'hidden' },
  modeButton: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  scannerCard: { borderRadius: 20, overflow: 'hidden' },
  cameraContainer: { width: '100%', height: 400, position: 'relative' },
  camera: { width: '100%', height: '100%' },
  scannerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  scannerFrame: { width: 250, height: 250, borderWidth: 2, borderColor: '#fff', borderRadius: 20, backgroundColor: 'transparent' },
  scannerInstructions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 },
  scannerText: { fontSize: 14 },
  scanAgainButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, alignSelf: 'center', marginBottom: 16 },
  scanAgainText: { fontSize: 14, fontWeight: '500' },
  paymentForm: { padding: 20, borderRadius: 20, gap: 16 },
  paymentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentTitle: { fontSize: 18, fontWeight: '600' },
  merchantInfo: { padding: 12, borderRadius: 10, gap: 4 },
  merchantLabel: { fontSize: 12 },
  merchantName: { fontSize: 16, fontWeight: '600' },
  merchantEmail: { fontSize: 12 },
  amountInput: { height: 56, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 18 },
  payButton: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  payButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  qrCard: { padding: 20, borderRadius: 20, alignItems: 'center', gap: 16 },
  userInfoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  userInfoTitle: { fontSize: 14, fontWeight: '600' },
  copyButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyText: { fontSize: 12 },
  userDetails: { alignItems: 'center', gap: 4 },
  userName: { fontSize: 16, fontWeight: '600' },
  userEmail: { fontSize: 13 },
  userPhone: { fontSize: 13 },
  qrCodeContainer: { padding: 10, backgroundColor: '#fff', borderRadius: 16, marginVertical: 8 },
  qrTitle: { fontSize: 16, fontWeight: '600' },
  qrText: { fontSize: 13, textAlign: 'center' },
  qrActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1, gap: 8 },
  section: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  sectionAction: { fontSize: 13 },
  transactionCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  transactionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  transactionIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  transactionTitle: { fontSize: 14, fontWeight: '500' },
  transactionDate: { fontSize: 11, marginTop: 2 },
  transactionAmount: { fontSize: 14, fontWeight: '600' },
  permissionText: { fontSize: 18, fontWeight: '600', marginTop: 20 },
  permissionSubtext: { fontSize: 14, textAlign: 'center', marginHorizontal: 40, marginTop: 10 },
  permissionButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 20 },
  permissionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  // Styles pour le modal de succès
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModal: {
    width: '80%',
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
  },
  successAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  successMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
});
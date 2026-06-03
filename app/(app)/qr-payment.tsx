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
import { transactionService, qrService } from '../../src/services/api';
import { useLocale } from '../../src/contexts/LocaleContext';
import { useSocket } from '../../src/contexts/SocketContext';

export default function QRPayment() {
  const router = useRouter();
  const { colors } = useTheme();
  const { requireBiometric } = useBiometricGuard();
  const { user } = useAuth();
  const { balance, fetchBalance } = useWallet();
  const { formatCurrency } = useLocale();
  const { onNotification } = useSocket();
  const [scanMode, setScanMode] = useState(true);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [scannedData, setScannedData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);
  // QR marchand (Mode A/B) — preview + confirmation avant /qr/pay
  const [merchantQr, setMerchantQr] = useState<any>(null);
  const [merchantQrLoading, setMerchantQrLoading] = useState(false);
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
    // 🔌 Refresh quand une notif arrive (transfert reçu/envoyé, etc.)
    const unsub = onNotification((n) => {
      if (
        n.type === 'TRANSFER_SENT' ||
        n.type === 'TRANSFER_RECEIVED' ||
        n.type === 'PAYMENT_SUCCESS'
      ) {
        loadRecentTransactions();
        fetchBalance();
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 📡 Récupère les vraies transactions de l'API (5 dernières, tout type)
  const loadRecentTransactions = async () => {
    try {
      setLoadingTx(true);
      const res = await transactionService.getTransactions({ limit: 5 });
      const list = res?.transactions || res || [];
      setRecentTransactions(Array.isArray(list) ? list : []);
    } catch (e: any) {
      console.error(
        'Erreur chargement transactions QR:',
        e?.response?.data || e?.message,
      );
      setRecentTransactions([]);
    } finally {
      setLoadingTx(false);
    }
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

  // Détecte une référence de lien de paiement (URL .../pay/<ref> ou JSON)
  const extractPaymentLinkRef = (raw: string): string | null => {
    const m = raw.match(/\/pay(?:-link)?\/([^/?#\s]+)/);
    if (m) return m[1];
    try {
      const j = JSON.parse(raw);
      if (j?.type === 'payment_link' && j?.reference) return j.reference;
    } catch {
      // pas du JSON
    }
    return null;
  };

  // Détecte une référence QR marchand simple (format QR-<ts>-<hex>).
  // Le scanner peut recevoir la ref nue ou en JSON {type:'qr_payment', reference}.
  const extractMerchantQrRef = (raw: string): string | null => {
    const trimmed = String(raw).trim();
    if (/^QR-\d+-[A-F0-9]+$/i.test(trimmed)) return trimmed;
    try {
      const j = JSON.parse(trimmed);
      if (j?.type === 'qr_payment' && typeof j.reference === 'string') {
        return j.reference;
      }
    } catch {
      // pas du JSON
    }
    return null;
  };

  // Charge le récap d'un QR marchand pour preview (Mode A ou B)
  const loadMerchantQr = async (reference: string) => {
    setMerchantQrLoading(true);
    try {
      const data = await qrService.info(reference);
      if (data.statut !== 'PENDING') {
        Alert.alert('QR invalide', `Ce QR est déjà ${String(data.statut).toLowerCase()}.`);
        setScanned(false);
        return;
      }
      setMerchantQr(data);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'QR introuvable');
      setScanned(false);
    } finally {
      setMerchantQrLoading(false);
    }
  };

  // Confirme et exécute le paiement du QR marchand
  const confirmMerchantQrPayment = async () => {
    if (!merchantQr) return;
    if (Number(merchantQr.montant) > balance) {
      Alert.alert('Solde insuffisant', 'Veuillez recharger votre wallet.');
      return;
    }
    const label = merchantQr.mode === 'DIRECT_MOBILE'
      ? `Payer ${Number(merchantQr.montant).toLocaleString()} Ar à ${merchantQr.payoutOperatorLabel}`
      : `Payer ${Number(merchantQr.montant).toLocaleString()} Ar à ${merchantQr.merchant.nom}`;
    const ok = await requireBiometric(label);
    if (!ok) return;

    setMerchantQrLoading(true);
    try {
      const idem = `qr-${merchantQr.reference}-${Date.now()}`;
      await qrService.pay(merchantQr.reference, idem);
      await fetchBalance();
      const paidAmount = Number(merchantQr.montant);
      setMerchantQr(null);
      showSuccessAnimation(paidAmount);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Paiement refusé');
    } finally {
      setMerchantQrLoading(false);
    }
  };

  const cancelMerchantQr = () => {
    setMerchantQr(null);
    setScanned(false);
  };

  // Fonction appelée quand un QR code est scanné
  const handleBarCodeScanned = (result: any) => {
    if (scanned) return;
    setScanned(true);

    const raw = String(result.data ?? '');

    // 1) QR marchand simple (Mode A : payout mobile / Mode B : crédit wallet)
    const merchantQrRef = extractMerchantQrRef(raw);
    if (merchantQrRef) {
      void loadMerchantQr(merchantQrRef);
      return;
    }

    // 2) Lien de paiement marchand (POS) → écran de paiement dédié
    const linkRef = extractPaymentLinkRef(raw);
    if (linkRef) {
      router.push({ pathname: '/pay-link', params: { reference: linkRef } } as any);
      return;
    }

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

      // 🔒 Idempotency-Key contre double-tap et retry réseau
      const idem = `qr-tx-${identifier}-${amount}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await transactionService.transfer(
        {
          toPhone: identifier,
          amount: parseFloat(amount),
          motif: 'Transfert QR code',
        },
        idem,
      );
      
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

  const formatDate = (input: Date | string | null | undefined) => {
    if (!input) return '';
    const date = input instanceof Date ? input : new Date(input);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    if (days === 1) return 'Hier';
    if (days < 7) return `Il y a ${days} jours`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
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
              <TouchableOpacity onPress={() => router.push('/history' as any)}>
                <Text style={[styles.sectionAction, { color: colors.primary }]}>Voir tout</Text>
              </TouchableOpacity>
            </View>

            {loadingTx ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : recentTransactions.length === 0 ? (
              <View style={[styles.transactionCard, { backgroundColor: colors.card, borderColor: colors.border, justifyContent: 'center', paddingVertical: 24 }]}>
                <View style={{ alignItems: 'center', gap: 6 }}>
                  <Ionicons name="receipt-outline" size={32} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    Aucune transaction pour le moment
                  </Text>
                </View>
              </View>
            ) : (
              recentTransactions.map((tx: any) => {
                // Format unifié depuis l'API : { id, type, montant, motif, createdAt, isCredit, sender?, receiver? }
                const isCredit = !!tx.isCredit || tx.type === 'DEPOSIT';
                const amount = Number(tx.montant ?? tx.amount ?? 0);
                const title =
                  tx.motif ||
                  (isCredit
                    ? tx.sender
                      ? `Reçu de ${tx.sender.fullName || tx.sender.email || tx.sender.telephone}`
                      : 'Crédit'
                    : tx.receiver
                      ? `Envoyé à ${tx.receiver.fullName || tx.receiver.email || tx.receiver.telephone}`
                      : 'Débit');
                const iconName: any = isCredit ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline';
                const iconColor = isCredit ? colors.success : colors.error;
                const amountColor = isCredit ? colors.success : colors.error;
                const sign = isCredit ? '+' : '-';

                return (
                  <View key={tx.id} style={[styles.transactionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.transactionLeft}>
                      <View style={[styles.transactionIcon, { backgroundColor: `${iconColor}20` }]}>
                        <Ionicons name={iconName} size={20} color={iconColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.transactionTitle, { color: colors.text }]} numberOfLines={1}>
                          {title}
                        </Text>
                        <Text style={[styles.transactionDate, { color: colors.textSecondary }]}>
                          {formatDate(tx.createdAt ?? tx.date)}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.transactionAmount, { color: amountColor }]}>
                      {sign}{formatCurrency(amount)}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Modal de confirmation paiement QR marchand (Mode A / Mode B) */}
      <Modal
        transparent
        visible={!!merchantQr}
        animationType="fade"
        onRequestClose={cancelMerchantQr}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.merchantQrCard, { backgroundColor: colors.card }]}>
            <View style={styles.merchantQrHeader}>
              <Ionicons
                name={merchantQr?.mode === 'DIRECT_MOBILE' ? 'phone-portrait' : 'wallet'}
                size={28}
                color={colors.primary}
              />
              <Text style={[styles.merchantQrTitle, { color: colors.text }]}>
                Confirmer le paiement
              </Text>
            </View>

            <Text style={[styles.merchantQrAmount, { color: colors.text }]}>
              {Number(merchantQr?.montant ?? 0).toLocaleString()} {merchantQr?.devise ?? 'Ar'}
            </Text>

            <View style={[styles.merchantQrDivider, { backgroundColor: colors.border }]} />

            <View style={styles.merchantQrRow}>
              <Text style={[styles.merchantQrLabel, { color: colors.textSecondary }]}>
                Bénéficiaire
              </Text>
              <Text style={[styles.merchantQrValue, { color: colors.text }]} numberOfLines={1}>
                {merchantQr?.merchant?.nom ?? 'Marchand'}
              </Text>
            </View>

            {merchantQr?.mode === 'DIRECT_MOBILE' && (
              <>
                <View style={styles.merchantQrRow}>
                  <Text style={[styles.merchantQrLabel, { color: colors.textSecondary }]}>
                    Mode
                  </Text>
                  <Text style={[styles.merchantQrValue, { color: colors.primary }]}>
                    {merchantQr.payoutOperatorLabel}
                  </Text>
                </View>
                <View style={styles.merchantQrRow}>
                  <Text style={[styles.merchantQrLabel, { color: colors.textSecondary }]}>
                    Numéro
                  </Text>
                  <Text style={[styles.merchantQrValue, { color: colors.text }]}>
                    {merchantQr.payoutPhoneMasked}
                  </Text>
                </View>
              </>
            )}

            {merchantQr?.mode === 'WALLET' && (
              <View style={styles.merchantQrRow}>
                <Text style={[styles.merchantQrLabel, { color: colors.textSecondary }]}>
                  Mode
                </Text>
                <Text style={[styles.merchantQrValue, { color: colors.text }]}>
                  Wallet M'Paye
                </Text>
              </View>
            )}

            {merchantQr?.description ? (
              <View style={styles.merchantQrRow}>
                <Text style={[styles.merchantQrLabel, { color: colors.textSecondary }]}>
                  Motif
                </Text>
                <Text
                  style={[styles.merchantQrValue, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {merchantQr.description}
                </Text>
              </View>
            ) : null}

            <View style={styles.merchantQrActions}>
              <TouchableOpacity
                style={[styles.merchantQrBtn, { borderColor: colors.border }]}
                onPress={cancelMerchantQr}
                disabled={merchantQrLoading}
              >
                <Text style={{ color: colors.text }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.merchantQrBtn,
                  styles.merchantQrBtnConfirm,
                  { backgroundColor: colors.primary },
                ]}
                onPress={confirmMerchantQrPayment}
                disabled={merchantQrLoading}
              >
                {merchantQrLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Payer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  // Styles confirmation paiement QR marchand (Mode A / B)
  merchantQrCard: {
    width: '88%',
    borderRadius: 20,
    padding: 20,
    gap: 10,
  },
  merchantQrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  merchantQrTitle: { fontSize: 16, fontWeight: '600' },
  merchantQrAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 6,
  },
  merchantQrDivider: { height: 1, marginVertical: 8 },
  merchantQrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  merchantQrLabel: { fontSize: 13 },
  merchantQrValue: { fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  merchantQrActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  merchantQrBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  merchantQrBtnConfirm: {
    borderColor: 'transparent',
  },
});
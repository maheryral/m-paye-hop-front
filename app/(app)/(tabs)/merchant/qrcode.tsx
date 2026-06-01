// app/(app)/(tabs)/merchant/qrcode.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Share,
  Modal,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { useAuth } from '../../../../src/contexts/AuthContext';
import { merchantApi, type PaymentLink } from '../../../../src/services/merchantApi';
import { qrService } from '../../../../src/services/api';

export default function MerchantQRCode() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [qrData, setQrData] = useState({
    title: '',
    amount: '',
    description: '',
  });
  // Lien de paiement réutilisable à montant libre (QR statique du marchand)
  const [staticLink, setStaticLink] = useState<PaymentLink | null>(null);
  // Lien à montant figé généré à la demande (QR dynamique)
  const [dynamicLink, setDynamicLink] = useState<PaymentLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatic, setLoadingStatic] = useState(true);

  // QR simple (Mode A : payout direct mobile / Mode B : crédit wallet M'Paye)
  const [simpleModal, setSimpleModal] = useState(false);
  const [simpleData, setSimpleData] = useState({
    amount: '',
    description: '',
    payoutPhone: '',
    useDirectMobile: false, // true → Mode A, false → Mode B
  });
  const [simpleQr, setSimpleQr] = useState<{
    reference: string;
    montant: number;
    devise: string;
    description: string | null;
    mode: 'DIRECT_MOBILE' | 'WALLET';
    payoutOperator: string | null;
    expiration: string;
  } | null>(null);
  const [simpleLoading, setSimpleLoading] = useState(false);

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('fr-MG').format(Number(amount) || 0);
  };

  const merchantName = user?.prenom
    ? `${user.prenom} ${user.nom || ''}`.trim()
    : 'Marchand M\'Paye';

  // Récupère (ou crée) le lien réutilisable à montant libre du marchand
  const ensureStaticLink = useCallback(async () => {
    setLoadingStatic(true);
    try {
      const r = await merchantApi.listPaymentLinks('ACTIVE');
      const list = Array.isArray(r.data) ? r.data : [];
      const existing = list.find(
        (l) => l.reusable && l.openAmount && l.status === 'ACTIVE',
      );
      if (existing) {
        setStaticLink(existing);
        return;
      }
      const created = await merchantApi.createPaymentLink({
        label: 'Paiement QR',
        reusable: true,
      });
      setStaticLink(created.data);
    } catch (e: any) {
      console.error('static link:', e?.response?.data || e?.message);
    } finally {
      setLoadingStatic(false);
    }
  }, []);

  useEffect(() => {
    ensureStaticLink();
  }, [ensureStaticLink]);

  const generateDynamicQR = async () => {
    if (!qrData.title.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un titre');
      return;
    }
    if (!qrData.amount || parseInt(qrData.amount) <= 0) {
      Alert.alert('Erreur', 'Veuillez saisir un montant valide');
      return;
    }

    setLoading(true);
    try {
      // Crée un vrai lien de paiement à montant figé (usage unique)
      const created = await merchantApi.createPaymentLink({
        label: qrData.title,
        description: qrData.description || undefined,
        amount: Number(qrData.amount),
        reusable: false,
      });
      setDynamicLink(created.data);
    } catch (error: any) {
      Alert.alert(
        'Erreur',
        error?.response?.data?.message || 'Impossible de générer le QR code',
      );
    } finally {
      setLoading(false);
      setModalVisible(false);
    }
  };

  const handleShare = async () => {
    const link = dynamicLink ?? staticLink;
    if (!link) return;
    try {
      await Share.share({
        message: link.openAmount
          ? `Payez ${merchantName} via M'Paye : ${link.payUrl}`
          : `Payez ${formatCurrency(link.amount ?? 0)} Ar à ${merchantName} via M'Paye : ${link.payUrl}`,
      });
    } catch (error) {
      console.error('Erreur de partage:', error);
    }
  };

  const resetQR = () => {
    setDynamicLink(null);
    setQrData({ title: '', amount: '', description: '' });
  };

  // Génère un QR simple (Mode A si payoutPhone, Mode B sinon)
  const generateSimpleQR = async () => {
    const amount = parseInt(simpleData.amount, 10);
    if (!amount || amount <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    if (simpleData.useDirectMobile && !simpleData.payoutPhone.trim()) {
      Alert.alert(
        'Erreur',
        'Numéro Mobile Money requis pour le paiement direct',
      );
      return;
    }
    setSimpleLoading(true);
    try {
      const res = await qrService.generate({
        montant: amount,
        description: simpleData.description.trim() || undefined,
        payoutPhone: simpleData.useDirectMobile
          ? simpleData.payoutPhone.trim()
          : undefined,
      });
      setSimpleQr(res);
      setSimpleModal(false);
    } catch (error: any) {
      Alert.alert(
        'Erreur',
        error?.response?.data?.message || 'Impossible de générer le QR',
      );
    } finally {
      setSimpleLoading(false);
    }
  };

  const resetSimpleQR = () => {
    setSimpleQr(null);
    setSimpleData({
      amount: '',
      description: '',
      payoutPhone: '',
      useDirectMobile: false,
    });
  };

  const shareSimpleQR = async () => {
    if (!simpleQr) return;
    try {
      const modeLabel =
        simpleQr.mode === 'DIRECT_MOBILE' ? ' (Mobile Money)' : '';
      await Share.share({
        message:
          `${formatCurrency(simpleQr.montant)} Ar à ${merchantName}${modeLabel}\n` +
          `Scanner le code : ${simpleQr.reference}`,
      });
    } catch (e) {
      console.error('Erreur partage QR simple:', e);
    }
  };

  // Détecte l'opérateur depuis le préfixe (032/033/034/038)
  const previewOperator = (phone: string): string | null => {
    const digits = phone.replace(/\D+/g, '');
    let local = digits;
    if (local.startsWith('00261')) local = local.slice(5);
    else if (local.startsWith('261')) local = local.slice(3);
    if (local.startsWith('0')) local = local.slice(1);
    if (local.length < 2) return null;
    const p = local.slice(0, 2);
    if (p === '32' || p === '37') return 'Orange Money';
    if (p === '33') return 'Airtel Money';
    if (p === '34' || p === '38') return 'MVola (Yas/Telma)';
    return null;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* En-tête */}
    

      {/* QR Code Static (par défaut) — lien réutilisable à montant libre */}
      {!dynamicLink && (
        <>
          <View style={[styles.qrContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {loadingStatic || !staticLink ? (
              <View style={{ height: 204, justifyContent: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <View style={[styles.qrHeader, { backgroundColor: '#fff', padding: 12, borderRadius: 16 }]}>
                <QRCode value={staticLink.payUrl} size={180} />
              </View>
            )}
            <Text style={[styles.qrTitle, { color: colors.text }]}>{merchantName}</Text>
            <Text style={[styles.qrSubtext, { color: colors.textSecondary }]}>
              Scannez ce code pour payer (solde ou carte)
            </Text>
            <Text style={[styles.qrAmount, { color: colors.primary }]}>
              Montant libre
            </Text>
          </View>

          {staticLink && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={20} color={colors.text} />
                <Text style={[styles.actionButtonText, { color: colors.text }]}>Partager</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.generateButton, { backgroundColor: colors.primary }]}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="create-outline" size={20} color="#fff" />
            <Text style={styles.generateButtonText}>Générer un QR dynamique</Text>
          </TouchableOpacity>

          {/* Bouton QR simple — Mode A (mobile direct) ou Mode B (wallet) */}
          <TouchableOpacity
            style={[
              styles.generateButton,
              {
                backgroundColor: colors.card,
                borderColor: colors.primary,
                borderWidth: 1,
                marginTop: 10,
              },
            ]}
            onPress={() => setSimpleModal(true)}
          >
            <Ionicons name="flash-outline" size={20} color={colors.primary} />
            <Text style={[styles.generateButtonText, { color: colors.primary }]}>
              QR simple (caissier)
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* QR simple généré — affichage du résultat */}
      {simpleQr && (
        <>
          <View style={[styles.qrContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.qrHeader, { backgroundColor: '#fff', padding: 12, borderRadius: 16 }]}>
              <QRCode value={simpleQr.reference} size={180} />
            </View>
            <Text style={[styles.qrTitle, { color: colors.text }]}>{merchantName}</Text>
            <Text style={[styles.qrAmount, { color: colors.success, fontSize: 24, fontWeight: 'bold' }]}>
              {formatCurrency(simpleQr.montant)} Ar
            </Text>
            {simpleQr.description ? (
              <Text style={[styles.qrDescription, { color: colors.textSecondary }]}>
                {simpleQr.description}
              </Text>
            ) : null}
            <View style={styles.qrBadge}>
              <Ionicons
                name={simpleQr.mode === 'DIRECT_MOBILE' ? 'phone-portrait' : 'wallet'}
                size={14}
                color={colors.primary}
              />
              <Text style={[styles.qrBadgeText, { color: colors.primary }]}>
                {simpleQr.mode === 'DIRECT_MOBILE'
                  ? `Direct → ${simpleQr.payoutOperator ?? 'Mobile Money'}`
                  : 'Crédit wallet M\'Paye'}
              </Text>
            </View>
            <Text style={[styles.qrSubtext, { color: colors.warning, marginTop: 8, fontSize: 12 }]}>
              Expire dans 5 minutes
            </Text>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={shareSimpleQR}
            >
              <Ionicons name="share-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Partager</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
              onPress={resetSimpleQR}
            >
              <Ionicons name="refresh-outline" size={20} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Nouveau</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* QR Code Dynamique Généré — lien à montant figé */}
      {dynamicLink && (
        <>
          <View style={[styles.qrContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.qrHeader, { backgroundColor: '#fff', padding: 12, borderRadius: 16 }]}>
              <QRCode value={dynamicLink.payUrl} size={180} />
            </View>
            <Text style={[styles.qrTitle, { color: colors.text }]}>{dynamicLink.label || 'Paiement'}</Text>
            <Text style={[styles.qrAmount, { color: colors.success, fontSize: 24, fontWeight: 'bold' }]}>
              {formatCurrency(dynamicLink.amount ?? 0)} Ar
            </Text>
            {dynamicLink.description ? (
              <Text style={[styles.qrDescription, { color: colors.textSecondary }]}>
                {dynamicLink.description}
              </Text>
            ) : null}
            <View style={styles.qrBadge}>
              <Ionicons name="lock-closed-outline" size={14} color={colors.warning} />
              <Text style={[styles.qrBadgeText, { color: colors.warning }]}>Montant figé</Text>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={handleShare}
            >
              <Ionicons name="share-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Partager</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
              onPress={resetQR}
            >
              <Ionicons name="refresh-outline" size={20} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Nouveau</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Modal de génération */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Générer QR Code</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Titre *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="Ex: Paiement commande #1234"
                  placeholderTextColor={colors.textSecondary}
                  value={qrData.title}
                  onChangeText={(text) => setQrData({ ...qrData, title: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Montant (Ar) *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontSize: 18, fontWeight: 'bold' }]}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={qrData.amount}
                  onChangeText={(text) => setQrData({ ...qrData, amount: text })}
                />
                {qrData.amount ? (
                  <Text style={[styles.amountPreview, { color: colors.primary }]}>
                    {formatCurrency(qrData.amount)} Ar
                  </Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Description (optionnel)</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="Ex: Remboursement, Acompte, Solde..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                  value={qrData.description}
                  onChangeText={(text) => setQrData({ ...qrData, description: text })}
                />
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color={colors.info} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Un lien de paiement à montant figé sera créé. Le client le règle par solde ou carte en scannant le QR.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.primary }]}
                onPress={generateDynamicQR}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="qr-code" size={20} color="#fff" />
                    <Text style={styles.submitButtonText}>Générer le QR code</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal QR simple (Mode A direct mobile / Mode B wallet) */}
      <Modal
        animationType="slide"
        transparent
        visible={simpleModal}
        onRequestClose={() => setSimpleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                QR simple
              </Text>
              <TouchableOpacity onPress={() => setSimpleModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Montant (Ar) *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                      fontSize: 18,
                      fontWeight: 'bold',
                    },
                  ]}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={simpleData.amount}
                  onChangeText={(text) => setSimpleData({ ...simpleData, amount: text })}
                />
                {simpleData.amount ? (
                  <Text style={[styles.amountPreview, { color: colors.primary }]}>
                    {formatCurrency(simpleData.amount)} Ar
                  </Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Description (optionnel)</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="Ex: Boisson, ticket #42…"
                  placeholderTextColor={colors.textSecondary}
                  value={simpleData.description}
                  onChangeText={(text) => setSimpleData({ ...simpleData, description: text })}
                  maxLength={200}
                />
              </View>

              {/* Toggle Mode A / Mode B */}
              <TouchableOpacity
                style={[
                  styles.infoBox,
                  {
                    backgroundColor: simpleData.useDirectMobile
                      ? `${colors.primary}15`
                      : colors.background,
                    borderColor: simpleData.useDirectMobile ? colors.primary : colors.border,
                    borderWidth: 1,
                    marginBottom: 12,
                  },
                ]}
                onPress={() =>
                  setSimpleData({
                    ...simpleData,
                    useDirectMobile: !simpleData.useDirectMobile,
                  })
                }
              >
                <Ionicons
                  name={
                    simpleData.useDirectMobile
                      ? 'checkbox'
                      : 'square-outline'
                  }
                  size={22}
                  color={simpleData.useDirectMobile ? colors.primary : colors.textSecondary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoText, { color: colors.text, fontWeight: '600' }]}>
                    Recevoir directement sur Mobile Money
                  </Text>
                  <Text style={[styles.infoText, { color: colors.textSecondary, fontSize: 12 }]}>
                    Le paiement va sur votre numéro Orange/Airtel/MVola au lieu du wallet M'Paye
                  </Text>
                </View>
              </TouchableOpacity>

              {simpleData.useDirectMobile && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Numéro Mobile Money *
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    placeholder="034 12 345 67"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="phone-pad"
                    value={simpleData.payoutPhone}
                    onChangeText={(text) =>
                      setSimpleData({ ...simpleData, payoutPhone: text })
                    }
                  />
                  {simpleData.payoutPhone ? (
                    <Text
                      style={[
                        styles.amountPreview,
                        {
                          color: previewOperator(simpleData.payoutPhone)
                            ? colors.success
                            : colors.error,
                        },
                      ]}
                    >
                      {previewOperator(simpleData.payoutPhone) ??
                        'Préfixe non reconnu (attendu : 032/033/034/038)'}
                    </Text>
                  ) : null}
                </View>
              )}

              <View style={styles.infoBox}>
                <Ionicons name="time-outline" size={20} color={colors.info} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Ce QR expire dans 5 minutes et ne peut être payé qu'une seule fois.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.primary }]}
                onPress={generateSimpleQR}
                disabled={simpleLoading}
              >
                {simpleLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="qr-code" size={20} color="#fff" />
                    <Text style={styles.submitButtonText}>Générer le QR</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Instructions */}
      <View style={[styles.instructionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.instructionsTitle, { color: colors.text }]}>Comment utiliser ?</Text>
        <View style={styles.instructionItem}>
          <Ionicons name="qr-code-outline" size={20} color={colors.primary} />
          <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
            Affichez votre QR code static pour des paiements libres
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <Ionicons name="create-outline" size={20} color={colors.primary} />
          <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
            Générez un QR dynamique pour un montant spécifique
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <Ionicons name="share-outline" size={20} color={colors.primary} />
          <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
            Partagez le QR code avec votre client par message
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  qrContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  qrHeader: { marginBottom: 20 },
  qrTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  qrSubtext: { fontSize: 14, marginBottom: 12 },
  qrAmount: { fontSize: 20, fontWeight: 'bold', marginTop: 8 },
  qrDescription: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  qrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  qrBadgeText: { fontSize: 12, fontWeight: '500' },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  generateButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  amountPreview: { marginTop: 8, fontSize: 14, textAlign: 'right' },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  instructionsCard: {
    margin: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  instructionsTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  instructionText: { flex: 1, fontSize: 14 },
});
// app/(app)/(tabs)/merchant/qrcode.tsx
import React, { useState } from 'react';
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
import { router } from 'expo-router';
import { useTheme } from '../../../../src/contexts/ThemeContext';

export default function MerchantQRCode() {
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [qrData, setQrData] = useState({
    title: '',
    amount: '',
    description: '',
  });
  const [generatedQR, setGeneratedQR] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [staticQR, setStaticQR] = useState(true);

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('fr-MG').format(parseInt(amount) || 0);
  };

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
      // Simulation d'appel API pour générer QR code dynamique
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setGeneratedQR({
        title: qrData.title,
        amount: qrData.amount,
        description: qrData.description,
        qrData: JSON.stringify({
          title: qrData.title,
          amount: qrData.amount,
          description: qrData.description,
          merchant: "Ma Boutique",
          timestamp: new Date().toISOString()
        })
      });
      
      setStaticQR(false);
      Alert.alert('Succès', 'QR code généré avec succès');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de générer le QR code');
    } finally {
      setLoading(false);
      setModalVisible(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: generatedQR 
          ? `Paiement: ${generatedQR.title}\nMontant: ${formatCurrency(generatedQR.amount)} Ar\n${generatedQR.description || ''}`
          : 'Mon QR code M\'Paye',
      });
    } catch (error) {
      console.error('Erreur de partage:', error);
    }
  };

  const resetQR = () => {
    setGeneratedQR(null);
    setStaticQR(true);
    setQrData({ title: '', amount: '', description: '' });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* En-tête */}
    

      {/* QR Code Static (par défaut) */}
      {staticQR && !generatedQR && (
        <>
          <View style={[styles.qrContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.qrHeader}>
              <Ionicons name="qr-code" size={180} color={colors.text} />
            </View>
            <Text style={[styles.qrTitle, { color: colors.text }]}>QR Code Static</Text>
            <Text style={[styles.qrSubtext, { color: colors.textSecondary }]}>
              Scannez ce code pour payer
            </Text>
            <Text style={[styles.qrAmount, { color: colors.primary }]}>
              Montant libre
            </Text>
          </View>

          <TouchableOpacity 
            style={[styles.generateButton, { backgroundColor: colors.primary }]}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="create-outline" size={20} color="#fff" />
            <Text style={styles.generateButtonText}>Générer un QR dynamique</Text>
          </TouchableOpacity>
        </>
      )}

      {/* QR Code Dynamique Généré */}
      {generatedQR && (
        <>
          <View style={[styles.qrContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.qrHeader}>
              <Ionicons name="qr-code" size={180} color={colors.primary} />
            </View>
            <Text style={[styles.qrTitle, { color: colors.text }]}>{generatedQR.title}</Text>
            <Text style={[styles.qrAmount, { color: colors.success, fontSize: 24, fontWeight: 'bold' }]}>
              {formatCurrency(generatedQR.amount)} Ar
            </Text>
            {generatedQR.description ? (
              <Text style={[styles.qrDescription, { color: colors.textSecondary }]}>
                {generatedQR.description}
              </Text>
            ) : null}
            <View style={styles.qrBadge}>
              <Ionicons name="time-outline" size={14} color={colors.warning} />
              <Text style={[styles.qrBadgeText, { color: colors.warning }]}>Valable 24h</Text>
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
                  Le QR code généré sera valable 24h et pourra être partagé avec votre client.
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
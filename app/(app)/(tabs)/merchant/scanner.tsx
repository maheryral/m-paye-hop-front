// app/(app)/(tabs)/merchant/scanner.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { merchantApi } from '../../../../src/services/merchantApi';

export default function MerchantScanner() {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [amountModal, setAmountModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [qrData, setQrData] = useState('');
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState(false);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="camera-outline" size={64} color={colors.textSecondary} />
        <Text style={[styles.permissionText, { color: colors.textSecondary }]}>Nous avons besoin de votre caméra</Text>
        <TouchableOpacity style={[styles.permissionButton, { backgroundColor: colors.primary }]} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Autoriser</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (!scanning) return;
    setScanning(false);

    if (data.includes('alipay') || data.includes('wxp') || data.startsWith('https://qr')) {
      setQrData(data);
      setAmountModal(true);
    } else {
      Alert.alert('Erreur', 'Code QR non valide', [{ text: 'Scanner à nouveau', onPress: () => setScanning(true) }]);
    }
  };

  const processPayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }

    setLoading(true);
    try {
      const response = await merchantApi.scanPayment(qrData, parseFloat(amount));
      if (response.data.success) {
        Alert.alert('Succès', `Paiement de ${formatCurrency(parseFloat(amount))} effectué !`, [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.response?.data?.message || 'Échec du paiement');
      setScanning(true);
    } finally {
      setLoading(false);
      setAmountModal(false);
      setAmount('');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-MG', { style: 'currency', currency: 'MGA' }).format(value);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
        enableTorch={flash}
      >
        <View style={styles.overlay}>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => setFlash(!flash)}>
              <Ionicons name={flash ? 'flash' : 'flash-off'} size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.scanFrame}>
            <View style={styles.cornerTL} /><View style={styles.cornerTR} />
            <View style={styles.cornerBL} /><View style={styles.cornerBR} />
          </View>
          <Text style={styles.scanText}>Scannez le code QR du client</Text>
        </View>
      </CameraView>

      <Modal visible={amountModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Montant à encaisser</Text>
            <TextInput
              style={[styles.amountInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="0"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => {
                setAmountModal(false); setAmount(''); setScanning(true);
              }}>
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.confirmButton, { backgroundColor: colors.primary }]} onPress={processPayment} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmButtonText}>Confirmer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 60 },
  headerButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 20 },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 280, height: 280, position: 'relative' },
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#fff' },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#fff' },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#fff' },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#fff' },
  scanText: { fontSize: 16, color: '#fff', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25 },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 20 },
  permissionText: { fontSize: 16, textAlign: 'center' },
  permissionButton: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  permissionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderRadius: 24, padding: 24, width: '80%', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  amountInput: { fontSize: 36, fontWeight: 'bold', borderWidth: 1, borderRadius: 16, padding: 16, width: '100%', textAlign: 'center', marginBottom: 24 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 12 },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: '#F0F0F0' },
  cancelButtonText: { fontWeight: '500' },
  confirmButton: { backgroundColor: '#1677FF' },
  confirmButtonText: { color: '#fff', fontWeight: 'bold' },
});
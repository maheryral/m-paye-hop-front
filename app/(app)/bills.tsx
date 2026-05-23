// app/(app)/bills.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import GradientHeader from '../../src/components/GradientHeader';

interface BillCategory {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

interface PendingBill {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface PaidBill {
  id: string;
  name: string;
  amount: number;
  paidDate: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export default function Bills() {
  const router = useRouter();
  const { colors } = useTheme();
  const [selectedBill, setSelectedBill] = useState<string | null>(null);
  const [contractNumber, setContractNumber] = useState('');
  const [amount, setAmount] = useState('');

  const billCategories: BillCategory[] = [
    { id: 'electricity', name: 'JIRAMA', icon: 'flash-outline', color: '#f59e0b' },
    { id: 'water', name: 'JIAMA', icon: 'water-outline', color: '#3b82f6' },
    { id: 'internet', name: 'Telma', icon: 'wifi-outline', color: '#8b5cf6' },
    { id: 'tv', name: 'Canal+', icon: 'tv-outline', color: '#ef4444' },
  ];

  // Factures à payer / payées — viendront du backend quand le module Bill sera implémenté
  const pendingBills: PendingBill[] = [];
  const paidBills: PaidBill[] = [];

  const handlePayBill = () => {
    if (!contractNumber) {
      Alert.alert('Erreur', 'Veuillez entrer le numéro de contrat');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un montant valide');
      return;
    }
    Alert.alert(
      'Confirmation',
      `Payer ${parseFloat(amount).toLocaleString()} Ar pour ${selectedBill} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Payer',
          onPress: () => {
            Alert.alert('Succès', 'Paiement effectué avec succès');
            setContractNumber('');
            setAmount('');
            setSelectedBill(null);
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader title="Factures" subtitle="Payez vos factures en un clic" />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>

        {/* Categories */}
        <View style={styles.categoriesGrid}>
          {billCategories.map((bill) => (
            <TouchableOpacity
              key={bill.id}
              style={[
                styles.categoryCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                selectedBill === bill.id && { borderColor: bill.color, backgroundColor: `${bill.color}20` },
              ]}
              onPress={() => setSelectedBill(bill.id)}
            >
              <Ionicons name={bill.icon} size={28} color={selectedBill === bill.id ? bill.color : colors.textSecondary} />
              <Text style={[styles.categoryName, { color: selectedBill === bill.id ? bill.color : colors.text }]}>
                {bill.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Payment Form */}
        {selectedBill && (
          <View style={[styles.paymentForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.text }]}>
              Payer la facture {billCategories.find(b => b.id === selectedBill)?.name}
            </Text>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Numéro de contrat</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="Entrez votre numéro de contrat"
                placeholderTextColor={colors.textSecondary}
                value={contractNumber}
                onChangeText={setContractNumber}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Montant (Ar)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
            </View>
            <TouchableOpacity
              style={[styles.payButton, { backgroundColor: colors.primary }]}
              onPress={handlePayBill}
            >
              <Ionicons name="lock-closed-outline" size={20} color="#fff" />
              <Text style={styles.payButtonText}>Payer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pending Bills */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>À payer</Text>
            <Text style={[styles.sectionCount, { color: colors.warning }]}>{pendingBills.length} factures</Text>
          </View>
          {pendingBills.map((bill) => (
            <View key={bill.id} style={[styles.billCard, { backgroundColor: `${colors.warning}15`, borderColor: colors.warning }]}>
              <View style={styles.billInfo}>
                <View style={[styles.billIcon, { backgroundColor: `${colors.warning}30` }]}>
                  <Ionicons name={bill.icon} size={20} color={colors.warning} />
                </View>
                <View>
                  <Text style={[styles.billName, { color: colors.text }]}>{bill.name}</Text>
                  <Text style={[styles.billDate, { color: colors.textSecondary }]}>À payer le {bill.dueDate}</Text>
                </View>
              </View>
              <View style={styles.billRight}>
                <Text style={[styles.billAmount, { color: colors.text }]}>{bill.amount.toLocaleString()} Ar</Text>
                <TouchableOpacity
                  style={[styles.payNowButton, { borderColor: colors.warning }]}
                  onPress={() => setSelectedBill(bill.name.toLowerCase())}
                >
                  <Text style={[styles.payNowText, { color: colors.warning }]}>Payer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Paid History */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Payées récemment</Text>
          {paidBills.map((bill) => (
            <View key={bill.id} style={[styles.paidBillCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.billInfo}>
                <View style={[styles.billIcon, { backgroundColor: `${colors.success}20` }]}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                </View>
                <View>
                  <Text style={[styles.billName, { color: colors.text }]}>{bill.name}</Text>
                  <Text style={[styles.billDate, { color: colors.textSecondary }]}>Payée le {bill.paidDate}</Text>
                </View>
              </View>
              <Text style={[styles.paidAmount, { color: colors.success }]}>{bill.amount.toLocaleString()} Ar</Text>
            </View>
          ))}
        </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  categoryCard: {
    flex: 1,
    minWidth: '22%',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '500',
  },
  paymentForm: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    gap: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 10,
    gap: 8,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionCount: {
    fontSize: 12,
  },
  billCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  billInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  billIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  billName: {
    fontSize: 14,
    fontWeight: '500',
  },
  billDate: {
    fontSize: 11,
    marginTop: 2,
  },
  billRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  billAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  payNowButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  payNowText: {
    fontSize: 12,
    fontWeight: '500',
  },
  paidBillCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  paidAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
});
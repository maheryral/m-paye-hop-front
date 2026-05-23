// app/(app)/(tabs)/merchant/help.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
  Modal,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../../src/contexts/ThemeContext';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export default function MerchantHelp() {
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  // FAQ données
  const faqs: FAQ[] = [
    {
      id: '1',
      question: 'Comment scanner un QR code ?',
      answer: 'Pour scanner un QR code, allez dans l\'onglet "Scanner" depuis le menu commerçant. Positionnez le QR code du client dans le cadre et le montant sera automatiquement déduit.',
      category: 'paiement',
    },
    {
      id: '2',
      question: 'Comment retirer mon argent ?',
      answer: 'Allez dans "Mon solde" puis cliquez sur "Retirer". Choisissez votre méthode (Mobile Money, Virement bancaire ou Cash) et suivez les instructions.',
      category: 'retrait',
    },
    {
      id: '3',
      question: 'Quels sont les frais de transaction ?',
      answer: 'Les frais dépendent du mode de paiement: Mobile Money 1%, Virement bancaire 0.5%, Retrait cash 0%. Les frais sont déduits automatiquement.',
      category: 'frais',
    },
    {
      id: '4',
      question: 'Comment créer un coupon ?',
      answer: 'Allez dans la section "Coupons", cliquez sur le bouton +. Remplissez les informations (code, réduction, dates de validité) et enregistrez.',
      category: 'coupons',
    },
    {
      id: '5',
      question: 'Comment modifier mes informations ?',
      answer: 'Allez dans "Mon entreprise", activez le mode édition avec le bouton stylo, modifiez vos informations et cliquez sur "Enregistrer".',
      category: 'compte',
    },
    {
      id: '6',
      question: 'Pourquoi mon paiement a échoué ?',
      answer: 'Les causes peuvent être: solde insuffisant, connexion internet instable, QR code expiré. Vérifiez ces points et réessayez.',
      category: 'paiement',
    },
    {
      id: '7',
      question: 'Comment générer un QR code dynamique ?',
      answer: 'Allez dans "Mon QR Code", cliquez sur "Générer un QR dynamique". Saisissez le titre, le montant et la description.',
      category: 'qrcode',
    },
    {
      id: '8',
      question: 'Délai de traitement des retraits ?',
      answer: 'Les retraits sont traités sous 24 à 48h ouvrées. Vous recevrez une notification une fois le transfert effectué.',
      category: 'retrait',
    },
    {
      id: '9',
      question: 'Comment ajouter une boutique ?',
      answer: 'Allez dans "Mes boutiques", cliquez sur le bouton +, remplissez les informations de votre nouvelle boutique et validez.',
      category: 'boutique',
    },
    {
      id: '10',
      question: 'Comment contacter le support ?',
      answer: 'Vous pouvez nous contacter via WhatsApp, email ou téléphone. Nos coordonnées sont disponibles ci-dessous.',
      category: 'support',
    },
  ];

  const categories = [
    { id: 'all', name: 'Tous', icon: 'apps-outline' },
    { id: 'paiement', name: 'Paiements', icon: 'cash-outline' },
    { id: 'retrait', name: 'Retraits', icon: 'arrow-down-outline' },
    { id: 'coupons', name: 'Coupons', icon: 'pricetag-outline' },
    { id: 'compte', name: 'Compte', icon: 'person-outline' },
    { id: 'boutique', name: 'Boutiques', icon: 'storefront-outline' },
    { id: 'frais', name: 'Frais', icon: 'trending-down-outline' },
    { id: 'support', name: 'Support', icon: 'headset-outline' },
  ];

  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSubmitTicket = async () => {
    if (!ticketSubject.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un sujet');
      return;
    }
    if (!ticketMessage.trim()) {
      Alert.alert('Erreur', 'Veuillez décrire votre problème');
      return;
    }

    setSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      Alert.alert('Succès', 'Votre demande a été envoyée. Nous vous répondrons sous 24h.');
      setShowTicketModal(false);
      setTicketSubject('');
      setTicketMessage('');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'envoyer votre demande');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhatsApp = () => {
    Linking.openURL('https://wa.me/261321234567?text=Bonjour%2C%20j\'ai%20besoin%20d\'aide%20sur%20l\'application%20M\'Paye');
  };

  const handleCall = () => {
    Linking.openURL('tel:+261321234567');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:support@mpaye.com?subject=Aide%20M\'Paye');
  };

  const handleShare = () => {
    Share.share({
      message: 'Application M\'Paye - Paiement mobile simple et sécurisé',
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Aide</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Ionicons name="share-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Rechercher une question..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryChip,
              { borderColor: colors.border },
              selectedCategory === category.id && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <Ionicons
              name={category.icon as any}
              size={16}
              color={selectedCategory === category.id ? '#fff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.categoryText,
                { color: selectedCategory === category.id ? '#fff' : colors.textSecondary }
              ]}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* FAQ Section */}
      <View style={styles.faqSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Questions fréquentes</Text>
        
        {filteredFaqs.length > 0 ? (
          filteredFaqs.map((faq) => (
            <View
              key={faq.id}
              style={[styles.faqCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <TouchableOpacity
                style={styles.faqHeader}
                onPress={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
              >
                <Text style={[styles.faqQuestion, { color: colors.text }]}>{faq.question}</Text>
                <Ionicons
                  name={expandedFaq === faq.id ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
              {expandedFaq === faq.id && (
                <View style={styles.faqAnswer}>
                  <Text style={[styles.faqAnswerText, { color: colors.textSecondary }]}>
                    {faq.answer}
                  </Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={styles.noResults}>
            <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>
              Aucun résultat trouvé
            </Text>
          </View>
        )}
      </View>

      {/* Contact Support */}
      <View style={styles.contactSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Contacter le support</Text>
        
        <View style={styles.contactGrid}>
          <TouchableOpacity
            style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleWhatsApp}
          >
            <View style={[styles.contactIcon, { backgroundColor: '#25D36620' }]}>
              <Ionicons name="logo-whatsapp" size={28} color="#25D366" />
            </View>
            <Text style={[styles.contactTitle, { color: colors.text }]}>WhatsApp</Text>
            <Text style={[styles.contactValue, { color: colors.textSecondary }]}>+261 32 12 345 67</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleCall}
          >
            <View style={[styles.contactIcon, { backgroundColor: `${colors.primary}20` }]}>
              <Ionicons name="call-outline" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.contactTitle, { color: colors.text }]}>Téléphone</Text>
            <Text style={[styles.contactValue, { color: colors.textSecondary }]}>+261 32 12 345 67</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleEmail}
          >
            <View style={[styles.contactIcon, { backgroundColor: '#EA433520' }]}>
              <Ionicons name="mail-outline" size={28} color="#EA4335" />
            </View>
            <Text style={[styles.contactTitle, { color: colors.text }]}>Email</Text>
            <Text style={[styles.contactValue, { color: colors.textSecondary }]}>support@mpaye.com</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Support Hours */}
      <View style={[styles.hoursCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.hoursHeader}>
          <Ionicons name="time-outline" size={20} color={colors.primary} />
          <Text style={[styles.hoursTitle, { color: colors.text }]}>Horaires d'assistance</Text>
        </View>
        <Text style={[styles.hoursText, { color: colors.textSecondary }]}>Lundi - Vendredi: 8h00 - 18h00</Text>
        <Text style={[styles.hoursText, { color: colors.textSecondary }]}>Samedi: 9h00 - 13h00</Text>
        <Text style={[styles.hoursText, { color: colors.textSecondary }]}>Dimanche: Fermé</Text>
      </View>

      {/* Support Ticket Button */}
      <TouchableOpacity
        style={[styles.ticketButton, { backgroundColor: colors.primary }]}
        onPress={() => setShowTicketModal(true)}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
        <Text style={styles.ticketButtonText}>Envoyer une demande</Text>
      </TouchableOpacity>

      {/* Ticket Modal */}
      <Modal
        visible={showTicketModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTicketModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Nouvelle demande</Text>
              <TouchableOpacity onPress={() => setShowTicketModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.ticketForm}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Sujet</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="Ex: Problème de paiement"
                  placeholderTextColor={colors.textSecondary}
                  value={ticketSubject}
                  onChangeText={setTicketSubject}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Message</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="Décrivez votre problème..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={6}
                  value={ticketMessage}
                  onChangeText={setTicketMessage}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.primary }]}
                onPress={handleSubmitTicket}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Envoyer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Espace */}
      <View style={{ height: 30 }} />
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
    borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  shareButton: { padding: 8 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },

  categoriesContainer: { marginBottom: 16 },
  categoriesContent: { paddingHorizontal: 16, gap: 10 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  categoryText: { fontSize: 13, fontWeight: '500' },

  faqSection: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },

  faqCard: {
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestion: { fontSize: 14, fontWeight: '500', flex: 1, marginRight: 12 },
  faqAnswer: { paddingHorizontal: 16, paddingBottom: 16 },
  faqAnswerText: { fontSize: 13, lineHeight: 20 },

  noResults: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  noResultsText: { fontSize: 14 },

  contactSection: { paddingHorizontal: 16, marginBottom: 24 },
  contactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  contactCard: {
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  contactIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  contactTitle: { fontSize: 13, fontWeight: '500' },
  contactValue: { fontSize: 11, textAlign: 'center' },

  hoursCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  hoursHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  hoursTitle: { fontSize: 14, fontWeight: '600' },
  hoursText: { fontSize: 13, marginBottom: 4 },

  ticketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  ticketButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  ticketForm: { gap: 16 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 14, fontWeight: '500' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  textArea: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, height: 120, textAlignVertical: 'top' },
  submitButton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
import React, { useState, useEffect, useCallback } from 'react';
import { Stack, router, useFocusEffect } from 'expo-router';
import { TouchableOpacity, View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { useRole } from '../../../../src/contexts/RoleContext';

export default function MerchantLayout() {
  const { colors } = useTheme();
  const { merchantProfile, loading: roleLoading } = useRole();
  const [isLoading, setIsLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));

  // Chargement au montage et à chaque focus
  useFocusEffect(
    useCallback(() => {
      // Réinitialiser l'état de chargement
      setIsLoading(true);
      
      // Animation d'entrée
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      // Attendre que les données du rôle soient chargées
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 600);

      return () => {
        clearTimeout(timer);
      };
    }, [roleLoading])
  );

  // En-tête marchand = bleu primaire (cohérent avec le dashboard, OK clair/sombre)
  const merchantColor = colors.primary;

  // Écran de chargement
  if (isLoading || roleLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: merchantColor }]}>
        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
          <View style={styles.loadingIconContainer}>
            <Ionicons name="storefront" size={48} color="#fff" />
          </View>
          <ActivityIndicator size="large" color="#fff" style={styles.loadingSpinner} />
          <Text style={styles.loadingTitle}>Espace Commerçant</Text>
          <Text style={styles.loadingSubtitle}>Chargement de votre espace...</Text>
          
          <View style={styles.loadingSteps}>
            <View style={styles.loadingStep}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
              <Text style={styles.loadingStepText}>Préparation du tableau de bord</Text>
            </View>
            <View style={styles.loadingStep}>
              <Ionicons name="sync-outline" size={16} color="#fff" />
              <Text style={styles.loadingStepText}>Chargement des données</Text>
            </View>
            <View style={styles.loadingStep}>
              <Ionicons name="shield-outline" size={16} color="#fff" />
              <Text style={styles.loadingStepText}>Vérification de sécurité</Text>
            </View>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        // En-têtes natifs masqués sur tout l'espace marchand (chaque écran gère
        // son propre header in-page si besoin).
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="dashboard"
        options={{
          // En-tête natif masqué : le dashboard a son propre header in-page.
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="transactions"
        options={{
          title: 'Mes ventes',
        }}
      />

      <Stack.Screen
        name="transaction/[id]"
        options={{
          title: 'Détail vente',
        }}
      />

      <Stack.Screen
        name="scanner"
        options={{
          title: '',
          presentation: 'modal',
          headerStyle: { backgroundColor: '#000' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 16 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      <Stack.Screen
        name="qrcode"
        options={{
          title: 'Mon QR code',
        }}
      />

      <Stack.Screen
        name="payment-links"
        options={{
          title: 'Liens de paiement',
        }}
      />

      <Stack.Screen
        name="loyalty"
        options={{
          title: 'Programme de fidélité',
        }}
      />

      <Stack.Screen
        name="analytics"
        options={{
          title: 'Statistiques',
        }}
      />

      <Stack.Screen
        name="store"
        options={{
          title: 'Mes boutiques',
        }}
      />

      <Stack.Screen
        name="store/[id]"
        options={{
          title: 'Modifier boutique',
        }}
      />

      <Stack.Screen
        name="coupons"
        options={{
          title: 'Coupons',
        }}
      />

      <Stack.Screen
        name="coupons/create"
        options={{
          title: 'Nouveau coupon',
        }}
      />

      <Stack.Screen
        name="refunds"
        options={{
          title: 'Remboursements',
        }}
      />

      <Stack.Screen
        name="refunds/[id]"
        options={{
          title: 'Détail remboursement',
        }}
      />

      <Stack.Screen
        name="balance"
        options={{
          title: 'Mon solde',
        }}
      />

      <Stack.Screen
        name="withdraw"
        options={{
          title: 'Retrait',
          presentation: 'modal',
        }}
      />

      <Stack.Screen
        name="settings"
        options={{
          title: 'Paramètres',
        }}
      />

      <Stack.Screen
        name="profile"
        options={{
          title: 'Mon entreprise',
        }}
      />

      <Stack.Screen
        name="notifications"
        options={{
          title: 'Notifications',
        }}
      />

      <Stack.Screen
        name="reports"
        options={{
          title: 'Rapports',
        }}
      />

      <Stack.Screen
        name="help"
        options={{
          title: 'Aide',
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loadingSpinner: {
    marginTop: 20,
  },
  loadingTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 20,
  },
  loadingSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 8,
  },
  loadingSteps: {
    marginTop: 40,
    gap: 12,
  },
  loadingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingStepText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
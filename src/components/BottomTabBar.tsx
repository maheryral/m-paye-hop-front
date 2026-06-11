// src/components/BottomTabBar.tsx
// Barre de navigation basse réutilisable (Accueil · Services · Scan · Messages · Profil).
// À rendre une fois dans le conteneur racine (flex/relatif) de chaque écran ;
// elle se positionne en absolu en bas. L'onglet actif est déduit de la route.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, usePathname, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

/** Hauteur occupée par la barre — utile pour le paddingBottom des écrans. */
export const BOTTOM_BAR_HEIGHT = 76;

export default function BottomTabBar() {
  const router = useRouter();
  const navigation = useNavigation();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const isActive = (route: string) => pathname === route || pathname.startsWith(route + '/');

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          paddingBottom: insets.bottom > 0 ? insets.bottom - 6 : 12,
        },
      ]}
    >
      <TabButton
        icon="home-outline"
        label="Accueil"
        active={isActive('/dashboard')}
        colors={colors}
        onPress={() => router.navigate('/dashboard')}
      />
      <TabButton
        icon="apps-outline"
        label="Services"
        active={isActive('/bills')}
        colors={colors}
        onPress={() => router.navigate('/bills')}
      />

      {/* FAB scan central */}
      <View style={styles.fabSlot}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/qr-payment')}>
          <LinearGradient colors={['#2563eb', '#1e40af']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
            <Ionicons name="scan-outline" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <TabButton
        icon="chatbubble-outline"
        label="Messages"
        badge
        active={isActive('/messages')}
        colors={colors}
        onPress={() => router.navigate('/messages')}
      />
      <TabButton
        icon="person-outline"
        label="Profil"
        colors={colors}
        onPress={() => (navigation as any).openDrawer?.()}
      />
    </View>
  );
}

function TabButton({
  icon,
  label,
  active,
  badge,
  colors,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  badge?: boolean;
  colors: { primary: string; text: string; textSecondary: string };
  onPress: () => void;
}) {
  const color = active ? colors.primary : colors.textSecondary;
  return (
    <TouchableOpacity style={styles.tabBtn} activeOpacity={0.7} onPress={onPress}>
      <View>
        <Ionicons
          name={active ? (icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap) : icon}
          size={22}
          color={color}
        />
        {badge && <View style={styles.tabBadge} />}
      </View>
      <Text style={[styles.tabLabel, { color, fontWeight: active ? '700' : '500' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingTop: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  tabBtn: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { fontSize: 10 },
  tabBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
  },
  fabSlot: { flex: 1, alignItems: 'center' },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -26,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
});

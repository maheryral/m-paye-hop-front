// app/_layout.tsx - Vérifiez que RoleProvider est bien présent
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StatusBar, ActivityIndicator, StyleSheet, Text, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, cloneElement } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import { Font } from '../constants/fonts';
import { StripeProvider } from '@stripe/stripe-react-native';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { AuthProvider } from '../src/contexts/AuthContext';
import { WalletProvider } from '../src/contexts/WalletContext';
import { AccountProvider } from '../src/contexts/AccountContext';
import { RoleProvider } from '../src/contexts/RoleContext';
import { BiometricGuardProvider } from '../src/contexts/BiometricGuardContext';
import { SocketProvider } from '../src/contexts/SocketContext';
import { LocaleProvider } from '../src/contexts/LocaleContext';
import NotificationToast from '../src/components/NotificationToast';
import { DeepLinkHandler } from '../src/components/DeepLinkHandler';

SplashScreen.preventAutoHideAsync();

/**
 * Applique Poppins globalement en injectant la bonne variante selon le
 * `fontWeight` de chaque <Text>/<TextInput>. Les styles qui fixent déjà un
 * fontFamily sont respectés. Permet de garder les poids existants de l'app
 * sans toucher à chaque écran.
 */
function weightToPoppins(weight?: string | number): string {
  switch (String(weight ?? '400')) {
    case '500':
      return Font.medium;
    case '600':
      return Font.semibold;
    case '700':
    case 'bold':
      return Font.bold;
    case '800':
    case '900':
      return Font.extrabold;
    default:
      return Font.regular;
  }
}

function patchDefaultFont(Component: any) {
  if (!Component || Component.__poppinsPatched) return;
  Component.__poppinsPatched = true;
  const originalRender = Component.render;
  Component.render = function (...args: any[]) {
    const element = originalRender.apply(this, args);
    const flat = StyleSheet.flatten(element.props.style) || {};
    const fontFamily = flat.fontFamily || weightToPoppins(flat.fontWeight);
    return cloneElement(element, {
      style: [element.props.style, { fontFamily }],
    });
  };
}

patchDefaultFont(Text);
patchDefaultFont(TextInput);

function CustomSplashScreen() {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.splashContainer, { backgroundColor: colors.background }]}>
      <View style={styles.splashContent}>
        <View style={[styles.logoWrapper, { backgroundColor: `${colors.primary}20` }]}>
          <Ionicons name="wallet-outline" size={60} color={colors.primary} />
        </View>
        <Text style={[styles.logoText, { color: colors.text }]}>M'Paye</Text>
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      </View>
    </View>
  );
}

function ThemedStatusBar() {
  const { isDark, colors } = useTheme();
  return <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />;
}

function RootLayoutNav() {
  const { colors } = useTheme();
  const [isReady, setIsReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });
  // Clé publishable Stripe : config super-admin en priorité, sinon variable d'env
  const [stripeKey, setStripeKey] = useState<string>(
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  );

  useEffect(() => {
    async function prepare() {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();

    // Récupère la clé publishable Stripe depuis la config fournisseurs (public)
    (async () => {
      try {
        const { providersApi } = await import('../src/services/providersApi');
        const { data } = await providersApi.getPublic();
        const stripe = Array.isArray(data)
          ? data.find((p) => p.code === 'STRIPE')
          : null;
        const pk = stripe?.config?.publishableKey;
        if (pk) setStripeKey(pk);
      } catch {
        // garde la clé d'env par défaut
      }
    })();
  }, []);

  if (!isReady || !fontsLoaded) {
    return <CustomSplashScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemedStatusBar />
        <StripeProvider publishableKey={stripeKey}>
        <AuthProvider>
          <LocaleProvider>
          <BiometricGuardProvider>
            <SocketProvider>
              <RoleProvider>
                <AccountProvider>
                  <WalletProvider>
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: colors.background },
                        animation: 'slide_from_right',
                      }}
                    >
                      <Stack.Screen name="index" />
                      <Stack.Screen name="(auth)" />
                      <Stack.Screen name="(app)" />
                    </Stack>
                    <NotificationToast />
                    <DeepLinkHandler />
                  </WalletProvider>
                </AccountProvider>
              </RoleProvider>
            </SocketProvider>
          </BiometricGuardProvider>
          </LocaleProvider>
        </AuthProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutNav />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    alignItems: 'center',
    gap: 24,
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  loader: {
    marginTop: 20,
  },
});
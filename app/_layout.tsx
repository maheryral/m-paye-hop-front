// app/_layout.tsx - Vérifiez que RoleProvider est bien présent
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StatusBar, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { AuthProvider } from '../src/contexts/AuthContext';
import { WalletProvider } from '../src/contexts/WalletContext';
import { AccountProvider } from '../src/contexts/AccountContext';
import { RoleProvider } from '../src/contexts/RoleContext';
import { BiometricGuardProvider } from '../src/contexts/BiometricGuardContext';
import { SocketProvider } from '../src/contexts/SocketContext';
import { LocaleProvider } from '../src/contexts/LocaleContext';
import NotificationToast from '../src/components/NotificationToast';

SplashScreen.preventAutoHideAsync();

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
  }, []);

  if (!isReady) {
    return <CustomSplashScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemedStatusBar />
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
                  </WalletProvider>
                </AccountProvider>
              </RoleProvider>
            </SocketProvider>
          </BiometricGuardProvider>
          </LocaleProvider>
        </AuthProvider>
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
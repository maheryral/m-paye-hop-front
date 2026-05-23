import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { WalletProvider } from './src/contexts/WalletContext';
import { AccountProvider } from './src/contexts/AccountContext';

// Écrans
import Login from './app/(auth)/login';
import Register from './app/(auth)/register';
import ForgotPassword from './app/(auth)/forgot-password';
import Dashboard from './app/(app)/dashboard';
import Portfolio from './app/(app)/portfolio';
import Transfers from './app/(app)/transfers';
import QrPayment from './app/(app)/qr-payment';
import History from './app/(app)/history';
import Beneficiaries from './app/(app)/beneficiaries';
import Bills from './app/(app)/bills';
import Cards from './app/(app)/cards';
import Settings from './app/(app)/settings';
import Security from './app/(app)/security';
import CompleteProfile from './app/(app)/complete-profile';
import Notifications from './app/(app)/notifications';

const Stack = createNativeStackNavigator();

SplashScreen.preventAutoHideAsync();

function AppNavigator() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      {!user ? (
        <>
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="Register" component={Register} />
          <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
        </>
      ) : (
        <>
          <Stack.Screen name="Dashboard" component={Dashboard} />
          <Stack.Screen name="Portfolio" component={Portfolio} />
          <Stack.Screen name="Transfers" component={Transfers} />
          <Stack.Screen name="QrPayment" component={QrPayment} />
          <Stack.Screen name="History" component={History} />
          <Stack.Screen name="Beneficiaries" component={Beneficiaries} />
          <Stack.Screen name="Bills" component={Bills} />
          <Stack.Screen name="Cards" component={Cards} />
          <Stack.Screen name="Settings" component={Settings} />
          <Stack.Screen name="Security" component={Security} />
          <Stack.Screen name="CompleteProfile" component={CompleteProfile} options={{ presentation: 'modal' }} />
          <Stack.Screen name="Notifications" component={Notifications} />
        </>
      )}
    </Stack.Navigator>
  );
}

// Composant racine
function AppContent() {
  const [isReady, setIsReady] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    async function prepare() {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
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
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <AuthProvider>
        <AccountProvider>
          <WalletProvider>
            <AppNavigator />
          </WalletProvider>
        </AccountProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}

// Export principal
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
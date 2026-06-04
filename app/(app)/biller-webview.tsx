// app/(app)/biller-webview.tsx
// Écran WebView plein écran pour ouvrir un mini-program biller.
// Appelé depuis bills.tsx après /billers/launch-token avec :
//   - url   : URL absolue du mini-program + ?source=mobile&token=<jwt>
//   - name  : nom affiché du biller
//   - color : couleur d'accent (header)

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import type { WebView as WebViewType } from 'react-native-webview';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function BillerWebView() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    url?: string;
    name?: string;
    color?: string;
  }>();

  const url = params.url ?? '';
  const name = params.name ?? 'Service';
  const accentColor = params.color ?? colors.primary;

  const webRef = useRef<WebViewType>(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);

  function close() {
    router.back();
  }

  function goBackInWebView() {
    if (webRef.current && canGoBack) {
      webRef.current.goBack();
    } else {
      close();
    }
  }

  if (!url) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Text style={{ color: colors.text }}>URL manquante</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: accentColor + '44', backgroundColor: '#0a0a0a' },
        ]}
      >
        <TouchableOpacity onPress={goBackInWebView} style={styles.headerBtn}>
          <Ionicons
            name={canGoBack ? 'arrow-back' : 'close'}
            size={22}
            color="#fff"
          />
        </TouchableOpacity>

        <View style={styles.headerTitle}>
          <View
            style={[styles.accentDot, { backgroundColor: accentColor }]}
          />
          <Text style={styles.headerName} numberOfLines={1}>
            {name}
          </Text>
        </View>

        <TouchableOpacity
          onPress={close}
          style={styles.headerBtn}
          disabled={!canGoBack}
        >
          <Ionicons
            name="close"
            size={22}
            color={canGoBack ? '#fff' : 'transparent'}
          />
        </TouchableOpacity>
      </View>

      {/* WebView */}
      <View style={{ flex: 1 }}>
        <WebView
          ref={webRef}
          source={{ uri: url }}
          style={{ flex: 1 }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={(nav) => setCanGoBack(nav.canGoBack)}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            setLoading(false);
            Alert.alert(
              'Erreur de chargement',
              nativeEvent.description || 'Impossible de charger le service.',
              [{ text: 'OK', onPress: close }],
            );
          }}
          // Permet aux mini-programs d'utiliser localStorage / cookies
          domStorageEnabled
          javaScriptEnabled
          // Empêche l'ouverture de liens hors-domaine dans la WebView
          // (sera implémenté plus tard si besoin avec onShouldStartLoadWithRequest)
        />

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={accentColor} />
            <Text style={styles.loadingText}>Chargement {name}…</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  accentDot: { width: 8, height: 8, borderRadius: 4 },
  headerName: { color: '#fff', fontSize: 14, fontWeight: '700' },

  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  loadingText: { color: '#fff', marginTop: 12, fontSize: 13 },
});

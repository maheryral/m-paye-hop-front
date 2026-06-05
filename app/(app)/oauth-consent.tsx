// app/(app)/oauth-consent.tsx
// Page de consentement OAuth (équivalent natif de /oauth/consent web).
//
// Entrée : deep-link monpaye://oauth/consent?app_id=...&scopes=...&redirect_uri=...&state=...
//
// L'user voit l'identité du partenaire + les scopes demandés, puis :
//   - "Autoriser" → POST /oauth/authorize → code → ouvre redirect_uri?code=...&state=...
//   - "Refuser"   → ouvre redirect_uri?error=access_denied&state=...

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import {
  oauthApi,
  type OAuthScope,
  type PartnerPublicInfo,
} from '../../src/services/oauthApi';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const SCOPE_META: Record<
  OAuthScope,
  { label: string; description: string; icon: IoniconName }
> = {
  auth_user: {
    label: 'Votre identifiant',
    description: 'Pour vous identifier (sans révéler email/téléphone)',
    icon: 'person-outline',
  },
  auth_phone: {
    label: 'Votre numéro de téléphone',
    description: 'Pour vous contacter au sujet de vos commandes',
    icon: 'call-outline',
  },
  auth_email: {
    label: 'Votre email',
    description: 'Pour recevoir reçus et confirmations',
    icon: 'mail-outline',
  },
  trade: {
    label: 'Initier des paiements',
    description: 'Le partenaire pourra demander des paiements (vous validerez chaque fois)',
    icon: 'card-outline',
  },
  trade_refund: {
    label: 'Initier des remboursements',
    description: 'Vous rembourser sans intervention de votre part',
    icon: 'refresh-outline',
  },
  wallet_balance: {
    label: 'Voir votre solde',
    description: 'Consulter le solde de votre wallet',
    icon: 'wallet-outline',
  },
};

export default function OauthConsent() {
  const params = useLocalSearchParams<{
    app_id?: string;
    scopes?: string;
    redirect_uri?: string;
    state?: string;
  }>();
  const router = useRouter();
  const { colors } = useTheme();

  const appId = pickStr(params.app_id);
  const scopesRaw = pickStr(params.scopes);
  const redirectUri = pickStr(params.redirect_uri);
  const state = pickStr(params.state) || undefined;

  const scopes = useMemo<OAuthScope[]>(
    () =>
      scopesRaw
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is OAuthScope => (s as OAuthScope) in SCOPE_META),
    [scopesRaw],
  );

  const [partner, setPartner] = useState<PartnerPublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!appId) {
      setError('Paramètre app_id manquant');
      setLoading(false);
      return;
    }
    if (!redirectUri) {
      setError('Paramètre redirect_uri manquant');
      setLoading(false);
      return;
    }
    if (scopes.length === 0) {
      setError('Au moins un scope valide est requis');
      setLoading(false);
      return;
    }

    let active = true;
    oauthApi
      .partnerInfo(appId)
      .then((p) => {
        if (!active) return;
        if (!p.isActive) {
          setError('Ce partenaire est désactivé.');
        } else if (!p.redirectUris.includes(redirectUri)) {
          setError('redirect_uri non autorisé pour ce partenaire.');
        } else {
          // ne garde que les scopes que le partenaire est autorisé à demander
          const unallowed = scopes.filter((s) => !p.allowedScopes.includes(s));
          if (unallowed.length > 0) {
            setError(`Scopes non autorisés : ${unallowed.join(', ')}`);
          }
          setPartner(p);
        }
      })
      .catch((err: any) => {
        if (!active) return;
        setError(
          err?.response?.data?.message ??
            err?.message ??
            'Partenaire introuvable.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [appId, redirectUri, scopes]);

  const handleAuthorize = async () => {
    if (!partner) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await oauthApi.authorize({
        app_id: appId,
        scopes,
        redirect_uri: redirectUri,
        state,
      });
      openRedirect(redirectUri, { code: res.code, state });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          err?.message ??
          "Impossible d'autoriser la demande.",
      );
      setSubmitting(false);
    }
  };

  const handleDeny = () => {
    openRedirect(redirectUri, { error: 'access_denied', state });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingLabel, { color: colors.textSecondary }]}>
            Chargement…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !partner) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <View style={[styles.errorBubble, { backgroundColor: colors.error + '20' }]}>
            <Ionicons name="alert-circle" size={64} color={colors.error} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Demande invalide</Text>
          <Text style={[styles.errorMsg, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity
            onPress={() => router.replace('/(app)/dashboard')}
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.primaryBtnText}>Retour à M'Paye</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!partner) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Logo + nom partenaire */}
        <View style={styles.partnerHeader}>
          {partner.logoUrl ? (
            <Image source={{ uri: partner.logoUrl }} style={styles.partnerLogo} />
          ) : (
            <View
              style={[
                styles.partnerLogo,
                styles.partnerLogoPlaceholder,
                { backgroundColor: colors.primary + '20' },
              ]}
            >
              <Text style={[styles.partnerLogoLetter, { color: colors.primary }]}>
                {partner.name.charAt(0)}
              </Text>
            </View>
          )}
          <Text style={[styles.partnerName, { color: colors.text }]}>{partner.name}</Text>
          {partner.description ? (
            <Text style={[styles.partnerDesc, { color: colors.textSecondary }]}>
              {partner.description}
            </Text>
          ) : null}
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          {partner.name} demande l'accès à
        </Text>

        {/* Liste des scopes */}
        <View style={[styles.scopesCard, { backgroundColor: colors.card }]}>
          {scopes.map((scope) => {
            const meta = SCOPE_META[scope];
            return (
              <View key={scope} style={styles.scopeRow}>
                <View
                  style={[
                    styles.scopeIconBox,
                    { backgroundColor: colors.primary + '15' },
                  ]}
                >
                  <Ionicons name={meta.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.scopeText}>
                  <Text style={[styles.scopeLabel, { color: colors.text }]}>
                    {meta.label}
                  </Text>
                  <Text style={[styles.scopeDesc, { color: colors.textSecondary }]}>
                    {meta.description}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.error + '15' }]}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {/* Note de sécurité */}
        <View style={[styles.securityNote, { backgroundColor: colors.borderLight }]}>
          <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
          <Text style={[styles.securityText, { color: colors.textSecondary }]}>
            Vous pouvez révoquer cet accès à tout moment depuis Paramètres → Applications connectées.
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: colors.background, borderTopColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={handleDeny}
          disabled={submitting}
          style={[styles.secondaryBtn, { backgroundColor: colors.borderLight }]}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Refuser</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleAuthorize}
          disabled={submitting || !!error}
          style={[
            styles.primaryBtn,
            styles.flex1,
            { backgroundColor: colors.primary, opacity: submitting || error ? 0.6 : 1 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Autoriser</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function pickStr(v: string | string[] | undefined): string {
  if (!v) return '';
  return Array.isArray(v) ? v[0] : v;
}

function openRedirect(redirectUri: string, params: Record<string, string | undefined>) {
  try {
    const sep = redirectUri.includes('?') ? '&' : '?';
    const qs = Object.entries(params)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`)
      .join('&');
    Linking.openURL(redirectUri + sep + qs).catch(() => {});
  } catch {
    // ignore
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingLabel: { marginTop: 12, fontSize: 14 },

  scroll: { padding: 20, paddingBottom: 40 },

  partnerHeader: { alignItems: 'center', marginVertical: 24 },
  partnerLogo: { width: 80, height: 80, borderRadius: 20 },
  partnerLogoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  partnerLogoLetter: { fontSize: 32, fontWeight: 'bold' },
  partnerName: { fontSize: 22, fontWeight: 'bold', marginTop: 12 },
  partnerDesc: { fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },

  title: { fontSize: 16, fontWeight: '600', marginBottom: 12, paddingHorizontal: 4 },

  scopesCard: { borderRadius: 16, padding: 8 },
  scopeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12 },
  scopeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeText: { flex: 1 },
  scopeLabel: { fontSize: 14, fontWeight: '600' },
  scopeDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  errorText: { flex: 1, fontSize: 13 },
  errorMsg: { fontSize: 14, textAlign: 'center', marginBottom: 32, paddingHorizontal: 16 },
  errorBubble: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  securityText: { flex: 1, fontSize: 12, lineHeight: 16 },

  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
  },
  secondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
  primaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex1: { flex: 1 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

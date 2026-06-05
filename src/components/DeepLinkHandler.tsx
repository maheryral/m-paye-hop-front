// src/components/DeepLinkHandler.tsx
//
// Intercepte les deep-links monpaye://... reçus par l'app :
//   - monpaye://trade/pay?trade_no=...&return_url=...
//   - monpaye://oauth/consent?app_id=...&scopes=...&redirect_uri=...&state=...
//
// Comportement :
//   1. Cold-start (app fermée) : Linking.getInitialURL() au premier rendu.
//   2. App ouverte : addEventListener('url') sur chaque nouveau lien.
//   3. Si l'user est loggé → router.push direct vers la page native.
//   4. Sinon → mémorise l'URL en attente + redirige vers /login.
//      Après login, AuthContext appellera consumePendingDeepLink() pour la rejouer.
//
// À monter UNE SEULE FOIS dans app/_layout.tsx, à l'intérieur de AuthProvider.

import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';

const PENDING_KEY = 'pendingDeepLink';

interface ParsedLink {
  pathname: string;
  params: Record<string, string>;
}

/** Parse "monpaye://trade/pay?a=1&b=2" → { pathname:'/(app)/trade-pay', params:{a:'1',b:'2'} } */
function parseDeepLink(url: string): ParsedLink | null {
  try {
    // Remplace le scheme par http:// pour que URL() parse correctement
    const normalized = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, 'http://');
    const u = new URL(normalized);
    // host = "trade", pathname = "/pay" → on reconstitue "trade/pay"
    const path = (u.host + u.pathname).replace(/^\/+|\/+$/g, '');
    const params: Record<string, string> = {};
    u.searchParams.forEach((v, k) => {
      params[k] = v;
    });

    // Routes connues : trade/pay et oauth/consent (avec ou sans slash)
    if (path === 'trade/pay' || path === 'trade-pay') {
      return { pathname: '/(app)/trade-pay', params };
    }
    if (path === 'oauth/consent' || path === 'oauth-consent') {
      return { pathname: '/(app)/oauth-consent', params };
    }
    return null;
  } catch {
    return null;
  }
}

export async function setPendingDeepLink(url: string) {
  try {
    await AsyncStorage.setItem(PENDING_KEY, url);
  } catch {
    // ignore
  }
}

export async function consumePendingDeepLink(): Promise<string | null> {
  try {
    const url = await AsyncStorage.getItem(PENDING_KEY);
    if (url) await AsyncStorage.removeItem(PENDING_KEY);
    return url;
  } catch {
    return null;
  }
}

export function DeepLinkHandler() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const handledColdStartRef = useRef(false);

  const dispatch = async (url: string) => {
    const parsed = parseDeepLink(url);
    if (!parsed) return;

    if (!user) {
      await setPendingDeepLink(url);
      // login redirige déjà depuis index.tsx, on s'assure d'y aller
      router.replace('/(auth)/login');
      return;
    }

    router.push({
      pathname: parsed.pathname as any,
      params: parsed.params,
    });
  };

  // Cold-start : URL d'ouverture initiale
  useEffect(() => {
    if (loading || handledColdStartRef.current) return;
    handledColdStartRef.current = true;

    (async () => {
      const initial = await Linking.getInitialURL();
      if (initial) {
        await dispatch(initial);
        return;
      }
      // Si pas d'URL au cold-start mais qu'on a un pending (cas : login vient de se faire)
      if (user) {
        const pending = await consumePendingDeepLink();
        if (pending) await dispatch(pending);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  // Pendant que l'app tourne
  useEffect(() => {
    const sub = Linking.addEventListener('url', (event) => {
      void dispatch(event.url);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return null;
}

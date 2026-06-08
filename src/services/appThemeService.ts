// src/services/appThemeService.ts
//
// Charge le thème global depuis /app-theme avec :
//   - Fetch au cold-start
//   - Cache local AsyncStorage (TTL 24h)
//   - Fallback sur defaults bundlés si l'API est down (offline / serveur HS)
//
// Le ThemeContext consomme ce service via fetchTheme(). Pas besoin de
// l'instance axios authentifiée — l'endpoint est public.

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config/env';

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  secondary: string;
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderLight: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  overlay: string;
  shadow: string;
}

export interface AppTheme {
  colorsLight: ThemeColors;
  colorsDark: ThemeColors;
  version: number;
  updatedAt: string;
}

// Defaults bundlés — utilisés si API down au tout premier lancement.
// Doivent rester en phase avec la migration seed côté backend.
export const DEFAULT_LIGHT_COLORS: ThemeColors = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  secondary: '#8b5cf6',
  background: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  error: '#ef4444',
  success: '#3b82f6',
  warning: '#f59e0b',
  info: '#3b82f6',
  overlay: 'rgba(0,0,0,0.5)',
  shadow: '#000000',
};

export const DEFAULT_DARK_COLORS: ThemeColors = {
  primary: '#3b82f6',
  primaryDark: '#2563eb',
  secondary: '#a78bfa',
  background: '#0f172a',
  card: '#1e293b',
  text: '#f8fafc',
  textSecondary: '#94a3b8',
  textTertiary: '#64748b',
  border: '#334155',
  borderLight: '#1e293b',
  error: '#f87171',
  success: '#60a5fa',
  warning: '#fbbf24',
  info: '#60a5fa',
  overlay: 'rgba(0,0,0,0.7)',
  shadow: '#000000',
};

export const DEFAULT_THEME: AppTheme = {
  colorsLight: DEFAULT_LIGHT_COLORS,
  colorsDark: DEFAULT_DARK_COLORS,
  version: 0,
  updatedAt: new Date(0).toISOString(),
};

const STORAGE_KEY = '@app_theme_v1';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h — le cache reste valide même offline

interface CachedTheme {
  theme: AppTheme;
  cachedAt: number;
}

/** Lit le cache (synchrone si possible) — utile au boot avant fetch. */
export async function readCachedTheme(): Promise<AppTheme | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedTheme;
    if (!parsed?.theme || !parsed.theme.colorsLight) return null;
    // Cache toujours utilisable même expiré — la fraîcheur viendra du fetch.
    // On le retourne juste pour éviter de flasher les defaults au boot.
    return parsed.theme;
  } catch {
    return null;
  }
}

/** Écrit le cache. */
async function writeCachedTheme(theme: AppTheme) {
  try {
    const payload: CachedTheme = { theme, cachedAt: Date.now() };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

/**
 * Fetch le thème depuis l'API. Retourne null en cas d'erreur réseau.
 * Le caller utilisera le cache ou les defaults dans ce cas.
 */
export async function fetchTheme(): Promise<AppTheme | null> {
  try {
    const res = await axios.get<AppTheme>(`${API_BASE_URL}/app-theme`, {
      timeout: REQUEST_TIMEOUT_MS,
      // Pas de token : endpoint public
    });
    if (!res.data?.colorsLight || !res.data?.colorsDark) return null;
    await writeCachedTheme(res.data);
    return res.data;
  } catch {
    return null;
  }
}

/**
 * Résout le thème à utiliser au boot :
 *   1. Lit le cache (rapide, évite flash)
 *   2. Fetch fresh en parallèle (asynchrone, applique quand prêt)
 *   3. Si rien : defaults bundlés
 *
 * Retour : { initial, fresh } — `initial` est sync (cache OU defaults),
 * `fresh` est une Promise qui se résout avec la version DB si fetch OK.
 */
export async function resolveBootTheme(): Promise<{
  initial: AppTheme;
  fresh: Promise<AppTheme | null>;
}> {
  const cached = await readCachedTheme();
  const initial = cached ?? DEFAULT_THEME;
  // Fetch en arrière-plan
  const fresh = fetchTheme();
  return { initial, fresh };
}

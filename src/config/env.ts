/**
 * Configuration centrale de l'environnement front.
 *
 * Pour changer l'IP du backend en dev :
 *   1. Modifier API_BASE_URL ci-dessous, OU
 *   2. Définir EXPO_PUBLIC_API_URL dans un .env à la racine
 *      (auto-injecté par Expo SDK 49+)
 *
 * En prod, remplacer par l'URL publique HTTPS du backend.
 */

const DEFAULT_API_URL = 'http://192.168.1.11:3000';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;

// Timeouts
export const REQUEST_TIMEOUT_MS = 30000;

// Endpoints racines (utile si le back ajoute un prefix /api)
export const API_PREFIX = '';

// Construire une URL d'endpoint complète
export const buildUrl = (path: string): string => {
  const base = API_BASE_URL.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${API_PREFIX}${cleanPath}`;
};

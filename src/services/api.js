// src/services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config/env';
import { secureStorage, getOrCreateDeviceId } from './secureStorage';
import { getDeviceHeaders, getCachedGeo } from './deviceMeta';
import { sessionEvents } from './sessionEvents';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: REQUEST_TIMEOUT_MS,
});

// 🔐 Tokens dans secureStorage (Keychain/Keystore natif)
// 'user' (non-secret) reste dans AsyncStorage
api.interceptors.request.use(async (config) => {
  const [token, deviceId] = await Promise.all([
    secureStorage.getItem('accessToken'),
    getOrCreateDeviceId(),
  ]);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // 🛡️ Identifier de device envoyé sur toutes les requêtes (anti vol de refresh)
  config.headers['x-device-id'] = deviceId;
  // 📱 Métadonnées device pour identification précise côté serveur
  try {
    Object.assign(config.headers, getDeviceHeaders());
    const geo = getCachedGeo();
    if (geo) {
      config.headers['x-geo-lat'] = String(geo.lat);
      config.headers['x-geo-lng'] = String(geo.lng);
    }
  } catch {
    // headers device optionnels — ne bloque pas la requête
  }
  return config;
});

// Mutex pour ne pas refresh plusieurs fois en parallèle
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // 🐛 Log des 4xx/5xx pour debug rapide (URL + statut + payload)
    if (error.response && (error.response.status >= 400 || error.response.status === 0)) {
      console.warn(
        `[API ${error.response.status}] ${originalRequest?.method?.toUpperCase()} ${originalRequest?.baseURL ?? ''}${originalRequest?.url}`,
        error.response.data,
      );
    }
    // Ne tente PAS de refresh si l'URL qui a échoué est elle-même /auth/refresh
    // (sinon boucle infinie + wipe immédiat sur première erreur réseau).
    const isRefreshCall = originalRequest?.url?.includes('/auth/refresh');

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isRefreshCall
    ) {
      originalRequest._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = (async () => {
            const refreshToken = await secureStorage.getItem('refreshToken');
            if (!refreshToken) {
              throw new Error('Pas de refresh token en storage');
            }
            const deviceId = await getOrCreateDeviceId();
            const response = await axios.post(
              `${API_BASE_URL}/auth/refresh`,
              { refreshToken },
              { headers: { 'x-device-id': deviceId } },
            );
            if (response.data?.accessToken && response.data?.refreshToken) {
              await secureStorage.setItem('accessToken', response.data.accessToken);
              await secureStorage.setItem('refreshToken', response.data.refreshToken);
              return response.data.accessToken;
            }
            throw new Error(
              `Refresh: réponse invalide (clés manquantes) - keys=${Object.keys(response.data || {}).join(',')}`,
            );
          })();
        }
        const newAccessToken = await refreshPromise;
        refreshPromise = null;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        refreshPromise = null;
        // 🔴 LOG diagnostic : on veut savoir POURQUOI le refresh a échoué
        // (vu qu'un échec → wipe + redirect login, c'est critique de tracer)
        console.warn(
          '[AUTH refresh KO]',
          refreshErr?.response?.status,
          refreshErr?.response?.data || refreshErr?.message,
        );
        // 🧹 Logout complet : wipe tokens (SecureStore) + user (AsyncStorage)
        await secureStorage.multiRemove(['accessToken', 'refreshToken']);
        await AsyncStorage.removeItem('user');
        // 📣 Notifie AuthContext pour reset user + redirect login
        sessionEvents.emitExpired();
      }
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: (data) => api.post('/auth/login', data).then(res => res.data),
  register: (data) => api.post('/auth/register', data).then(res => res.data),
  logout: (data) => api.post('/auth/logout', { refreshToken: data }).then(res => res.data),
  logoutAll: () => api.post('/auth/logout-all').then(res => res.data),
  getSessions: () => api.get('/auth/sessions').then(res => res.data),
  revokeDevice: (deviceId) => api.post('/auth/sessions/revoke', { deviceId }).then(res => res.data),
  getCurrentUser: () => api.get('/auth/me').then(res => res.data),
  changePassword: (data) => api.post('/auth/change-password', data).then(res => res.data),
  /**
   * Step-up auth : envoie un OTP au téléphone du user pour autoriser la
   * création initiale de son mot de passe. Refuse si l'user en a déjà un.
   */
  sendPasswordSetupOtp: () =>
    api.post('/auth/send-password-setup-otp').then(res => res.data),

  checkAccount: (data) => api.post('/auth/check-account', data).then(res => res.data),

  sendOTP: (data) => api.post('/auth/send-otp', data).then(res => res.data),

  verifyOTP: (data) => api.post('/auth/verify-otp', data).then(res => res.data),
 initiateRegistration: (data) => api.post('/auth/register/initiate', data).then(res => res.data),
 verifyRegistration: (data) => api.post('/auth/register/verify', data).then(res => res.data),
};

export const kycService = {
  status: () => api.get('/kyc/status').then(res => res.data),
  submitLiveness: (payload) => api.post('/kyc/liveness', payload).then(res => res.data),
};

export const userPreferencesService = {
  get: () => api.get('/user/preferences').then(res => res.data),
  update: (data) => api.patch('/user/preferences', data).then(res => res.data),
};

export const accountService = {
  getBalance: () => api.get('/wallet/balance').then(res => res.data),
  getHistory: (params) => api.get('/wallet/history', { params }).then(res => res.data),
  // Dépôts via Stripe (paymentApi) ou validation admin (payment-requests).
  // Retraits via payment-requests. Les anciens /wallet/{deposit,withdraw} ont été retirés.
  getProfile: () => api.get('/user/profile').then(res => res.data),
  updateProfile: (data) => api.patch('/user/profile', data).then(res => res.data),
  /**
   * Score de sécurité du compte, calculé serveur.
   * Retourne `{ score: 0-100, level: 'weak'|'fair'|'good'|'excellent', components: [...] }`.
   */
  getSecurityScore: () => api.get('/user/security-score').then(res => res.data),
  /**
   * Export RGPD complet (profil, transactions, bénéficiaires, etc.) au format JSON.
   * Le client est responsable de sauvegarder/partager le résultat.
   */
  exportData: () => api.get('/user/export-data').then(res => res.data),
  /**
   * Upload de la photo de profil — multipart/form-data.
   * @param {{uri:string, name?:string, type?:string}} file
   */
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append('file', {
      uri: file.uri,
      name: file.name || 'avatar.jpg',
      type: file.type || 'image/jpeg',
    });
    return api
      .post('/user/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(res => res.data);
  },
  removeAvatar: () => api.delete('/user/avatar').then(res => res.data),
};

export const transactionService = {
  getTransactions: (params) => api.get('/transactions', { params }).then(res => res.data),
  transfer: (data, idempotencyKey) =>
    api
      .post('/transactions/transfer', data, {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
      })
      .then((res) => res.data),
  searchUserByEmail: (email) => api.get(`/user/search?email=${email}`).then(res => res.data),
  searchUserByPhone: (phone) => api.get(`/user/search?phone=${phone}`).then(res => res.data),
  // 🔎 Autocomplete users (email + phone avec normalisation préfixe pays)
  suggestUsers: (q) => api.get('/user/suggest', { params: { q } }).then(res => res.data),
};

export const notificationService = {
  getNotifications: (page = 1, limit = 20) =>
    api.get('/notifications', { params: { page, limit } }).then(res => res.data),
  getUnread: () => api.get('/notifications/unread').then(res => res.data),
  getUnreadCount: () => api.get('/notifications/unread/count').then(res => res.data),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`).then(res => res.data),
  markAllAsRead: () => api.patch('/notifications/read-all').then(res => res.data),
  archive: (id) => api.patch(`/notifications/${id}/archive`).then(res => res.data),
};

export const beneficiaryService = {
  list: () => api.get('/beneficiaries').then(res => res.data),
  create: (data) => api.post('/beneficiaries', data).then(res => res.data),
  update: (id, data) => api.patch(`/beneficiaries/${id}`, data).then(res => res.data),
  toggleFavorite: (id) => api.patch(`/beneficiaries/${id}/favorite`).then(res => res.data),
  remove: (id) => api.delete(`/beneficiaries/${id}`).then(res => res.data),
  /**
   * Upload de la photo de profil — multipart/form-data.
   * @param {string} id
   * @param {{uri:string, name?:string, type?:string}} file
   */
  uploadAvatar: (id, file) => {
    const form = new FormData();
    form.append('file', {
      uri: file.uri,
      name: file.name || 'avatar.jpg',
      type: file.type || 'image/jpeg',
    });
    return api
      .post(`/beneficiaries/${id}/avatar`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(res => res.data);
  },
  removeAvatar: (id) =>
    api.delete(`/beneficiaries/${id}/avatar`).then(res => res.data),
};

/**
 * Résout une URL d'asset relative (renvoyée par l'API, ex `/uploads/avatars/...`)
 * en URL absolue téléchargeable. Renvoie null/undefined inchangé.
 */
export const resolveAssetUrl = (relativeOrAbsolute) => {
  if (!relativeOrAbsolute) return relativeOrAbsolute;
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute;
  const base = API_BASE_URL.replace(/\/$/, '');
  const cleaned = relativeOrAbsolute.startsWith('/') ? relativeOrAbsolute : `/${relativeOrAbsolute}`;
  return `${base}${cleaned}`;
};

/**
 * QR de paiement marchand (Mode A : payout direct mobile / Mode B : crédit wallet).
 *
 * Endpoints backend correspondants :
 *  - POST  /qr/generate         (marchand auth)
 *  - GET   /qr/info/:reference  (public, pour preview avant paiement)
 *  - POST  /qr/pay/:reference   (payeur auth, idempotency-key header)
 */
/**
 * Location de voiture — marketplace multi-partenaires (phase 1 : lecture seule).
 * Pas d'auth requise pour search/detail. La réservation viendra en phase 2.
 */
export const vehicleRentalService = {
  // Public
  search: (params) => api.get('/vehicle-rentals', { params }).then(res => res.data),
  detail: (id) => api.get(`/vehicle-rentals/${id}`).then(res => res.data),
  cities: () => api.get('/vehicle-rentals/cities').then(res => res.data),

  // Booking — JWT requis (interceptor ajoute le token automatiquement)
  /**
   * @param {string} listingId
   * @param {{ startDate: string; endDate: string }} payload
   */
  book: (listingId, payload) =>
    api.post(`/vehicle-rentals/${listingId}/book`, payload).then(res => res.data),
  pay: (bookingId) =>
    api.post(`/vehicle-rentals/bookings/${bookingId}/pay`).then(res => res.data),
  myBookings: () =>
    api.get('/vehicle-rentals/bookings/me').then(res => res.data),
  cancelBooking: (bookingId, note) =>
    api.patch(`/vehicle-rentals/bookings/${bookingId}/cancel`, { note })
      .then(res => res.data),
};

export const qrService = {
  // Marchand : génère un QR.
  //  - montant (obligatoire)
  //  - description (optionnel)
  //  - payoutPhone (optionnel) → si renseigné, Mode A (payout direct)
  generate: ({ montant, description, payoutPhone }) =>
    api
      .post('/qr/generate', { montant, description, payoutPhone })
      .then(res => res.data),

  // Public : preview d'un QR scanné (récap avant confirmation).
  info: (reference) =>
    api.get(`/qr/info/${reference}`).then(res => res.data),

  // Payeur : exécute le paiement du QR (1 QR = 1 paiement).
  pay: (reference, idempotencyKey) =>
    api
      .post(`/qr/pay/${reference}`, null, {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
      })
      .then(res => res.data),
};

export default api;
// src/services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config/env';
import { secureStorage, getOrCreateDeviceId } from './secureStorage';

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
  return config;
});

// Mutex pour ne pas refresh plusieurs fois en parallèle
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = (async () => {
            const refreshToken = await secureStorage.getItem('refreshToken');
            const deviceId = await getOrCreateDeviceId();
            const response = await axios.post(
              `${API_BASE_URL}/auth/refresh`,
              { refreshToken },
              { headers: { 'x-device-id': deviceId } },
            );
            if (response.data.accessToken && response.data.refreshToken) {
              await secureStorage.setItem('accessToken', response.data.accessToken);
              await secureStorage.setItem('refreshToken', response.data.refreshToken);
              return response.data.accessToken;
            }
            throw new Error('Refresh failed');
          })();
        }
        const newAccessToken = await refreshPromise;
        refreshPromise = null;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch {
        refreshPromise = null;
        // 🧹 Logout complet : wipe tokens (SecureStore) + user (AsyncStorage)
        await secureStorage.multiRemove(['accessToken', 'refreshToken']);
        await AsyncStorage.removeItem('user');
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
  getCurrentUser: () => api.get('/auth/me').then(res => res.data),
  changePassword: (data) => api.post('/auth/change-password', data).then(res => res.data),

  checkAccount: (data) => api.post('/auth/check-account', data).then(res => res.data),

  sendOTP: (data) => api.post('/auth/send-otp', data).then(res => res.data),

  verifyOTP: (data) => api.post('/auth/verify-otp', data).then(res => res.data),
 initiateRegistration: (data) => api.post('/auth/register/initiate', data).then(res => res.data),
 verifyRegistration: (data) => api.post('/auth/register/verify', data).then(res => res.data),
};

export const userPreferencesService = {
  get: () => api.get('/user/preferences').then(res => res.data),
  update: (data) => api.patch('/user/preferences', data).then(res => res.data),
};

export const accountService = {
  getBalance: () => api.get('/wallet/balance').then(res => res.data),
  getHistory: (params) => api.get('/wallet/history', { params }).then(res => res.data),
  deposit: (data) => api.post('/wallet/deposit', data).then(res => res.data),
  withdraw: (data) => api.post('/wallet/withdraw', data).then(res => res.data),
  updateProfile: (data) => api.patch('/user/profile', data).then(res => res.data),
};

export const transactionService = {
  getTransactions: (params) => api.get('/transactions', { params }).then(res => res.data),
  transfer: (data) => api.post('/transactions/transfer', data).then(res => res.data),
  searchUserByEmail: (email) => api.get(`/user/search?email=${email}`).then(res => res.data),
  searchUserByPhone: (phone) => api.get(`/user/search?phone=${phone}`).then(res => res.data),
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
};

export default api;
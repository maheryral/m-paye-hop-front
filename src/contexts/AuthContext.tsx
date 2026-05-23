// src/contexts/AuthContext.tsx
// 🔐 Tokens dans SecureStore (Keychain iOS / Keystore Android).
// 'user' (objet non-sensible) reste dans AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { accountService, authService } from '../services/api';
import { secureStorage } from '../services/secureStorage';

interface User {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  kycLevel: string;
  isActive: boolean;
}

interface RegisterData {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  password: string;
  confirmPassword: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  loginWithTokens: (accessToken: string, refreshToken: string, userData: User) => Promise<void>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  setUser: (user: User | null) => void;
  setUserFromTokens: (accessToken: string, refreshToken: string, userData: User) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper centralisé pour stocker session
async function persistSession(accessToken: string, refreshToken: string, userData: User) {
  await Promise.all([
    secureStorage.setItem('accessToken', accessToken),
    secureStorage.setItem('refreshToken', refreshToken),
    AsyncStorage.setItem('user', JSON.stringify(userData)),
  ]);
}

async function clearSession() {
  await Promise.all([
    secureStorage.multiRemove(['accessToken', 'refreshToken']),
    AsyncStorage.removeItem('user'),
  ]);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await secureStorage.getItem('accessToken');
      const storedUser = await AsyncStorage.getItem('user');
      if (token && storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Erreur chargement user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loginWithTokens = async (accessToken: string, refreshToken: string, userData: User) => {
    await persistSession(accessToken, refreshToken, userData);
    setUser(userData);
  };

  const login = async (identifier: string, password: string) => {
    const response = await authService.login({ login: identifier, password });
    if (response?.accessToken && response?.user) {
      await persistSession(response.accessToken, response.refreshToken, response.user);
      setUser(response.user);
    } else {
      throw new Error('Réponse de connexion invalide');
    }
  };

  const setUserFromTokens = async (accessToken: string, refreshToken: string, userData: User) => {
    await persistSession(accessToken, refreshToken, userData);
    setUser(userData);
  };

  const register = async (data: RegisterData) => {
    const response = await authService.register(data);
    if (response?.accessToken && response?.user) {
      await persistSession(response.accessToken, response.refreshToken, response.user);
      setUser(response.user);
      return response;
    }
    throw new Error("Réponse d'inscription invalide");
  };

  const logout = async () => {
    try {
      const token = await secureStorage.getItem('refreshToken');
      if (token) {
        await authService.logout(token);
      }
    } catch (error) {
      console.error('Erreur logout:', error);
    } finally {
      await clearSession();
      setUser(null);
    }
  };

  /**
   * Déconnecte TOUS les appareils de l'utilisateur (révoque toutes les sessions côté serveur).
   * Utile en cas de vol/perte d'appareil.
   */
  const logoutAllDevices = async () => {
    try {
      await authService.logoutAll();
    } catch (error) {
      console.error('Erreur logoutAll:', error);
    } finally {
      await clearSession();
      setUser(null);
    }
  };

  const updateUser = async (data: Partial<User>) => {
    if (!user) return;
    try {
      const response = await accountService.updateProfile(data);
      const updated = { ...user, ...data };
      setUser(updated);
      await AsyncStorage.setItem('user', JSON.stringify(updated));
      return response;
    } catch (error) {
      console.error('Erreur mise à jour profil:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithTokens,
        register,
        logout,
        logoutAllDevices,
        updateUser,
        setUserFromTokens,
        setUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

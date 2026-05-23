// src/contexts/AuthContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { accountService, authService } from '../services/api';

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
  updateUser: (data: Partial<User>) => Promise<void>;
  setUser: (user: User | null) => void;
  setUserFromTokens: (accessToken: string, refreshToken: string, userData: User) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
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
  try {
    await AsyncStorage.setItem('accessToken', accessToken);
    await AsyncStorage.setItem('refreshToken', refreshToken);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  } catch (error) {
    console.error('Erreur connexion par tokens:', error);
    throw error;
  }
};
  const login = async (identifier: string, password: string) => {
    try {
      const response = await authService.login({ login: identifier, password });
      
      if (response && response.accessToken) {
        await AsyncStorage.setItem('accessToken', response.accessToken);
        await AsyncStorage.setItem('refreshToken', response.refreshToken);
        
        if (response.user) {
          await AsyncStorage.setItem('user', JSON.stringify(response.user));
          setUser(response.user);
        }
      } else {
        throw new Error('Réponse de connexion invalide');
      }
    } catch (error) {
      throw error;
    }
  };

  // Nouvelle méthode pour la connexion par OTP (inscription rapide)
  const setUserFromTokens = async (accessToken: string, refreshToken: string, userData: User) => {
    try {
      await AsyncStorage.setItem('accessToken', accessToken);
      await AsyncStorage.setItem('refreshToken', refreshToken);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Erreur lors du stockage des tokens:', error);
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await authService.register(data);
      
      if (response && response.accessToken) {
        await AsyncStorage.setItem('accessToken', response.accessToken);
        await AsyncStorage.setItem('refreshToken', response.refreshToken);
        
        if (response.user) {
          await AsyncStorage.setItem('user', JSON.stringify(response.user));
          setUser(response.user);
        }
        
        return response;
      } else {
        throw new Error('Réponse d\'inscription invalide');
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      const token = await AsyncStorage.getItem('refreshToken');
      if (token) {
        await authService.logout(token);
      }
    } catch (error) {
      console.error('Erreur logout:', error);
    } finally {
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');
      await AsyncStorage.removeItem('user');
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
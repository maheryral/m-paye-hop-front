// src/contexts/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

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

// Couleurs pour le mode clair
const lightColors: ThemeColors = {
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

// Couleurs pour le mode sombre
const darkColors: ThemeColors = {
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

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [isLoading, setIsLoading] = useState(true);

  // Charger le thème sauvegardé au démarrage
  useEffect(() => {
    loadThemeMode();
  }, []);

  const loadThemeMode = async () => {
    try {
      const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedMode && ['light', 'dark', 'system'].includes(savedMode)) {
        setModeState(savedMode as ThemeMode);
      } else {
        // Par défaut, utiliser le thème système
        setModeState('dark');
      }
    } catch (error) {
      console.error('Erreur lors du chargement du thème:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveThemeMode = async (newMode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du thème:', error);
    }
  };

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    saveThemeMode(newMode);
  };

  const toggleTheme = () => {
    if (mode === 'light') {
      setMode('dark');
    } else if (mode === 'dark') {
      setMode('light');
    } else {
      // Si en mode système, basculer vers le thème opposé
      const currentEffective = getEffectiveMode();
      setMode(currentEffective === 'dark' ? 'light' : 'dark');
    }
  };

  const getEffectiveMode = (): 'light' | 'dark' => {
    if (mode === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return mode;
  };

  const isDark = getEffectiveMode() === 'dark';
  const colors = isDark ? darkColors : lightColors;

  // Valeur du contexte
  const contextValue: ThemeContextType = {
    mode,
    colors,
    isDark,
    setMode,
    toggleTheme,
  };

  if (isLoading) {
    // Optionnel: retourner un écran de chargement
    return null;
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook personnalisé pour utiliser le thème
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme doit être utilisé à l\'intérieur d\'un ThemeProvider');
  }
  return context;
};

// Hook pour obtenir les couleurs directement
export const useColors = (): ThemeColors => {
  const { colors } = useTheme();
  return colors;
};

// Hook pour savoir si le mode sombre est actif
export const useIsDark = (): boolean => {
  const { isDark } = useTheme();
  return isDark;
};

// Hook pour basculer le thème
export const useToggleTheme = (): (() => void) => {
  const { toggleTheme } = useTheme();
  return toggleTheme;
};

export default ThemeContext;
// src/contexts/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_DARK_COLORS,
  DEFAULT_LIGHT_COLORS,
  resolveBootTheme,
  fetchTheme,
  type AppTheme,
} from '../services/appThemeService';

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

// Les couleurs par défaut sont dans appThemeService — single source of truth
// partagée avec le boot resolver. Le ThemeProvider fetch ensuite la version
// distante depuis /app-theme et override si disponible.

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  /** Force un re-fetch de la palette depuis l'API (ex: bouton Paramètres). */
  refreshTheme: () => Promise<boolean>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [isLoading, setIsLoading] = useState(true);

  // Palette dynamique : par défaut bundle defaults, puis remplacée par les
  // valeurs en cache (instant) puis par la version distante quand fetch OK.
  const [lightColors, setLightColors] = useState<ThemeColors>(DEFAULT_LIGHT_COLORS);
  const [darkColors, setDarkColors] = useState<ThemeColors>(DEFAULT_DARK_COLORS);

  // Charger le thème sauvegardé au démarrage
  useEffect(() => {
    loadThemeMode();
    loadColors();
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

  /**
   * Charge les couleurs : 1) cache local (instant, évite flash defaults),
   * 2) puis fetch API en arrière-plan (remplace si plus récent).
   */
  const loadColors = async () => {
    try {
      const { initial, fresh } = await resolveBootTheme();
      applyTheme(initial);
      // Fetch arrière-plan — applique si fresh OK
      fresh
        .then((t) => {
          if (t) applyTheme(t);
        })
        .catch(() => {
          // ignore — on garde le cache ou les defaults
        });
    } catch {
      // Cas extrême : fallback hard-coded — déjà en place via useState initial
    }
  };

  const applyTheme = (t: AppTheme) => {
    setLightColors(t.colorsLight);
    setDarkColors(t.colorsDark);
  };

  /** Force un re-fetch (ex: bouton "Recharger thème" dans Paramètres). */
  const refreshTheme = async (): Promise<boolean> => {
    const t = await fetchTheme();
    if (t) {
      applyTheme(t);
      return true;
    }
    return false;
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
    refreshTheme,
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
// src/contexts/LocaleContext.tsx
// Gère langue + devise + thème (synchronisés avec /user/preferences API).
// Expose t() pour traductions et formatCurrency() pour formatage devise.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language, TranslationKey } from '../i18n/translations';
import { userPreferencesService } from '../services/api';
import { useAuth } from './AuthContext';
import { useTheme, ThemeMode } from './ThemeContext';

export type Currency = 'Ar' | 'EUR' | 'USD';

// Taux de change indicatifs Ar (peuvent être mis à jour via une API forex plus tard)
const RATES: Record<Currency, number> = {
  Ar: 1,
  EUR: 5000, // 1 EUR ≈ 5 000 Ar
  USD: 4500, // 1 USD ≈ 4 500 Ar
};

const SYMBOLS: Record<Currency, string> = {
  Ar: 'Ar',
  EUR: '€',
  USD: '$',
};

interface LocaleContextType {
  language: Language;
  currency: Currency;
  isReady: boolean;
  setLanguage: (lang: Language) => Promise<void>;
  setCurrency: (cur: Currency) => Promise<void>;
  /** Traduire une clé. Fallback en FR si la clé n'existe pas dans la langue active. */
  t: (key: TranslationKey | string) => string;
  /**
   * Formatte un montant exprimé en Ariary dans la devise choisie.
   * Ex : formatCurrency(50000) → "50 000 Ar" (fr-FR / Ar) ou "10.00 €" (en EUR)
   */
  formatCurrency: (amountAr: number) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

const LANG_FALLBACK_KEY = '@locale_lang';
const CUR_FALLBACK_KEY = '@locale_currency';

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const { setMode } = useTheme();
  const [language, setLanguageState] = useState<Language>('fr');
  const [currency, setCurrencyState] = useState<Currency>('Ar');
  const [isReady, setIsReady] = useState(false);

  // Charge depuis AsyncStorage (instantané), puis sync via API
  useEffect(() => {
    (async () => {
      try {
        const [savedLang, savedCur] = await Promise.all([
          AsyncStorage.getItem(LANG_FALLBACK_KEY),
          AsyncStorage.getItem(CUR_FALLBACK_KEY),
        ]);
        if (savedLang && savedLang in translations) {
          setLanguageState(savedLang as Language);
        }
        if (savedCur && savedCur in RATES) {
          setCurrencyState(savedCur as Currency);
        }
      } catch {}
      setIsReady(true);
    })();
  }, []);

  // Sync avec backend si user connecté
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const prefs = await userPreferencesService.get();
        if (prefs?.language && prefs.language in translations) {
          setLanguageState(prefs.language as Language);
          AsyncStorage.setItem(LANG_FALLBACK_KEY, prefs.language);
        }
        if (prefs?.currency && prefs.currency in RATES) {
          setCurrencyState(prefs.currency as Currency);
          AsyncStorage.setItem(CUR_FALLBACK_KEY, prefs.currency);
        }
        // Sync thème aussi
        if (prefs?.theme && ['light', 'dark', 'system'].includes(prefs.theme)) {
          setMode(prefs.theme as ThemeMode);
        }
      } catch {
        // Si pas joignable, on garde les valeurs locales
      }
    })();
  }, [user, setMode]);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    await AsyncStorage.setItem(LANG_FALLBACK_KEY, lang);
    try {
      await userPreferencesService.update({ language: lang });
    } catch {
      // offline → on garde quand même la valeur locale
    }
  }, []);

  const setCurrency = useCallback(async (cur: Currency) => {
    setCurrencyState(cur);
    await AsyncStorage.setItem(CUR_FALLBACK_KEY, cur);
    try {
      await userPreferencesService.update({ currency: cur });
    } catch {}
  }, []);

  const t = useCallback(
    (key: TranslationKey | string): string => {
      const dict = translations[language] as Record<string, string>;
      return (
        dict[key] ||
        (translations.fr as Record<string, string>)[key] ||
        key // si la clé n'existe pas, renvoie la clé elle-même
      );
    },
    [language],
  );

  const formatCurrency = useCallback(
    (amountAr: number): string => {
      if (currency === 'Ar') {
        return new Intl.NumberFormat('fr-FR').format(Math.round(amountAr)) + ' Ar';
      }
      const converted = amountAr / RATES[currency];
      const locale =
        language === 'en' ? 'en-US' : language === 'mg' ? 'fr-FR' : 'fr-FR';
      const formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(converted);
      return `${formatted} ${SYMBOLS[currency]}`;
    },
    [currency, language],
  );

  return (
    <LocaleContext.Provider
      value={{ language, currency, isReady, setLanguage, setCurrency, t, formatCurrency }}
    >
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = (): LocaleContextType => {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale doit être utilisé dans LocaleProvider');
  }
  return ctx;
};

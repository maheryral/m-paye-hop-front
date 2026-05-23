// src/contexts/BiometricGuardContext.tsx
// Gestion centralisée:
//   1) Verrouillage de l'app au lancement si biométrie activée
//   2) requireBiometric(reason) pour les actions sensibles
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useBiometric } from '../hooks/useBiometric';
import { useAuth } from './AuthContext';
import { userPreferencesService } from '../services/api';
import BiometricLock from '../components/BiometricLock';

interface BiometricGuardContextType {
  biometricEnabled: boolean;
  isLocked: boolean;
  /**
   * Lance un prompt biométrique si l'utilisateur a activé la fonctionnalité.
   * Si la pref est désactivée, retourne true directement (pas de prompt).
   */
  requireBiometric: (reason: string) => Promise<boolean>;
  /** Force le verrouillage de l'app (utile après inactivité par exemple). */
  lock: () => void;
  /** Recharge la pref depuis le backend. */
  refreshPref: () => Promise<void>;
}

const Ctx = createContext<BiometricGuardContextType | undefined>(undefined);

export const BiometricGuardProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, logout } = useAuth();
  const { authenticate, support } = useBiometric();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [prefLoaded, setPrefLoaded] = useState(false);

  const refreshPref = useCallback(async () => {
    if (!user) {
      setBiometricEnabled(false);
      setPrefLoaded(true);
      setIsLocked(false);
      return;
    }
    try {
      const prefs = await userPreferencesService.get();
      const enabled = !!prefs?.biometric && support.available;
      setBiometricEnabled(enabled);
      setIsLocked(enabled); // si activé, on verrouille au démarrage
    } catch {
      setBiometricEnabled(false);
      setIsLocked(false);
    } finally {
      setPrefLoaded(true);
    }
  }, [user, support.available]);

  useEffect(() => {
    refreshPref();
  }, [refreshPref]);

  const requireBiometric = useCallback(
    async (reason: string): Promise<boolean> => {
      if (!biometricEnabled) return true; // pas activé → on laisse passer
      if (!support.available) return true; // sécurité : si plus dispo on bloque pas
      return authenticate(reason);
    },
    [biometricEnabled, support.available, authenticate],
  );

  const lock = useCallback(() => {
    if (biometricEnabled) setIsLocked(true);
  }, [biometricEnabled]);

  // Tant que la pref n'est pas chargée et qu'on a un user, on attend
  if (user && !prefLoaded) {
    return null;
  }

  const showLock = !!user && biometricEnabled && isLocked;

  return (
    <Ctx.Provider
      value={{ biometricEnabled, isLocked, requireBiometric, lock, refreshPref }}
    >
      {showLock ? (
        <BiometricLock
          onUnlock={() => setIsLocked(false)}
          onLogout={async () => {
            await logout();
            setIsLocked(false);
          }}
        />
      ) : (
        children
      )}
    </Ctx.Provider>
  );
};

export const useBiometricGuard = (): BiometricGuardContextType => {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useBiometricGuard doit être utilisé dans BiometricGuardProvider');
  }
  return ctx;
};

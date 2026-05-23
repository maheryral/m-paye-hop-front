// src/hooks/useBiometric.ts
// Hook centralisé pour la biométrie (Face ID / Touch ID / empreinte Android).
import { useCallback, useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricSupport {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  available: boolean; // hasHardware && isEnrolled
}

export function useBiometric() {
  const [support, setSupport] = useState<BiometricSupport>({
    hasHardware: false,
    isEnrolled: false,
    supportedTypes: [],
    available: false,
  });
  const [checking, setChecking] = useState(true);

  const refreshSupport = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = hasHardware
        ? await LocalAuthentication.isEnrolledAsync()
        : false;
      const supportedTypes = hasHardware
        ? await LocalAuthentication.supportedAuthenticationTypesAsync()
        : [];
      setSupport({
        hasHardware,
        isEnrolled,
        supportedTypes,
        available: hasHardware && isEnrolled,
      });
    } catch {
      setSupport({
        hasHardware: false,
        isEnrolled: false,
        supportedTypes: [],
        available: false,
      });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    refreshSupport();
  }, [refreshSupport]);

  /**
   * Lance le prompt biométrique.
   * @param reason texte affiché à l'utilisateur (ex: "Confirmez le transfert")
   * @returns true si authentifié, false sinon (cancel ou échec)
   */
  const authenticate = useCallback(
    async (reason: string): Promise<boolean> => {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: reason,
          cancelLabel: 'Annuler',
          fallbackLabel: 'Utiliser le code',
          disableDeviceFallback: false,
        });
        return result.success;
      } catch {
        return false;
      }
    },
    [],
  );

  const label = (() => {
    const types = support.supportedTypes;
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Empreinte';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'Iris';
    }
    return 'Biométrie';
  })();

  return { support, checking, authenticate, refreshSupport, label };
}

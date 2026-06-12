// src/services/providersApi.tsx
import api from './api';

export interface PublicProvider {
  code: string;
  type: 'CARD' | 'MOBILE_MONEY';
  name: string;
  isSandbox: boolean;
  config: Record<string, any>;
}

export interface MobileMoneyInitResult {
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  reference: string;
  paymentRequestId?: string;
  message?: string;
}

export const providersApi = {
  /** Fournisseurs actifs + config non-sensible (clé publishable, opérateurs...). */
  getPublic: () => api.get<PublicProvider[]>('/providers/public'),
  /**
   * Démarre un dépôt Mobile Money via le fournisseur configuré.
   * Timeout étendu à 45s : le backend attend le verdict MVola (polling
   * jusqu'à 30s) avant de répondre. Sans ce timeout, axios couperait avant.
   */
  mobileMoneyDeposit: (
    code: string,
    amount: number,
    phone: string,
    /** Si fourni → PAIEMENT DIRECT : crédite ce destinataire, pas le wallet du payeur. */
    toPhone?: string,
  ) =>
    api.post<MobileMoneyInitResult>(
      '/providers/mobile-money/deposit',
      { code, amount, phone, ...(toPhone ? { toPhone } : {}) },
      { timeout: 45000 },
    ),
};

export default providersApi;

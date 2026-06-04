// src/services/billersApi.ts
// Catalogue de services + billers (mini-programs) pour la page Services mobile.
import api from './api';

export interface PublicServiceType {
  id: string;
  code: string;
  label: string;
  iconName: string | null;
  color: string | null;
  sortOrder: number;
}

export type BillerIntegrationType = 'WEB' | 'NATIVE';

export interface PublicBiller {
  id: string;
  name: string;
  iconName: string | null;
  logoUrl: string | null;
  color: string | null;
  redirectPath: string;
  integrationType: BillerIntegrationType;
  isEssential: boolean;
  description: string | null;
  sortOrder: number;
  serviceType: PublicServiceType;
}

export interface LaunchTokenResponse {
  url: string;
  token: string;
  expiresAt: string;
}

export const billersApi = {
  /** Liste des billers actifs (page Services). */
  list: () => api.get<PublicBiller[]>('/billers'),

  /** Génère URL + token court (10 min) pour ouvrir le mini-program en WebView. */
  launchToken: (billerId: string) =>
    api.post<LaunchTokenResponse>('/billers/launch-token', { billerId }),
};

// src/services/oauthApi.ts
// Endpoints OAuth Partners — mobile.
// Utilisés par la page /oauth/consent qui s'ouvre via deep-link.
import api from './api';

export type OAuthScope =
  | 'auth_user'
  | 'auth_phone'
  | 'auth_email'
  | 'trade'
  | 'trade_refund'
  | 'wallet_balance';

export interface PartnerPublicInfo {
  appId: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  allowedScopes: OAuthScope[];
  redirectUris: string[];
  isActive: boolean;
}

export interface AuthorizeResult {
  code: string;
  expires_at: string;
  state?: string;
}

export const oauthApi = {
  /** Infos publiques d'un partenaire (logo, nom, scopes autorisés). */
  partnerInfo: (appId: string) =>
    api
      .get<PartnerPublicInfo>(`/oauth/partner-info/${encodeURIComponent(appId)}`)
      .then((r) => r.data),

  /** Génère un auth_code (l'user a consenti). JWT requis. */
  authorize: (data: {
    app_id: string;
    scopes: OAuthScope[];
    redirect_uri: string;
    state?: string;
  }) =>
    api
      .post<AuthorizeResult>('/oauth/authorize', data)
      .then((r) => r.data),
};

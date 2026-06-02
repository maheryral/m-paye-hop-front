// src/services/cardsApi.tsx
import api from './api';

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expiration: string;
  isDefault: boolean;
  stripePaymentMethodId?: string | null;
}

export interface SetupIntentResponse {
  clientSecret: string;
  publishableKey: string;
  customerId: string;
}

export const cardsApi = {
  createSetupIntent: () =>
    api.post<SetupIntentResponse>('/cards/setup-intent'),
  saveCard: (paymentMethodId: string) =>
    api.post<SavedCard>('/cards', { paymentMethodId }),
  list: () => api.get<SavedCard[]>('/cards'),
  setDefault: (id: string) => api.patch(`/cards/${id}/default`),
  remove: (id: string) => api.delete(`/cards/${id}`),
};

export default cardsApi;

// src/services/paymentApi.ts
import api from './api';

export type PaymentRequestType = 'DEPOSIT' | 'WITHDRAWAL';
export type PaymentRequestMethod = 'CARD' | 'MOBILE_MONEY' | 'BANK' | 'CASH';
export type PaymentRequestStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface PaymentRequest {
  id: string;
  userId: string;
  type: PaymentRequestType;
  method: PaymentRequestMethod;
  status: PaymentRequestStatus;
  amount: number | string;
  devise: string;
  details?: Record<string, any> | null;
  reference: string;
  rejectionReason?: string | null;
  adminNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  processedAt?: string | null;
  user?: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
    telephone?: string;
  };
}

export interface StripeIntentResponse {
  paymentRequestId: string;
  clientSecret: string | null;
  publishableKey?: string;
  reference: string;
}

export const paymentApi = {
  // User
  create: (data: {
    type: PaymentRequestType;
    method: PaymentRequestMethod;
    amount: number;
    details?: Record<string, any>;
  }) => api.post<PaymentRequest>('/payment-requests', data),

  listMine: () => api.get<PaymentRequest[]>('/payment-requests/me'),

  getOne: (id: string) => api.get<PaymentRequest>(`/payment-requests/${id}`),

  cancel: (id: string) =>
    api.patch<PaymentRequest>(`/payment-requests/${id}/cancel`),

  // Admin
  listPending: () => api.get<PaymentRequest[]>('/payment-requests/admin/pending'),

  listAll: () => api.get<PaymentRequest[]>('/payment-requests/admin/all'),

  approve: (id: string, adminNotes?: string) =>
    api.patch<PaymentRequest>(`/payment-requests/admin/${id}/approve`, {
      adminNotes,
    }),

  reject: (id: string, rejectionReason: string) =>
    api.patch<PaymentRequest>(`/payment-requests/admin/${id}/reject`, {
      rejectionReason,
    }),

  // Stripe (carte)
  createStripeIntent: (amount: number) =>
    api.post<StripeIntentResponse>('/payments/stripe/intent', { amount }),

  confirmStripeDeposit: (paymentRequestId: string) =>
    api.post<PaymentRequest>(`/payments/stripe/${paymentRequestId}/confirm`),
};

export default paymentApi;

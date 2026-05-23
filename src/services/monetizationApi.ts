// src/services/monetizationApi.ts
import api from './api';

export type PlanId = 'BASIC' | 'PREMIUM' | 'BUSINESS';
export type FeeContext =
  | 'TRANSFER'
  | 'WITHDRAWAL'
  | 'MERCHANT_PAYMENT'
  | 'TAXI_BROUSSE'
  | 'TELEPHERIQUE';

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  priceLabel: string;
  color: string;
  features: string[];
  recommended: boolean;
}

export interface Subscription {
  id: string | null;
  userId: string;
  plan: PlanId;
  status: string;
  pricePerMonth: number | string;
  currency: string;
  startDate?: string | null;
  endDate?: string | null;
  autoRenew?: boolean;
  isDefault?: boolean;
}

export interface FeeCalculation {
  baseAmount: number;
  feeAmount: number;
  totalAmount: number;
  feePercent: number;
  appliedRule: string;
  plan: PlanId;
}

export interface RevenueStats {
  totalAllTime: number;
  totalAllTimeCount: number;
  totalThisMonth: number;
  totalThisMonthCount: number;
  totalThisYear: number;
  byType: { type: string; total: number; count: number }[];
  byMonth: { month: string; total: number }[];
  subscriptions: { plan: string; status: string; count: number }[];
}

export const monetizationApi = {
  // Subscriptions
  listPlans: () => api.get<Plan[]>('/subscriptions/plans'),
  myPlan: () => api.get<Subscription>('/subscriptions/me'),
  subscribe: (plan: PlanId) => api.post<Subscription>(`/subscriptions/subscribe/${plan}`),
  cancelPlan: () => api.post<Subscription>('/subscriptions/cancel'),

  // Fee calculation (preview)
  calculateFee: (context: FeeContext, amount: number) =>
    api.post<FeeCalculation>('/revenue/calculate-fee', { context, amount }),

  // Admin revenue
  adminStats: () => api.get<RevenueStats>('/revenue/admin/stats'),
  adminList: (page = 1, limit = 50) =>
    api.get('/revenue/admin/list', { params: { page, limit } }),
};

export default monetizationApi;

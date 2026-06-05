// src/services/tradeApi.ts
// Endpoints Trade (paiements & pré-autorisations OAuth) — mobile.
import api from './api';

export interface TradePartnerInfo {
  name: string;
  logoUrl: string | null;
  appId: string;
}

export type TradeStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'EXPIRED'
  | 'CANCELLED'
  // Phase 7
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'PARTIALLY_CAPTURED'
  | 'RELEASED';

export type TradeType = 'PAYMENT' | 'AUTHORIZATION';

export interface TradeDto {
  trade_no: string;
  out_trade_no: string;
  amount: number;
  currency: string;
  subject: string;
  body: string | null;
  trade_type: TradeType;
  status: TradeStatus;
  authorized_amount: number | null;
  captured_amount: number | null;
  authorized_at: string | null;
  captured_at: string | null;
  released_at: string | null;
  expires_at: string;
  paid_at: string | null;
  refunded_at: string | null;
  refunded_amount: number | null;
  failure_reason: string | null;
  created_at: string;
  partner: TradePartnerInfo;
}

export interface TradePayResult extends Omit<TradeDto, 'partner'> {
  transactionRef?: string;
}

export const tradeApi = {
  getOne: (tradeNo: string) =>
    api
      .get<TradeDto>(`/trade/${encodeURIComponent(tradeNo)}`)
      .then((r) => r.data),

  pay: (tradeNo: string) =>
    api
      .post<TradePayResult>(`/trade/${encodeURIComponent(tradeNo)}/pay`, {})
      .then((r) => r.data),

  /** Phase 7 — confirme une pré-autorisation (hold du wallet). */
  authorize: (tradeNo: string) =>
    api
      .post<TradePayResult>(
        `/trade/${encodeURIComponent(tradeNo)}/authorize`,
        {},
      )
      .then((r) => r.data),
};

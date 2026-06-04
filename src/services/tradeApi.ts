// src/services/tradeApi.ts
// Endpoints Trade (paiements initiés par les partenaires OAuth) — mobile.
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
  | 'CANCELLED';

export interface TradeDto {
  trade_no: string;
  out_trade_no: string;
  amount: number;
  currency: string;
  subject: string;
  body: string | null;
  status: TradeStatus;
  expires_at: string;
  paid_at: string | null;
  refunded_at: string | null;
  refunded_amount: number | null;
  failure_reason: string | null;
  created_at: string;
  partner: TradePartnerInfo;
}

export interface TradePayResult extends Omit<TradeDto, 'partner'> {
  transactionRef: string;
}

export const tradeApi = {
  /** Récupère un trade pour affichage (JWT user). */
  getOne: (tradeNo: string) =>
    api
      .get<TradeDto>(`/trade/${encodeURIComponent(tradeNo)}`)
      .then((r) => r.data),

  /** L'user confirme : débit wallet + Transaction + webhook partenaire. */
  pay: (tradeNo: string) =>
    api
      .post<TradePayResult>(`/trade/${encodeURIComponent(tradeNo)}/pay`, {})
      .then((r) => r.data),
};

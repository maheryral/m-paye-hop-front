// src/utils/merchantCaps.ts
// Matrice de capacités par rôle marchand — miroir de la matrice backend
// (merchant-context.service.ts ROLE_CAPABILITIES). Sert au filtrage du menu.
import type { MerchantRole } from '../services/merchantApi';

export type MerchantCapability =
  | 'dashboard'
  | 'transactions'
  | 'collect'
  | 'refunds'
  | 'withdrawals'
  | 'products'
  | 'stores'
  | 'coupons'
  | 'employees';

const ROLE_CAPS: Record<MerchantRole, MerchantCapability[] | 'ALL'> = {
  OWNER: 'ALL',
  MANAGER: 'ALL',
  ACCOUNTANT: ['dashboard', 'transactions', 'refunds'],
  CASHIER: ['collect', 'transactions'],
};

/**
 * Vérifie si un rôle marchand possède une capacité.
 * Si le rôle est inconnu (non encore chargé), on laisse passer (fail-open,
 * cohérent avec le défaut OWNER côté web).
 */
export function roleHasCapability(
  role: string | null | undefined,
  cap: MerchantCapability,
): boolean {
  if (!role) return true;
  const caps = ROLE_CAPS[role as MerchantRole];
  if (!caps) return true;
  if (caps === 'ALL') return true;
  return caps.includes(cap);
}

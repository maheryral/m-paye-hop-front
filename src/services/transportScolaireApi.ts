// src/services/transportScolaireApi.ts
// Endpoints transport scolaire (parent côté mobile).
import api from './api';

// ─── Types ─────────────────────────────────────────

export interface SchoolPublic {
  id: string;
  nom: string;
  adresse: string | null;
  ville: string;
  logoUrl: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface RoutePricingPlan {
  id: string;
  code: string;
  label: string;
  description: string | null;
  category: 'MONTHLY' | 'QUARTERLY' | 'PER_TRIP' | 'OTHER';
  dureeJours: number;
  prix: number | string;
  minStudents: number;
  maxStudents: number;
  isActive: boolean;
  sortOrder: number;
}

export interface TransportStop {
  id: string;
  routeId: string;
  nom: string;
  ordre: number;
  heurePassage: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface TransportRoutePublic {
  id: string;
  nom: string;
  description: string | null;
  schoolId: string;
  capaciteMax: number;
  heureDepartMatin: string | null;
  heureRetourSoir: string | null;
  joursDesservis: string[];
  isActive: boolean;
  stops: TransportStop[];
  pricingPlans: RoutePricingPlan[];
  _count?: { subscriptions: number };
  // Sur GET /routes/:id
  capaciteRestante?: number;
  school?: {
    id: string;
    nom: string;
    ville: string;
    logoUrl: string | null;
  };
}

export interface Student {
  id: string;
  parentId: string;
  nom: string;
  prenom: string;
  classe: string | null;
  niveau: string | null;
  dateNaissance: string | null;
  photoUrl: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface UpsertStudentDto {
  nom?: string;
  prenom?: string;
  classe?: string | null;
  niveau?: string | null;
  dateNaissance?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
}

export type SubscriptionStatus =
  | 'PENDING_PAYMENT'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'CANCELLED';

export interface TransportSubscription {
  id: string;
  parentId: string;
  routeId: string;
  pricingPlanId: string;
  pickupStopId: string | null;
  prixApplique: number | string;
  dateDebut: string;
  dateFin: string;
  status: SubscriptionStatus;
  codeAbonnement: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  refundedAmount: number | string | null;
  route?: {
    id: string;
    nom: string;
    heureDepartMatin: string | null;
    heureRetourSoir: string | null;
    school: { id: string; nom: string; ville: string };
  };
  pricingPlan?: {
    id: string;
    code: string;
    label: string;
    category: string;
    dureeJours: number;
  };
  pickupStop?: { id: string; nom: string; ordre: number; heurePassage: string | null } | null;
  studentLinks?: Array<{
    subscriptionId: string;
    studentId: string;
    addedAt: string;
    student: { id: string; nom: string; prenom: string; classe: string | null; photoUrl: string | null };
  }>;
  payments?: Array<{
    id: string;
    montant: number | string;
    devise: string;
    modePaiement: string;
    statut: string;
    datePaiement: string;
  }>;
}

export interface CreateSubscriptionDto {
  routeId: string;
  pricingPlanId: string;
  studentIds: string[];
  pickupStopId?: string;
  dateDebut?: string;
}

export interface CancelRefundResult {
  ok: boolean;
  subscriptionId: string;
  status: SubscriptionStatus;
  refund: {
    amount: number;
    percent: number;
    retained: number;
    remainingDays: number;
    totalDays: number;
  };
}

// ─── API ─────────────────────────────────────────────

export const transportScolaireApi = {
  // Enfants
  listStudents: () => api.get<Student[]>('/transport-scolaire/students'),
  getStudent: (id: string) =>
    api.get<Student>(`/transport-scolaire/students/${id}`),
  createStudent: (dto: UpsertStudentDto) =>
    api.post<Student>('/transport-scolaire/students', dto),
  updateStudent: (id: string, dto: UpsertStudentDto) =>
    api.patch<Student>(`/transport-scolaire/students/${id}`, dto),
  removeStudent: (id: string) =>
    api.delete<{ ok: boolean }>(`/transport-scolaire/students/${id}`),

  // Recherche
  listSchools: () => api.get<SchoolPublic[]>('/transport-scolaire/schools'),
  listRoutesOfSchool: (schoolId: string) =>
    api.get<TransportRoutePublic[]>(
      `/transport-scolaire/schools/${schoolId}/routes`,
    ),
  getRoute: (routeId: string) =>
    api.get<TransportRoutePublic>(`/transport-scolaire/routes/${routeId}`),

  // Abonnements
  listSubscriptions: () =>
    api.get<TransportSubscription[]>('/transport-scolaire/subscriptions'),
  getSubscription: (id: string) =>
    api.get<TransportSubscription>(`/transport-scolaire/subscriptions/${id}`),
  createSubscription: (dto: CreateSubscriptionDto) =>
    api.post<TransportSubscription>('/transport-scolaire/subscriptions', dto),
  paySubscription: (id: string) =>
    api.post<{
      ok: boolean;
      subscriptionId: string;
      codeAbonnement: string;
      status: SubscriptionStatus;
      transactionRef: string;
    }>(`/transport-scolaire/subscriptions/${id}/pay`, {}),
  cancelSubscription: (id: string, reason?: string) =>
    api.patch<CancelRefundResult>(
      `/transport-scolaire/subscriptions/${id}/cancel`,
      { reason },
    ),
};

export default transportScolaireApi;

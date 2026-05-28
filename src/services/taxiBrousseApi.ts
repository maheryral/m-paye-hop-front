// src/services/taxiBrousseApi.ts
import api from './api';

// ============ TYPES ============

export interface VoyageSearchResult {
  id: string;
  dateDepart: string;
  heureDepart: string;
  dateArrivee: string;
  heureArrivee: string;
  localisationDepart: string;
  localisationArrivee: string;
  villeDepart: string;
  villeArrivee: string;
  prix: number;
  dureeEstimee?: string;
  statut: string;
  // Coordonnées GPS optionnelles
  latitudeDepart?: number;
  longitudeDepart?: number;
  latitudeArrivee?: number;
  longitudeArrivee?: number;
  distanceKm?: number;
  voiture: {
    id: string;
    matricule: string;
    nom?: string;
    capacite: number;
    marque?: string;
    modele?: string;
  };
  classe: {
    id: string;
    type: string; // économique / confort / luxe / vip
    description?: string;
    coefficientPrix: number;
  };
  chauffeur?: {
    id: string;
    nom: string;
    prenom: string;
  };
  cooperative?: {
    id: string;
    nom: string;
    telephone?: string;
    gareRoutiere?: {
      id: string;
      nom: string;
      localisation: string;
      latitude?: number;
      longitude?: number;
    };
  };
  placesDisponibles?: {
    placeReservee: number;
    placeBloquee: number;
    placeLibre: number;
  };
}

export interface SeatInfo {
  numPlace: number;
  isReserved: boolean;
  isPaid: boolean;
  status: string;
}

/** Types de cellule possibles dans un plan visuel personnalisé. */
export type SeatCellType =
  | 'seat'
  | 'window_seat'
  | 'vip_seat'
  | 'accessible_seat'
  | 'aisle'
  | 'door'
  | 'driver'
  | 'empty'
  | 'wc';

export interface SeatDeck {
  deckNumber: number;
  name?: string;
  grid: SeatCellType[][];
}

export interface SeatLayout {
  decks: SeatDeck[];
}

export interface SeatPosition {
  deck: number;
  row: number;
  col: number;
  type: SeatCellType;
}

export interface SeatMap {
  voyageId: string;
  capacity: number;
  reservedCount: number;
  availableCount: number;
  seats: SeatInfo[];
  /** Plan visuel personnalisé (null si pas configuré → fallback grille générique) */
  layout: SeatLayout | null;
  /** numPlace → coordonnées dans le layout (null si pas de layout) */
  seatPositions: Record<number, SeatPosition> | null;
}

export interface Reservation {
  id: string;
  numPlace: number;
  statusPaiement: string;
  statusReservation: string;
  dateReservation: string;
  dateLimitePaiement: string;
  prixPaye: number;
  codeConfirmation: string;
  voyage?: VoyageSearchResult;
  paiements?: Array<{
    id: string;
    montant: number;
    modePaiement: string;
    datePaiement: string;
    statut: string;
  }>;
}

// ============ API CLIENT ============

export const taxiBrousseApi = {
  // Recherche & voyages
  searchVoyages: (depart: string, arrivee: string, date?: string) =>
    api.get<VoyageSearchResult[]>('/voyages/search', {
      params: { depart, arrivee, date },
    }),

  getVoyage: (id: string) => api.get<VoyageSearchResult>(`/voyages/${id}`),

  suggestCities: (q: string, field?: 'depart' | 'arrivee') =>
    api.get<string[]>('/voyages/cities/suggest', {
      params: { q, ...(field ? { field } : {}) },
    }),

  getSeatMap: (voyageId: string) =>
    api.get<SeatMap>(`/voyages/${voyageId}/seat-map`),

  // Réservations
  createReservation: (voyageId: string, numPlace: number, prixPaye?: number) =>
    api.post<Reservation>('/reservations', { voyageId, numPlace, prixPaye }),

  createReservationBatch: (
    voyageId: string,
    numPlaces: number[],
    prixPaye?: number,
  ) =>
    api.post<Reservation[]>('/reservations/batch', {
      voyageId,
      numPlaces,
      prixPaye,
    }),

  getMyReservations: () => api.get<Reservation[]>('/reservations/me'),

  getReservation: (id: string) => api.get<Reservation>(`/reservations/${id}`),

  payReservation: (
    id: string,
    mode: 'wallet' | 'cash' | 'mobile_money' = 'wallet',
  ) => api.post<Reservation>(`/reservations/${id}/pay`, { mode }),

  payReservationBatch: (
    reservationIds: string[],
    mode: 'wallet' | 'cash' | 'mobile_money' = 'wallet',
  ) =>
    api.post<{ ok: boolean; count: number; montantTotal: number }>(
      '/reservations/pay-batch',
      { reservationIds, mode },
    ),

  cancelReservation: (id: string) =>
    api.patch(`/reservations/${id}/cancel`),
};

export default taxiBrousseApi;

// src/services/telepheriqueApi.ts
import api from './api';

// ============ TYPES ============

export interface TLPStation {
  id: string;
  nom: string;
  localisation: string;
  ordre: number;
  latitude?: number;
  longitude?: number;
}

export interface TLPTarif {
  id: string;
  type: string; // SIMPLE | RETOUR | JOUR | MOIS
  libelle: string;
  prix: number;
  description?: string;
  validiteHeures: number;
}

export interface TLPLigne {
  id: string;
  nom: string;
  code: string;
  couleur: string;
  description?: string;
  longueurKm?: number;
  dureeMinutes?: number;
  statut: string; // actif | maintenance | ferme
  horaireOuverture?: string;
  horaireFermeture?: string;
  stations?: TLPStation[];
  tarifs?: TLPTarif[];
}

export interface TLPTicket {
  id: string;
  codeQR: string;
  prixPaye: number;
  statusPaiement: string; // en_attente | paye | annule
  statusTicket: string; // valide | utilise | expire | annule
  modePaiement?: string;
  dateAchat: string;
  dateValidite: string;
  dateUtilisation?: string;
  ligne?: TLPLigne;
  tarif?: TLPTarif;
  stationDepart?: TLPStation;
  stationArrivee?: TLPStation;
}

// ============ API CLIENT ============

export const telepheriqueApi = {
  // Lignes
  getLignes: () => api.get<TLPLigne[]>('/telepherique/lignes'),
  getLigne: (id: string) => api.get<TLPLigne>(`/telepherique/lignes/${id}`),

  // Stations & tarifs
  getStationsByLigne: (ligneId: string) =>
    api.get<TLPStation[]>('/telepherique/stations', { params: { ligneId } }),
  getTarifsByLigne: (ligneId: string) =>
    api.get<TLPTarif[]>('/telepherique/tarifs', { params: { ligneId } }),

  // Tickets utilisateur
  createTicket: (data: {
    ligneId: string;
    tarifId: string;
    stationDepartId: string;
    stationArriveeId: string;
  }) => api.post<TLPTicket>('/telepherique/tickets', data),

  getMyTickets: () => api.get<TLPTicket[]>('/telepherique/tickets/me'),

  getTicket: (id: string) => api.get<TLPTicket>(`/telepherique/tickets/${id}`),

  payTicket: (id: string, mode: 'wallet' | 'cash' | 'mobile_money' = 'wallet') =>
    api.post<TLPTicket>(`/telepherique/tickets/${id}/pay`, { mode }),

  cancelTicket: (id: string) =>
    api.patch<TLPTicket>(`/telepherique/tickets/${id}/cancel`),

  validateQR: (codeQR: string) =>
    api.post<TLPTicket>(`/telepherique/tickets/validate/${codeQR}`),
};

export default telepheriqueApi;

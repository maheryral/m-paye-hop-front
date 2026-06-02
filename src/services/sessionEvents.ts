// src/services/sessionEvents.ts
// Bus d'événements de session — utilisé par api.js pour notifier AuthContext
// quand le refresh token a expiré (ou été révoqué) et que l'utilisateur doit
// être déconnecté/redirigé vers /login.

type SessionListener = () => void;

const listeners = new Set<SessionListener>();

export const sessionEvents = {
  /** Abonne un listener. Retourne la fonction de désabonnement. */
  onExpired(listener: SessionListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Diffuse l'événement "session expirée" à tous les listeners. */
  emitExpired(): void {
    listeners.forEach((l) => {
      try {
        l();
      } catch {
        // un listener qui throw ne doit pas bloquer les autres
      }
    });
  },
};

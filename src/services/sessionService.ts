import { ekalyApi } from './apiClient';
import { Session, SessionStatus } from '../types';

/**
 * Abonnement temps réel aux sessions de voyage d'études depuis PostgreSQL
 */
export function subscribeToSessions(
  onUpdate: (sessions: Session[]) => void,
  onError: (err: any) => void
) {
  let lastSignature = '';

  const fetchSessions = async () => {
    try {
      const rows = await ekalyApi.sessions.list();
      const list: Session[] = rows.map((data: any) => ({
        id: data.id,
        nom: data.nom || 'Session de voyage',
        destination: data.lieu || data.destination || '',
        dateDebut: data.date_debut || data.dateDebut || new Date().toISOString().slice(0, 10),
        dateFin: data.date_fin || data.dateFin || new Date().toISOString().slice(0, 10),
        statut: (data.statut as SessionStatus) || 'planned',
        description: data.description || '',
        createdAt: data.created_at || data.createdAt,
        updatedAt: data.updated_at || data.updatedAt,
      }));

      // Tri par date de début décroissante
      list.sort((a, b) => b.dateDebut.localeCompare(a.dateDebut));

      const sig = list.map((s) => `${s.id}:${s.statut}:${s.nom}:${s.updatedAt || ''}`).join('|');
      if (sig !== lastSignature) {
        lastSignature = sig;
        onUpdate(list);
      }
    } catch (error) {
      console.error('[PostgreSQL] Erreur chargement sessions:', error);
      onError(error);
    }
  };

  fetchSessions();
  const intervalId = window.setInterval(fetchSessions, 10000);
  return () => window.clearInterval(intervalId);
}

export async function createSession(
  sessionData: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const newId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const res = await ekalyApi.sessions.create({
    id: newId,
    nom: sessionData.nom,
    annee: new Date(sessionData.dateDebut || Date.now()).getFullYear().toString(),
    statut: sessionData.statut || 'active',
    dateDebut: sessionData.dateDebut,
    dateFin: sessionData.dateFin,
    lieu: sessionData.destination || '',
    description: sessionData.description || '',
    totalEtudiants: 0,
  });
  return res.id || newId;
}

export async function updateSession(
  id: string,
  updates: Partial<Session>
): Promise<void> {
  await ekalyApi.sessions.update(id, {
    nom: updates.nom,
    statut: updates.statut,
    dateDebut: updates.dateDebut,
    dateFin: updates.dateFin,
    lieu: updates.destination,
    description: updates.description,
  });
}

export async function deleteSession(id: string): Promise<void> {
  await ekalyApi.sessions.delete(id);
}

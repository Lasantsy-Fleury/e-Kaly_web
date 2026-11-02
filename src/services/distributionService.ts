import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Distribution, DistributionStatus, DistributionType } from '../types';

/** Normalises the legacy "active" status (mobile) to the Web "ongoing" one. */
export function normalizeDistributionStatus(raw: unknown): DistributionStatus {
  switch (String(raw || '').toLowerCase()) {
    case 'ongoing':
    case 'active':
    case 'en_cours':
      return 'ongoing';
    case 'completed':
    case 'termine':
      return 'completed';
    case 'cancelled':
    case 'annule':
      return 'cancelled';
    case 'draft':
    case 'brouillon':
      return 'draft';
    default:
      return 'planned';
  }
}

function parseLocalDateTime(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const [year, month, day] = date.split('-').map((part) => Number(part));
  const [hours, minutes] = time.split(':').map((part) => Number(part));
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return null;
  }
  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getDistributionStart(distribution: Distribution): Date | null {
  return parseLocalDateTime(distribution.date, distribution.heureDebut);
}

export function getDistributionEnd(distribution: Distribution): Date | null {
  return parseLocalDateTime(distribution.date, distribution.heureFin);
}

/**
 * A distribution accepts pointages only when it is explicitly opened
 * ("ongoing") AND the current time is inside its [heureDebut, heureFin] slot.
 */
export function isDistributionOpen(distribution: Distribution, now: Date = new Date()): boolean {
  if (normalizeDistributionStatus(distribution.statut) !== 'ongoing') return false;
  const start = getDistributionStart(distribution);
  const end = getDistributionEnd(distribution);
  if (!start || !end) return false;
  return now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
}

/** True when the slot is over but the distribution has not been closed yet. */
export function isDistributionExpired(distribution: Distribution, now: Date = new Date()): boolean {
  if (normalizeDistributionStatus(distribution.statut) !== 'ongoing') return false;
  const end = getDistributionEnd(distribution);
  return !!end && now.getTime() > end.getTime();
}

/** Status shown in the UI, taking the end of the slot into account. */
export function getEffectiveStatus(
  distribution: Distribution,
  now: Date = new Date()
): DistributionStatus {
  if (isDistributionExpired(distribution, now)) return 'completed';
  return normalizeDistributionStatus(distribution.statut);
}

/** Canonical meal identity shared with the mobile app (avoids duplicate ids). */
export function getMealIdentity(distribution: Distribution): string {
  return distribution.typeDistribution || distribution.repasProduits?.[0] || 'Repas';
}

export function describeDistributionWindow(distribution: Distribution): string {
  return `${distribution.heureDebut} – ${distribution.heureFin}`;
}

const closingDistributionIds = new Set<string>();

/**
 * Closes every distribution whose slot is finished. Used by the admin Web
 * session as a fallback when nobody manually closes the distribution.
 */
export async function closeExpiredDistributions(
  distributions: Distribution[],
  now: Date = new Date()
): Promise<string[]> {
  const closed: string[] = [];
  for (const distribution of distributions) {
    if (!isDistributionExpired(distribution, now)) continue;
    if (closingDistributionIds.has(distribution.id)) continue;
    closingDistributionIds.add(distribution.id);
    try {
      await updateDistribution(distribution.id, { statut: 'completed' });
      closed.push(distribution.id);
    } catch (error) {
      console.error('Auto-close distribution failed:', distribution.id, error);
    } finally {
      closingDistributionIds.delete(distribution.id);
    }
  }
  return closed;
}

export function subscribeToDistributions(
  onUpdate: (distributions: Distribution[]) => void,
  onError: (err: any) => void
) {
  const colRef = collection(db, 'distributions');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Distribution[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          sessionId: data.sessionId || '',
          sessionNom: data.sessionNom || '',
          nom: data.nom || 'Distribution',
          date: data.date || new Date().toISOString().slice(0, 10),
          heureDebut: data.heureDebut || '11:30',
          heureFin: data.heureFin || '13:30',
          typeDistribution: (data.typeDistribution as DistributionType) || 'Déjeuner',
          repasProduits: Array.isArray(data.repasProduits) ? data.repasProduits : [data.typeDistribution || 'Déjeuner'],
          quantitePrevue: typeof data.quantitePrevue === 'number' ? data.quantitePrevue : 0,
          description: data.description || '',
          statut: normalizeDistributionStatus(data.statut),
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      });

      // Sort by date descending then time descending
      list.sort((a, b) => {
        const cmp = b.date.localeCompare(a.date);
        if (cmp !== 0) return cmp;
        return b.heureDebut.localeCompare(a.heureDebut);
      });

      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'distributions');
    }
  );
}

export async function createDistribution(
  dist: Omit<Distribution, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const newId = `dist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const docRef = doc(db, 'distributions', newId);
  const now = new Date().toISOString();

  try {
    const payload: Distribution = {
      ...dist,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(docRef, payload);
    return newId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `distributions/${newId}`);
  }
}

/**
 * Creates the standard 4 meal distributions for a specific day of the study trip
 * Petit-déjeuner, Bouteille d'eau, Déjeuner, Dîner.
 * Quantité prévue strictly equals the number of enrolled students.
 */
export async function createFullDayDistributions(
  sessionId: string,
  sessionNom: string,
  date: string,
  studentCount: number
): Promise<void> {
  const standardMeals: Array<{
    nom: string;
    type: DistributionType;
    debut: string;
    fin: string;
    produits: string[];
  }> = [
    {
      nom: `Petit-déjeuner — ${date}`,
      type: 'Petit-déjeuner',
      debut: '06:30',
      fin: '08:30',
      produits: ['Petit-déjeuner complet', 'Boisson chaude', 'Pain'],
    },
    {
      nom: `Ration d'eau minérale — ${date}`,
      type: 'Eau',
      debut: '09:00',
      fin: '10:30',
      produits: ["Bouteille d'eau 1.5L"],
    },
    {
      nom: `Déjeuner — ${date}`,
      type: 'Déjeuner',
      debut: '11:45',
      fin: '14:00',
      produits: ['Plat chaud déjeuner', 'Dessert'],
    },
    {
      nom: `Dîner — ${date}`,
      type: 'Dîner',
      debut: '19:00',
      fin: '21:30',
      produits: ['Repas du soir', 'Collation'],
    },
  ];

  for (const m of standardMeals) {
    await createDistribution({
      sessionId,
      sessionNom,
      nom: m.nom,
      date,
      heureDebut: m.debut,
      heureFin: m.fin,
      typeDistribution: m.type,
      repasProduits: m.produits,
      quantitePrevue: studentCount,
      statut: 'planned',
      description: `Distribution ${m.type} pour les étudiants M1 ENI de la session.`,
    });
  }
}

export async function updateDistribution(
  id: string,
  updates: Partial<Distribution>
): Promise<void> {
  const docRef = doc(db, 'distributions', id);
  try {
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `distributions/${id}`);
  }
}

export async function changeDistributionStatus(
  id: string,
  newStatus: DistributionStatus
): Promise<void> {
  await updateDistribution(id, { statut: newStatus });
}

export async function deleteDistribution(id: string): Promise<void> {
  const docRef = doc(db, 'distributions', id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `distributions/${id}`);
  }
}

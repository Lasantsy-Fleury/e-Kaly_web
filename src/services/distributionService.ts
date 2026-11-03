import { ekalyApi } from './apiClient';
import { Distribution, DistributionStatus, DistributionType } from '../types';

/** Normalises the legacy "active" status to "ongoing". */
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
 * A distribution accepts pointages when:
 * 1. It is explicitly "ongoing", OR
 * 2. It is "planned" / "draft" and the local clock has arrived inside [heureDebut, heureFin].
 */
export function isDistributionOpen(distribution: Distribution, now: Date = new Date()): boolean {
  const norm = normalizeDistributionStatus(distribution.statut);
  if (norm === 'completed' || norm === 'cancelled') return false;
  const start = getDistributionStart(distribution);
  const end = getDistributionEnd(distribution);
  if (!start || !end) return false;
  const time = now.getTime();
  return (
    time >= start.getTime() &&
    time <= end.getTime() &&
    (norm === 'ongoing' || norm === 'planned' || norm === 'draft')
  );
}

/** True when the slot is over but the distribution has not been closed yet. */
export function isDistributionExpired(distribution: Distribution, now: Date = new Date()): boolean {
  const norm = normalizeDistributionStatus(distribution.statut);
  if (norm === 'cancelled') return false;
  const end = getDistributionEnd(distribution);
  return !!end && now.getTime() > end.getTime();
}

/** True when the distribution is planned or draft and its slot has arrived. */
export function shouldAutoOpenDistribution(
  distribution: Distribution,
  now: Date = new Date()
): boolean {
  const norm = normalizeDistributionStatus(distribution.statut);
  if (norm !== 'planned' && norm !== 'draft') return false;
  const start = getDistributionStart(distribution);
  const end = getDistributionEnd(distribution);
  if (!start || !end) return false;
  const time = now.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

/** Status shown in the UI, taking automatic slot opening and closing into account. */
export function getEffectiveStatus(
  distribution: Distribution,
  now: Date = new Date()
): DistributionStatus {
  const norm = normalizeDistributionStatus(distribution.statut);
  if (norm === 'cancelled') return 'cancelled';
  if (norm === 'completed' || isDistributionExpired(distribution, now)) return 'completed';
  if (isDistributionOpen(distribution, now)) return 'ongoing';
  return norm;
}

/** Canonical meal identity shared with the mobile app (avoids duplicate ids). */
export function getMealIdentity(distribution: Distribution): string {
  return distribution.typeDistribution || distribution.repasProduits?.[0] || 'Repas';
}

export function describeDistributionWindow(distribution: Distribution): string {
  return `${distribution.heureDebut} – ${distribution.heureFin}`;
}

const syncInProgressIds = new Set<string>();

/**
 * Automatically synchronizes distribution statuses with time slots in PostgreSQL:
 * 1. Opens distributions whose scheduled slot [heureDebut, heureFin] has arrived.
 * 2. Closes distributions whose slot has ended.
 */
export async function autoSynchronizeDistributionStatuses(
  distributions: Distribution[],
  now: Date = new Date()
): Promise<{ opened: string[]; closed: string[] }> {
  const opened: string[] = [];
  const closed: string[] = [];

  for (const distribution of distributions) {
    if (syncInProgressIds.has(distribution.id)) continue;

    // 1. Auto-open when time slot arrives
    if (shouldAutoOpenDistribution(distribution, now)) {
      syncInProgressIds.add(distribution.id);
      try {
        await changeDistributionStatus(distribution.id, 'ongoing');
        opened.push(distribution.id);
      } catch (error) {
        console.error('[PostgreSQL] Auto-open distribution failed:', distribution.id, error);
      } finally {
        syncInProgressIds.delete(distribution.id);
      }
      continue;
    }

    // 2. Auto-close when time slot ends
    if (
      isDistributionExpired(distribution, now) &&
      normalizeDistributionStatus(distribution.statut) !== 'completed'
    ) {
      syncInProgressIds.add(distribution.id);
      try {
        await changeDistributionStatus(distribution.id, 'completed');
        closed.push(distribution.id);
      } catch (error) {
        console.error('[PostgreSQL] Auto-close distribution failed:', distribution.id, error);
      } finally {
        syncInProgressIds.delete(distribution.id);
      }
    }
  }

  return { opened, closed };
}

export async function closeExpiredDistributions(
  distributions: Distribution[],
  now: Date = new Date()
): Promise<string[]> {
  const result = await autoSynchronizeDistributionStatuses(distributions, now);
  return result.closed;
}

/**
 * Abonnement réactif aux distributions depuis la base PostgreSQL
 */
export function subscribeToDistributions(
  onUpdate: (distributions: Distribution[]) => void,
  onError: (err: any) => void
) {
  const fetchDistributions = async () => {
    try {
      const rows = await ekalyApi.distributions.list();
      const list: Distribution[] = rows.map((data: any) => ({
        id: data.id,
        sessionId: data.session_id || data.sessionId || '',
        sessionNom: data.session_nom || data.sessionNom || '',
        nom: data.nom || 'Distribution',
        date: data.date || new Date().toISOString().slice(0, 10),
        heureDebut: data.heure_debut || data.heureDebut || '11:30',
        heureFin: data.heure_fin || data.heureFin || '13:30',
        typeDistribution: (data.type_distribution || data.typeDistribution || 'Déjeuner') as DistributionType,
        repasProduits: Array.isArray(data.repas_produits)
          ? data.repas_produits
          : Array.isArray(data.repasProduits)
          ? data.repasProduits
          : [data.type_distribution || data.typeDistribution || 'Déjeuner'],
        quantitePrevue:
          typeof data.quantite_prevue === 'number'
            ? data.quantite_prevue
            : typeof data.quantitePrevue === 'number'
            ? data.quantitePrevue
            : 0,
        description: data.description || '',
        statut: normalizeDistributionStatus(data.statut),
        createdAt: data.created_at || data.createdAt,
        updatedAt: data.updated_at || data.updatedAt,
      }));

      // Sort by date descending then time descending
      list.sort((a, b) => {
        const cmp = b.date.localeCompare(a.date);
        if (cmp !== 0) return cmp;
        return b.heureDebut.localeCompare(a.heureDebut);
      });

      onUpdate(list);
    } catch (error) {
      console.error('[PostgreSQL] Erreur chargement distributions:', error);
      onError(error);
    }
  };

  fetchDistributions();
  const intervalId = window.setInterval(fetchDistributions, 5000);
  return () => window.clearInterval(intervalId);
}

export async function createDistribution(
  dist: Omit<Distribution, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const newId = `dist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const res = await ekalyApi.distributions.create({
    id: newId,
    sessionId: dist.sessionId,
    sessionNom: dist.sessionNom,
    nom: dist.nom,
    date: dist.date,
    heureDebut: dist.heureDebut,
    heureFin: dist.heureFin,
    typeDistribution: dist.typeDistribution,
    repasProduits: dist.repasProduits,
    quantitePrevue: dist.quantitePrevue,
    statut: dist.statut,
    description: dist.description,
  });
  return res.id || newId;
}

export async function createFullDayDistributions(
  sessionId: string,
  sessionNom: string,
  date: string,
  studentCount: number
): Promise<void> {
  await ekalyApi.distributions.createFullDay(sessionId, sessionNom, date, studentCount);
}

export async function updateDistribution(
  id: string,
  updates: Partial<Distribution>
): Promise<void> {
  await ekalyApi.distributions.update(id, {
    nom: updates.nom,
    date: updates.date,
    heureDebut: updates.heureDebut,
    heureFin: updates.heureFin,
    typeDistribution: updates.typeDistribution,
    repasProduits: updates.repasProduits,
    quantitePrevue: updates.quantitePrevue,
    statut: updates.statut,
    description: updates.description,
  });
}

export async function changeDistributionStatus(
  id: string,
  newStatus: DistributionStatus
): Promise<void> {
  await ekalyApi.distributions.changeStatus(id, newStatus);
}

export async function deleteDistribution(id: string): Promise<void> {
  await ekalyApi.distributions.delete(id);
}

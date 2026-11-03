import { ekalyApi } from './apiClient';
import { AccountStatus, AuditLog, UserAccount, UserRole } from '../types';

/**
 * Abonnement réactif à la liste des utilisateurs depuis PostgreSQL
 */
export function subscribeToUserAccounts(
  onUpdate: (accounts: UserAccount[]) => void,
  onError: (err: any) => void
) {
  let lastSignature = '';

  const fetchUsers = async () => {
    try {
      const rows = await ekalyApi.users.list();
      const list: UserAccount[] = rows.map((data: any) => ({
        uid: data.id,
        email: data.email || '',
        displayName: data.display_name || data.displayName || 'Utilisateur',
        role: (data.role as UserRole) || 'pointer',
        status: (data.status as AccountStatus) || 'pending',
        requestedAt: data.created_at || data.requestedAt || new Date().toISOString(),
        updatedAt: data.updated_at || data.updatedAt,
        assignedSessionId: data.assigned_session_id || data.assignedSessionId || null,
        assignedSessionNom: data.assigned_session_nom || data.assignedSessionNom || null,
        sessionId: data.assigned_session_id || data.assignedSessionId || null,
      }));

      // Sort pending first, then by requestedAt desc
      list.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
        return (b.requestedAt || '').localeCompare(a.requestedAt || '');
      });

      const sig = list.map((u) => `${u.uid}:${u.role}:${u.status}:${u.assignedSessionId || ''}`).join('|');
      if (sig !== lastSignature) {
        lastSignature = sig;
        onUpdate(list);
      }
    } catch (error) {
      console.error('[PostgreSQL] Erreur chargement utilisateurs:', error);
      onError(error);
    }
  };

  fetchUsers();
  const intervalId = window.setInterval(fetchUsers, 10000);
  return () => window.clearInterval(intervalId);
}

export async function updateAccount(
  targetUid: string,
  updates: {
    status?: AccountStatus;
    role?: UserRole;
    assignedSessionId?: string | null;
    assignedSessionNom?: string | null;
  },
  adminInfo: {
    uid: string;
    displayName: string;
    email: string;
  }
): Promise<void> {
  try {
    // 1. Mise à jour statut / rôle dans PostgreSQL
    if (updates.status || updates.role) {
      await ekalyApi.users.updateStatus(targetUid, updates.status || '', updates.role);
    }

    // 2. Assignation de session de voyage dans PostgreSQL
    if (updates.assignedSessionId !== undefined) {
      await ekalyApi.users.assignSession(
        targetUid,
        updates.assignedSessionId || '',
        updates.assignedSessionNom || undefined
      );
    }

    // 3. Enregistrement dans le journal d'audit PostgreSQL
    await ekalyApi.audit.log(
      `ACCOUNT_${updates.status ? updates.status.toUpperCase() : 'UPDATED'}`,
      adminInfo.uid,
      {
        targetUid,
        updates,
        adminName: adminInfo.displayName,
        adminEmail: adminInfo.email,
      }
    );
  } catch (error) {
    console.error('[PostgreSQL] Erreur mise à jour compte:', error);
    throw error;
  }
}

/**
 * Abonnement au journal d'audit depuis PostgreSQL
 */
export function subscribeToAuditLogs(
  onUpdate: (logs: AuditLog[]) => void,
  onError: (err: any) => void
) {
  let lastSignature = '';

  const fetchAudit = async () => {
    try {
      const rows = await ekalyApi.audit.list(100);
      const list: AuditLog[] = rows.map((d: any) => ({
        id: d.id,
        action: d.action,
        details: typeof d.details === 'string' ? d.details : JSON.stringify(d.details),
        performedByUid: d.performed_by_uid || '',
        performedByName: d.details?.adminName || 'Administrateur',
        performedByEmail: d.details?.adminEmail || '',
        timestamp: d.timestamp || new Date().toISOString(),
      }));

      list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      const sig = `${list.length}:` + (list[0]?.id || '') + ':' + (list[0]?.timestamp || '');
      if (sig !== lastSignature) {
        lastSignature = sig;
        onUpdate(list);
      }
    } catch (error) {
      console.error('[PostgreSQL] Erreur chargement journal audit:', error);
      onError(error);
    }
  };

  fetchAudit();
  const intervalId = window.setInterval(fetchAudit, 15000);
  return () => window.clearInterval(intervalId);
}

import {
  collection,
  doc,
  updateDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AccountStatus, AuditLog, UserAccount, UserRole } from '../types';

export function subscribeToUserAccounts(
  onUpdate: (accounts: UserAccount[]) => void,
  onError: (err: any) => void
) {
  const colRef = collection(db, 'users');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: UserAccount[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          uid: docSnap.id,
          email: data.email || '',
          displayName: data.displayName || 'Utilisateur',
          role: (data.role as UserRole) || 'pointer',
          status: (data.status as AccountStatus) || 'pending',
          requestedAt: data.requestedAt || new Date().toISOString(),
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        };
      });

      // Sort pending first, then by requestedAt desc
      list.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
        return (b.requestedAt || '').localeCompare(a.requestedAt || '');
      });

      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    }
  );
}

export async function updateAccount(
  targetUid: string,
  updates: {
    status?: AccountStatus;
    role?: UserRole;
  },
  adminInfo: {
    uid: string;
    displayName: string;
    email: string;
  }
): Promise<void> {
  const userRef = doc(db, 'users', targetUid);
  const now = new Date().toISOString();

  try {
    const payload: Partial<UserAccount> = {
      ...updates,
      updatedAt: now,
      updatedBy: adminInfo.uid,
    };
    await updateDoc(userRef, payload);

    // If role changed to admin or updated, sync with /admins doc
    if (updates.role === 'admin') {
      const adminRef = doc(db, 'admins', targetUid);
      await setDoc(adminRef, {
        email: adminInfo.email,
        updatedAt: now,
      }, { merge: true });
    }

    // Record audit log
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const logRef = doc(db, 'auditLogs', logId);
    const logData: AuditLog = {
      id: logId,
      action: `ACCOUNT_${updates.status ? updates.status.toUpperCase() : 'UPDATED'}`,
      details: `Compte ${targetUid} mis à jour: ${JSON.stringify(updates)}`,
      performedByUid: adminInfo.uid,
      performedByName: adminInfo.displayName,
      performedByEmail: adminInfo.email,
      timestamp: now,
    };
    await setDoc(logRef, logData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export function subscribeToAuditLogs(
  onUpdate: (logs: AuditLog[]) => void,
  onError: (err: any) => void
) {
  const colRef = collection(db, 'auditLogs');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: AuditLog[] = snapshot.docs.map((d) => d.data() as AuditLog);
      list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'auditLogs');
    }
  );
}

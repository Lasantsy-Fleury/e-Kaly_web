import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Session, SessionStatus } from '../types';

export function subscribeToSessions(
  onUpdate: (sessions: Session[]) => void,
  onError: (err: any) => void
) {
  const colRef = collection(db, 'sessions');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Session[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          nom: data.nom || 'Session de voyage',
          destination: data.destination || '',
          dateDebut: data.dateDebut || new Date().toISOString().slice(0, 10),
          dateFin: data.dateFin || new Date().toISOString().slice(0, 10),
          statut: (data.statut as SessionStatus) || 'planned',
          description: data.description || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      });

      // Sort by dateDebut descending
      list.sort((a, b) => b.dateDebut.localeCompare(a.dateDebut));
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'sessions');
    }
  );
}

export async function createSession(
  sessionData: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const newId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const docRef = doc(db, 'sessions', newId);
  const now = new Date().toISOString();

  try {
    const payload: Session = {
      ...sessionData,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(docRef, payload);
    return newId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `sessions/${newId}`);
  }
}

export async function updateSession(
  id: string,
  updates: Partial<Session>
): Promise<void> {
  const docRef = doc(db, 'sessions', id);
  try {
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sessions/${id}`);
  }
}

export async function deleteSession(id: string): Promise<void> {
  const docRef = doc(db, 'sessions', id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `sessions/${id}`);
  }
}

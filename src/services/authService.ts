import {
  signInWithPopup,
  signOut as fbSignOut,
  User as FirebaseUser,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from '../firebase';
import { UserAccount } from '../types';

export const BOOTSTRAP_ADMIN_EMAIL = 'tokiniainanarivelosoa@gmail.com';

export async function loginWithGoogle(): Promise<UserAccount> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const fbUser = cred.user;
    return await syncUserProfile(fbUser);
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  await fbSignOut(auth);
}

export async function syncUserProfile(fbUser: FirebaseUser): Promise<UserAccount> {
  const userRef = doc(db, 'users', fbUser.uid);
  const adminRef = doc(db, 'admins', fbUser.uid);
  const isBootstrapAdmin = fbUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

  try {
    const snap = await getDoc(userRef);

    if (isBootstrapAdmin) {
      // Ensure admin document exists in /admins for rule validation
      try {
        await setDoc(adminRef, {
          email: fbUser.email,
          displayName: fbUser.displayName || 'Administrateur Principal',
          isRootAdmin: true,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (err) {
        console.warn('Could not write /admins document directly:', err);
      }

      const adminAccount: UserAccount = {
        uid: fbUser.uid,
        email: fbUser.email || BOOTSTRAP_ADMIN_EMAIL,
        displayName: fbUser.displayName || 'Administrateur Principal',
        role: 'admin',
        status: 'approved',
        requestedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(userRef, adminAccount, { merge: true });
      return adminAccount;
    }

    if (!snap.exists()) {
      // Create pending account request
      const newAccount: UserAccount = {
        uid: fbUser.uid,
        email: fbUser.email || '',
        displayName: fbUser.displayName || 'Utilisateur',
        role: 'pointer',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };
      await setDoc(userRef, newAccount);
      return newAccount;
    }

    return snap.data() as UserAccount;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${fbUser.uid}`);
  }
}

export function subscribeToAuthAndProfile(
  onUpdate: (user: FirebaseUser | null, account: UserAccount | null) => void,
  onError: (err: any) => void
) {
  let unsubProfile: (() => void) | null = null;

  const unsubAuth = onAuthStateChanged(
    auth,
    async (fbUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (!fbUser) {
        onUpdate(null, null);
        return;
      }

      const isBootstrapAdmin = fbUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
      const userRef = doc(db, 'users', fbUser.uid);

      // Listen to profile updates in real-time (approvals, role changes, suspensions)
      unsubProfile = onSnapshot(
        userRef,
        async (snap) => {
          if (snap.exists()) {
            onUpdate(fbUser, snap.data() as UserAccount);
          } else {
            // First time login sync
            try {
              const created = await syncUserProfile(fbUser);
              onUpdate(fbUser, created);
            } catch (err) {
              onError(err);
            }
          }
        },
        (error) => {
          // If bootstrap admin has permission or not found yet
          if (isBootstrapAdmin) {
            onUpdate(fbUser, {
              uid: fbUser.uid,
              email: fbUser.email || BOOTSTRAP_ADMIN_EMAIL,
              displayName: fbUser.displayName || 'Administrateur Principal',
              role: 'admin',
              status: 'approved',
              requestedAt: new Date().toISOString(),
            });
          } else {
            handleFirestoreError(error, OperationType.GET, `users/${fbUser.uid}`);
          }
        }
      );
    },
    onError
  );

  return () => {
    unsubAuth();
    if (unsubProfile) unsubProfile();
  };
}

import {
  signInWithPopup,
  signOut as fbSignOut,
  User as FirebaseUser,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { UserAccount } from '../types';
import { ekalyApi } from './apiClient';

export const BOOTSTRAP_ADMIN_EMAIL = 'tokiniainanarivelosoa@gmail.com';

/**
 * Authentification Google via popup, immédiatement synchronisée avec PostgreSQL.
 * Aucune donnée n'est stockée dans Firestore : tout est géré par la base PostgreSQL du backend.
 */
export async function loginWithGoogle(): Promise<UserAccount> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const fbUser = cred.user;
    const idToken = await fbUser.getIdToken();

    // Envoi des identifiants Google au backend PostgreSQL
    const res = await ekalyApi.auth.googleLogin({
      uid: fbUser.uid,
      email: fbUser.email || '',
      displayName: fbUser.displayName || '',
      photoUrl: fbUser.photoURL || '',
      credential: idToken,
    });

    if (res.token) {
      localStorage.setItem('ekaly_token', res.token);
    }
    localStorage.setItem('ekaly_user', JSON.stringify(res.user));

    return res.user;
  } catch (error) {
    console.error('[Auth PostgreSQL] Erreur de connexion Google:', error);
    throw error;
  }
}

/**
 * Déconnexion complète
 */
export async function signOutUser(): Promise<void> {
  try {
    localStorage.removeItem('ekaly_token');
    localStorage.removeItem('ekaly_user');
    await ekalyApi.auth.logout().catch(() => {});
    await fbSignOut(auth).catch(() => {});
  } catch (e) {
    console.warn('[Auth] Erreur lors de la déconnexion:', e);
  }
}

/**
 * Synchronisation du profil avec la base de données PostgreSQL
 */
export async function syncUserProfile(fbUser: FirebaseUser): Promise<UserAccount> {
  const idToken = await fbUser.getIdToken().catch(() => undefined);
  const res = await ekalyApi.auth.googleLogin({
    uid: fbUser.uid,
    email: fbUser.email || '',
    displayName: fbUser.displayName || '',
    photoUrl: fbUser.photoURL || '',
    credential: idToken,
  });

  if (res.token) {
    localStorage.setItem('ekaly_token', res.token);
  }
  localStorage.setItem('ekaly_user', JSON.stringify(res.user));

  return res.user;
}

/**
 * Abonnement réactif à l'authentification et au profil utilisateur PostgreSQL.
 * Surveille en temps réel les changements de statut (approbation, rôle, session assignée).
 */
export function subscribeToAuthAndProfile(
  onUpdate: (user: FirebaseUser | null, account: UserAccount | null) => void,
  onError: (err: any) => void
) {
  let intervalId: number | null = null;
  let activeUser: FirebaseUser | null = null;
  let lastAccountSignature: string | null = null;

  const notifyIfChanged = (fbUser: FirebaseUser, account: UserAccount) => {
    const sig = `${fbUser.uid}:${account.role}:${account.status}:${account.assignedSessionId || ''}:${account.displayName || ''}:${account.email || ''}`;
    if (sig !== lastAccountSignature) {
      lastAccountSignature = sig;
      localStorage.setItem('ekaly_user', JSON.stringify(account));
      onUpdate(fbUser, account);
    }
  };

  const checkPostgresProfile = async (fbUser: FirebaseUser) => {
    try {
      const account = await ekalyApi.auth.me(fbUser.uid, fbUser.email || undefined);
      if (account) {
        notifyIfChanged(fbUser, account);
      }
    } catch (e) {
      // Si la session n'est pas encore créée dans PostgreSQL, on la crée
      try {
        const created = await syncUserProfile(fbUser);
        notifyIfChanged(fbUser, created);
      } catch (syncErr) {
        // Fallback administrateur bootstrappé si réseau temporairement inaccessible
        if (fbUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
          notifyIfChanged(fbUser, {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || 'Administrateur Principal',
            role: 'admin',
            status: 'approved',
            requestedAt: new Date().toISOString(),
          });
        } else {
          onError(syncErr);
        }
      }
    }
  };

  const unsubAuth = onAuthStateChanged(
    auth,
    async (fbUser) => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }

      activeUser = fbUser;

      if (!fbUser) {
        lastAccountSignature = null;
        localStorage.removeItem('ekaly_token');
        localStorage.removeItem('ekaly_user');
        onUpdate(null, null);
        return;
      }

      // 1. Mise à jour immédiate
      await checkPostgresProfile(fbUser);

      // 2. Polling régulier de PostgreSQL (toutes les 15 secondes) pour réagir aux approbations d'admin
      intervalId = window.setInterval(() => {
        if (activeUser) {
          checkPostgresProfile(activeUser).catch(() => {});
        }
      }, 15000);
    },
    onError
  );

  return () => {
    unsubAuth();
    if (intervalId !== null) {
      window.clearInterval(intervalId);
    }
  };
}

import React, { useState } from 'react';
import {
  Utensils,
  AlertCircle,
  LogOut,
  Clock,
  Download,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'motion/react';
import { UserAccount } from '../../types';
import { loginWithGoogle, signOutUser } from '../../services/authService';

interface AuthScreenProps {
  currentAccount: UserAccount | null;
  onLoginSuccess: (account: UserAccount) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  currentAccount,
  onLoginSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const account = await loginWithGoogle();
      onLoginSuccess(account);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de se connecter pour le moment. Veuillez réessayer.'
      );
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  // If user is authenticated but awaiting approval or suspended
  if (currentAccount && currentAccount.status !== 'approved') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-between py-8 px-4 sm:px-6">
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <Utensils className="w-4 h-4" />
          </div>
          <span className="text-base font-bold text-gray-900 tracking-tight">e-Kaly</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="bg-white rounded-2xl shadow-xs max-w-md w-full mx-auto p-8 border border-gray-200 text-center"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-100">
            <Clock className="w-6 h-6" />
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-2">
            {currentAccount.status === 'pending'
              ? 'Compte en attente de validation'
              : currentAccount.status === 'suspended'
              ? 'Compte suspendu'
              : 'Accès non autorisé'}
          </h2>

          <p className="text-xs text-gray-600 mb-6 leading-relaxed">
            {currentAccount.status === 'pending' && (
              <>
                Votre demande avec l'adresse <strong className="text-gray-900 font-semibold">{currentAccount.email}</strong> a bien été enregistrée.
                Un administrateur doit approuver votre compte et vous assigner à une session avant que vous ne puissiez accéder à la plateforme.
              </>
            )}
            {currentAccount.status === 'suspended' && (
              <>
                L'accès associé à <strong>{currentAccount.email}</strong> est actuellement suspendu. Veuillez contacter les responsables du voyage d'études de l'ENI.
              </>
            )}
            {currentAccount.status === 'rejected' && (
              <>
                Cette adresse email ne dispose pas des autorisations requises pour ce voyage d'études.
              </>
            )}
          </p>

          <button
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4 text-gray-500" />
            Se déconnecter ou changer de compte
          </button>
        </motion.div>

        <footer className="text-center text-xs text-gray-400">
          e-Kaly • École Nationale d'Informatique (ENI) — Fianarantsoa
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/60 flex flex-col justify-between py-6 sm:py-10 px-4 sm:px-6">
      {/* Discreet Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <Utensils className="w-4 h-4" />
          </div>
          <div>
            <span className="text-base font-bold text-gray-900 tracking-tight leading-none">e-Kaly</span>
            <p className="text-[11px] text-gray-500 font-medium">Voyage d'études M1 ENI</p>
          </div>
        </div>

        <a
          href="/app-release.apk"
          download="e-kaly-release.apk"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg shadow-xs transition-colors"
          title="Télécharger l'APK mobile pour pointeurs"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden sm:inline">App mobile Android</span>
          <span className="sm:hidden">App Android</span>
          <Download className="w-3.5 h-3.5 text-gray-400" />
        </a>
      </header>

      {/* Main Login Card - Sober, Centered & Focused */}
      <main className="max-w-md w-full mx-auto my-auto py-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 sm:p-8"
        >
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3.5 border border-emerald-100">
              <Utensils className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Connexion administration</h1>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              Gestion de la restauration, suivi des distributions et pointages des étudiants de l'ENI
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* Google Sign-In Button */}
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 font-semibold text-xs border border-gray-300 rounded-xl shadow-xs transition-all disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2 text-gray-500">
                <span className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                Connexion en cours...
              </span>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.93 6.72-4.93z"
                  />
                </svg>
                <span>Continuer avec Google</span>
              </>
            )}
          </button>

          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>Accès sécurisé réservé aux encadreurs et administrateurs</span>
          </div>

          {/* Discreet Mobile App Download Box */}
          <div className="mt-5 p-3.5 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-[11px]">Application mobile pointeur</p>
                <p className="text-[10px] text-gray-500">Dernière version APK prête à installer</p>
              </div>
            </div>
            <a
              href="/app-release.apk"
              download="e-kaly-release.apk"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors shrink-0"
            >
              <Download className="w-3 h-3 text-emerald-700" />
              <span>Télécharger</span>
            </a>
          </div>
        </motion.div>
      </main>

      {/* Discreet Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center text-xs text-gray-400">
        <p>e-Kaly • École Nationale d'Informatique (ENI) — Fianarantsoa</p>
      </footer>
    </div>
  );
};

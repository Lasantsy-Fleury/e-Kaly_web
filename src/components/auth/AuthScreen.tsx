import React, { useState } from 'react';
import {
  Utensils,
  QrCode,
  Users,
  Compass,
  AlertCircle,
  LogIn,
  LogOut,
  Clock,
  Sparkles,
  Download,
  Smartphone,
  CheckCircle2,
  ArrowRight,
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

  // If user is authenticated but awaiting approval
  if (currentAccount && currentAccount.status !== 'approved') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 border border-gray-200 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-100">
            <Clock className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {currentAccount.status === 'pending'
              ? 'Bienvenue ! Votre compte est en attente'
              : currentAccount.status === 'suspended'
              ? 'Compte temporairement suspendu'
              : 'Accès non autorisé'}
          </h2>

          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            {currentAccount.status === 'pending' && (
              <>
                Votre demande avec l'adresse <strong>{currentAccount.email}</strong> a bien été reçue.
                Un responsable va rapidement activer votre accès pour vous permettre de participer à la gestion des repas.
              </>
            )}
            {currentAccount.status === 'suspended' && (
              <>
                Votre accès est suspendu momentanément. Rapprochez-vous des encadreurs du voyage d'études de l'ENI pour plus de précisions.
              </>
            )}
            {currentAccount.status === 'rejected' && (
              <>
                Cette adresse email ne figure pas dans la liste des encadreurs autorisés pour ce voyage.
              </>
            )}
          </p>

          <button
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-semibold rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4 text-gray-500" />
            Se déconnecter ou changer de compte
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_800px_at_50%_-10%,#f0fdf4,transparent),linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] flex flex-col">
      {/* Navbar */}
      <header className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-700 to-emerald-600 flex items-center justify-center text-white shadow-[0_10px_40px_-10px_rgba(22,163,74,0.8)]">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">e-Kaly</span>
            <p className="text-[11px] text-gray-500 -mt-0.5">Pointage des distributions ENI</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/app-release.apk"
            download
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/80 backdrop-blur text-sm font-semibold text-gray-800 border border-gray-200 shadow-xs hover:border-green-300 hover:text-green-800 transition-colors"
          >
            <Download className="w-4 h-4" />
            Télécharger l'app mobile
          </a>
          <div className="text-xs text-gray-500 font-medium hidden lg:block">
            École Nationale d'Informatique • Fianarantsoa
          </div>
        </div>
      </header>

      {/* Hero & Login Section */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 lg:py-16 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-800 text-xs font-semibold border border-green-200 mb-6 w-fit">
            <Sparkles className="w-4 h-4 text-green-700" />
            <span>Voyages d'Études • Master 1 ENI</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.05]">
            Gérer la restauration
            <span className="block bg-gradient-to-r from-green-700 via-emerald-600 to-green-700 bg-clip-text text-transparent">
              simplement et efficacement
            </span>
          </h1>

          <p className="text-lg text-gray-600 max-w-xl mt-6 leading-relaxed">
            e-Kaly centralise l'organisation des repas, le suivi des rations et le pointage en temps réel pour un voyage d'études serein et bien organisé.
          </p>

          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/80 backdrop-blur border border-gray-200 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 flex items-center justify-center">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Sessions organisées</p>
                <p className="text-sm text-gray-500 mt-1">Planifiez distributions, repas et effectifs par session</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/80 backdrop-blur border border-gray-200 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Badges & QR Codes</p>
                <p className="text-sm text-gray-500 mt-1">Générez et imprimez les badges officiels en un clic</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/80 backdrop-blur border border-gray-200 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Pointage mobile</p>
                <p className="text-sm text-gray-500 mt-1">Application Android dédiée aux pointeurs sur le terrain</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/80 backdrop-blur border border-gray-200 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Suivi en temps réel</p>
                <p className="text-sm text-gray-500 mt-1">Historique, stats et présence à jour en direct</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/app-release.apk"
              download
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-green-700 to-emerald-600 text-white font-semibold shadow-[0_20px_60px_-20px_rgba(22,163,74,0.9)] hover:shadow-[0_25px_70px_-18px_rgba(22,163,74,0.95)] transition-all"
            >
              <Smartphone className="w-5 h-5" />
              Télécharger l'application mobile
              <ArrowRight className="w-4 h-4" />
            </a>
            <span className="text-sm text-gray-500">APK Android • Prêt à installer</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12, ease: 'easeOut' }}
          className="relative"
        >
          <div className="absolute -inset-6 bg-gradient-to-tr from-green-100/60 via-emerald-50/40 to-transparent blur-3xl" />
          <div className="relative bg-white/90 backdrop-blur rounded-[28px] border border-gray-200 shadow-[0_60px_120px_-80px_rgba(15,118,110,0.9)] overflow-hidden">
            <div className="px-8 pt-8 pb-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-700 to-emerald-600 flex items-center justify-center text-white mx-auto shadow-[0_20px_50px_-20px_rgba(22,163,74,0.9)]">
                <Utensils className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Espace encadrement</h2>
                <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
                  Accédez au tableau de bord web pour gérer les sessions, étudiants, distributions et pointages.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 text-left">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleSignIn}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-gradient-to-r from-green-700 to-emerald-600 hover:from-green-800 hover:to-emerald-700 text-white font-semibold text-sm rounded-2xl shadow-[0_25px_60px_-25px_rgba(22,163,74,0.95)] transition-all disabled:opacity-60"
              >
                {loading ? (
                  <span>Connexion en cours...</span>
                ) : (
                  <>
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M12.24 10.285V13.4h6.887C18.2 16.12 15.64 18 12.24 18c-3.315 0-6-2.685-6-6s2.685-6 6-6c1.65 0 3.01.62 4.04 1.57l2.36-2.36C17.07 3.73 14.82 3 12.24 3 7.27 3 3.24 7.03 3.24 12s4.03 9 9 9c5.2 0 8.66-3.66 8.66-8.86 0-.61-.07-1.22-.19-1.855H12.24z"/>
                    </svg>
                    <span>Se connecter avec Google</span>
                  </>
                )}
              </button>
              <p className="text-xs text-gray-400">Réservé aux encadreurs et responsables autorisés</p>
            </div>
            <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 border-t border-gray-100">
              <div className="p-5 text-center">
                <p className="text-lg font-bold text-gray-900">M1 ENI</p>
                <p className="text-xs text-gray-500 mt-1">Voyages d'études</p>
              </div>
              <div className="p-5 text-center">
                <p className="text-lg font-bold text-gray-900">QR + Badges</p>
                <p className="text-xs text-gray-500 mt-1">Pointage fluide</p>
              </div>
              <div className="p-5 text-center">
                <p className="text-lg font-bold text-gray-900">Temps réel</p>
                <p className="text-xs text-gray-500 mt-1">Suivi instantané</p>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200/80 py-6 text-center text-xs text-gray-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          e-Kaly • École Nationale d'Informatique (ENI) — Fianarantsoa
        </div>
      </footer>
    </div>
  );
};

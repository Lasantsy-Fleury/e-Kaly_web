import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  UserCheck,
  UserX,
  AlertOctagon,
  Clock,
  CheckCircle2,
  Search,
  Filter,
  History,
  Lock,
} from 'lucide-react';
import { AccountStatus, AuditLog, UserAccount, UserRole } from '../../types';
import { EmptyState } from '../common/EmptyState';
import { useConfirm } from '../common/ConfirmModal';
import { updateAccount } from '../../services/accountService';

interface AccountsViewProps {
  accounts: UserAccount[];
  auditLogs: AuditLog[];
  currentAccount: UserAccount | null;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  auditLogs,
  currentAccount,
}) => {
  const { confirm: customConfirm, alert: customAlert } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchSearch =
        !searchTerm ||
        acc.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'all' || acc.status === statusFilter;
      const matchRole = roleFilter === 'all' || acc.role === roleFilter;

      return matchSearch && matchStatus && matchRole;
    });
  }, [accounts, searchTerm, statusFilter, roleFilter]);

  const pendingCount = useMemo(
    () => accounts.filter((a) => a.status === 'pending').length,
    [accounts]
  );

  const handleAction = async (
    target: UserAccount,
    newStatus: AccountStatus,
    newRole?: UserRole
  ) => {
    if (!currentAccount) return;
    const confirmMsg =
      newStatus === 'approved'
        ? `Approuver le compte de ${target.displayName || target.email} et lui attribuer le rôle "${newRole || target.role}" ?`
        : newStatus === 'rejected'
        ? `Refuser la demande d'accès de ${target.displayName || target.email} ?`
        : newStatus === 'suspended'
        ? `Suspendre l'accès de ${target.displayName || target.email} ? L'utilisateur ne pourra plus effectuer aucun pointage.`
        : `Réactiver le compte de ${target.displayName || target.email} ?`;

    const isDestructive = newStatus === 'rejected' || newStatus === 'suspended';
    const actionTitle =
      newStatus === 'approved'
        ? 'Approbation de compte'
        : newStatus === 'rejected'
        ? "Refus d'accès"
        : newStatus === 'suspended'
        ? 'Suspension de compte'
        : 'Réactivation de compte';

    const confirmed = await customConfirm({
      title: actionTitle,
      message: confirmMsg,
      confirmText:
        newStatus === 'approved'
          ? "Approuver l'accès"
          : newStatus === 'rejected'
          ? "Refuser la demande"
          : newStatus === 'suspended'
          ? "Suspendre l'accès"
          : 'Réactiver le compte',
      variant: isDestructive ? 'danger' : newStatus === 'approved' ? 'success' : 'info',
    });

    if (!confirmed) return;

    setUpdatingUid(target.uid);
    try {
      await updateAccount(
        target.uid,
        {
          status: newStatus,
          role: newRole || target.role,
        },
        {
          uid: currentAccount.uid,
          displayName: currentAccount.displayName || 'Administrateur',
          email: currentAccount.email,
        }
      );
      setUpdatingUid(null);
    } catch (err) {
      await customAlert({
        title: 'Erreur de mise à jour',
        message: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
      setUpdatingUid(null);
    }
  };

  const getStatusBadge = (status: AccountStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">
            <CheckCircle2 className="w-3 h-3 text-green-600" />
            Approuvé
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            En attente
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
            <AlertOctagon className="w-3 h-3 text-red-600" />
            Suspendu
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
            <UserX className="w-3 h-3 text-gray-500" />
            Refusé
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">
              Gestion des Comptes & Autorisations des Pointeurs
            </h2>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                {pendingCount} demande(s) en attente
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Validation des demandes d'accès issues de l'application mobile et gestion des rôles
          </p>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom ou adresse email..."
            className="w-full text-xs pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-medium border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">Tous les statuts ({accounts.length})</option>
            <option value="pending">En attente ({pendingCount})</option>
            <option value="approved">Approuvés</option>
            <option value="suspended">Suspendus</option>
            <option value="rejected">Refusés</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs font-medium border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">Tous les rôles</option>
            <option value="pointer">Pointeurs</option>
            <option value="admin">Administrateurs</option>
          </select>
        </div>
      </div>

      {/* Accounts List / Empty state */}
      {accounts.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Aucun utilisateur enregistré"
          description="Les demandes de compte des pointeurs créées depuis l'application mobile e-Kaly apparaîtront ici pour approbation."
        />
      ) : filteredAccounts.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
          <p className="text-sm text-gray-600 font-medium">
            Aucun compte ne correspond à vos filtres.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setRoleFilter('all');
            }}
            className="mt-3 text-xs font-bold text-green-700 underline"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 text-gray-700 font-bold border-b border-gray-200 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Rôle attribué</th>
                  <th className="px-4 py-3">Statut actuel</th>
                  <th className="px-4 py-3">Demande & Mise à jour</th>
                  <th className="px-4 py-3 text-right">Actions d'administration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAccounts.map((acc) => {
                  const isCurrent = acc.uid === currentAccount?.uid;
                  return (
                    <tr
                      key={acc.uid}
                      className={`hover:bg-gray-50/60 transition-colors ${
                        acc.status === 'pending' ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900">{acc.displayName || 'Utilisateur'}</div>
                        <div className="text-gray-500 text-[11px] font-mono">{acc.email}</div>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200 inline-block mt-0.5">
                            Votre compte actif
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`font-semibold px-2 py-0.5 rounded-md text-[11px] ${
                            acc.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {acc.role === 'admin' ? 'Administrateur' : 'Pointeur'}
                        </span>
                      </td>

                      <td className="px-4 py-3">{getStatusBadge(acc.status)}</td>

                      <td className="px-4 py-3">
                        <div className="text-gray-800">
                          {new Date(acc.requestedAt).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        {acc.updatedAt && (
                          <div className="text-[11px] text-gray-400">
                            Màj : {new Date(acc.updatedAt).toLocaleDateString('fr-FR')}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Pending actions */}
                          {acc.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                disabled={updatingUid === acc.uid}
                                onClick={() => handleAction(acc, 'approved', 'pointer')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Approuver Pointeur</span>
                              </button>
                              <button
                                type="button"
                                disabled={updatingUid === acc.uid}
                                onClick={() => handleAction(acc, 'rejected')}
                                className="px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              >
                                Refuser
                              </button>
                            </>
                          )}

                          {/* Approved actions */}
                          {acc.status === 'approved' && !isCurrent && (
                            <button
                              type="button"
                              disabled={updatingUid === acc.uid}
                              onClick={() => handleAction(acc, 'suspended')}
                              className="px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Suspendre
                            </button>
                          )}

                          {/* Suspended actions */}
                          {acc.status === 'suspended' && (
                            <button
                              type="button"
                              disabled={updatingUid === acc.uid}
                              onClick={() => handleAction(acc, 'approved')}
                              className="px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Réactiver
                            </button>
                          )}

                          {/* Rejected actions */}
                          {acc.status === 'rejected' && (
                            <button
                              type="button"
                              disabled={updatingUid === acc.uid}
                              onClick={() => handleAction(acc, 'approved', 'pointer')}
                              className="px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Réexaminer & Approuver
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Logs Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <History className="w-4 h-4 text-green-700" />
          <h3 className="text-sm font-bold text-gray-900">
            Journal d'Audit des Actions Administratives (Immuable)
          </h3>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-gray-500 py-3">Aucune action administrative consignée.</p>
        ) : (
          <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-2 flex items-start justify-between text-xs">
                <div>
                  <span className="font-semibold text-gray-900">{log.action}</span>
                  <p className="text-gray-600 mt-0.5">{log.details}</p>
                  <span className="text-[11px] text-gray-400">
                    Par {log.performedByName} ({log.performedByEmail})
                  </span>
                </div>
                <span className="text-[11px] text-gray-400 font-mono whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString('fr-FR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

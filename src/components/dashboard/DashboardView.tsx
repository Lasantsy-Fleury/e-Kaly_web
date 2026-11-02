import React, { useState, useMemo } from 'react';
import {
  Users,
  CalendarDays,
  Clock,
  CheckCircle2,
  PieChart,
  BarChart3,
  TrendingUp,
  Filter,
  FileSpreadsheet,
  MapPin,
  Utensils,
  AlertCircle,
} from 'lucide-react';
import { Attendance, Distribution, Session, Student, UserAccount } from '../../types';
import { motion } from 'motion/react';
import { EmptyState } from '../common/EmptyState';
import { exportAttendanceToExcel } from '../../services/attendanceService';

interface DashboardViewProps {
  students: Student[];
  distributions: Distribution[];
  attendances: Attendance[];
  sessions: Session[];
  selectedSessionId: string;
  onSelectSessionId: (id: string) => void;
  onNavigateToTab: (tab: any) => void;
  onOpenSessionModal: () => void;
  accounts?: UserAccount[];
  currentAccount?: UserAccount | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  students,
  distributions,
  attendances,
  sessions,
  selectedSessionId,
  onSelectSessionId,
  onNavigateToTab,
  onOpenSessionModal,
  accounts = [],
  currentAccount,
}) => {
  const [selectedDistributionId, setSelectedDistributionId] = useState<string>('all');
  const [selectedPointerId, setSelectedPointerId] = useState<string>('all');

  const isPointerRole = currentAccount?.role === 'pointer';
  const assignedSessionId = isPointerRole ? currentAccount?.assignedSessionId : null;
  const effectiveSessionId = assignedSessionId || selectedSessionId;

  const activeSession = sessions.find((s) => s.id === effectiveSessionId);

  // Available pointer accounts for filtering
  const availablePointers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email?: string }>();
    if (accounts && accounts.length > 0) {
      accounts
        .filter((acc) => acc.role === 'pointer' && acc.status === 'approved')
        .forEach((acc) => {
          map.set(acc.uid, {
            id: acc.uid,
            name: acc.displayName || acc.email,
            email: acc.email,
          });
        });
    }
    // Also include pointers discovered from attendances
    attendances.forEach((a) => {
      if (a.pointeurId && !map.has(a.pointeurId)) {
        map.set(a.pointeurId, {
          id: a.pointeurId,
          name: a.pointeurNom || a.pointeurId,
          email: a.pointeurEmail,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [accounts, attendances]);

  // Filter students by effective session
  const sessionStudents = useMemo(() => {
    if (isPointerRole && !assignedSessionId) return [];
    if (effectiveSessionId === 'all') return students;
    return students.filter((s) => s.sessionId === effectiveSessionId);
  }, [students, effectiveSessionId, isPointerRole, assignedSessionId]);

  // Filter distributions by effective session
  const sessionDistributions = useMemo(() => {
    if (isPointerRole && !assignedSessionId) return [];
    if (effectiveSessionId === 'all') return distributions;
    return distributions.filter((d) => d.sessionId === effectiveSessionId);
  }, [distributions, effectiveSessionId, isPointerRole, assignedSessionId]);

  // Status counts
  const plannedDistCount = useMemo(
    () => sessionDistributions.filter((d) => d.statut === 'planned').length,
    [sessionDistributions]
  );
  const ongoingDistCount = useMemo(
    () => sessionDistributions.filter((d) => d.statut === 'ongoing').length,
    [sessionDistributions]
  );
  const completedDistCount = useMemo(
    () => sessionDistributions.filter((d) => d.statut === 'completed').length,
    [sessionDistributions]
  );

  // Filtered attendances based on session, selected distribution, and selected pointer
  const relevantAttendances = useMemo(() => {
    if (isPointerRole && !assignedSessionId) return [];
    let list = attendances;
    if (effectiveSessionId !== 'all') {
      const distIdsInSession = new Set(sessionDistributions.map((d) => d.id));
      list = list.filter((a) => distIdsInSession.has(a.distributionId) || a.sessionId === effectiveSessionId);
    }
    if (selectedDistributionId !== 'all') {
      list = list.filter((a) => a.distributionId === selectedDistributionId);
    }
    if (selectedPointerId !== 'all') {
      list = list.filter(
        (a) => a.pointeurId === selectedPointerId || a.pointeurNom === selectedPointerId
      );
    }
    return list;
  }, [
    attendances,
    effectiveSessionId,
    selectedDistributionId,
    selectedPointerId,
    sessionDistributions,
    isPointerRole,
    assignedSessionId,
  ]);

  const validPointagesCount = useMemo(
    () => relevantAttendances.filter((a) => a.statut === 'valid').length,
    [relevantAttendances]
  );

  const selectedDistribution = useMemo(
    () => sessionDistributions.find((d) => d.id === selectedDistributionId),
    [sessionDistributions, selectedDistributionId]
  );

  // Participation rate = (unique valid matricules / session student count) * 100%
  const participationRate = useMemo(() => {
    const totalEligible = sessionStudents.length;
    if (totalEligible === 0) return 0;

    const uniqueValidMatricules = new Set(
      relevantAttendances.filter((a) => a.statut === 'valid').map((a) => a.matricule)
    );
    const rate = (uniqueValidMatricules.size / totalEligible) * 100;
    return Math.min(100, Math.round(rate * 10) / 10);
  }, [sessionStudents, relevantAttendances]);

  // Breakdown by meal/product
  const mealBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of relevantAttendances) {
      if (a.statut === 'valid') {
        counts[a.repasProduit] = (counts[a.repasProduit] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [relevantAttendances]);

  // Breakdown by pointer
  const pointerBreakdown = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    for (const a of relevantAttendances) {
      if (a.statut === 'valid') {
        const id = a.pointeurId || 'unassigned';
        if (!counts[id]) {
          counts[id] = { name: a.pointeurNom || 'Pointeur', count: 0 };
        }
        counts[id].count++;
      }
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [relevantAttendances]);

  const anomaliesCount = useMemo(
    () => relevantAttendances.filter((a) => a.statut !== 'valid').length,
    [relevantAttendances]
  );

  if (students.length === 0 && distributions.length === 0 && sessions.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Bienvenue sur la plateforme e-Kaly — M1 ENI"
        description="Créez votre première session de voyage d'études pour la promotion Master 1 de l'École Nationale d'Informatique, puis importez les étudiants."
        actionLabel="Créer une session de voyage"
        onAction={onOpenSessionModal}
        secondaryActionLabel="Importer les étudiants"
        onSecondaryAction={() => onNavigateToTab('students')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Pointer Session Warning or Info Banner */}
      {isPointerRole && !assignedSessionId && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-xs text-red-900 shadow-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <strong className="font-bold">Compte pointeur non assigné :</strong> Votre compte n'est actuellement assigné à aucune session de voyage. Conformément aux règles de sécurité, vous ne pouvez voir que les distributions associées à votre session de voyage assignée. Veuillez contacter votre administrateur.
          </div>
        </div>
      )}

      {isPointerRole && assignedSessionId && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-emerald-950 shadow-xs">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Espace Pointeur restreint à la session : <strong>{currentAccount?.assignedSessionNom || activeSession?.nom || 'Voyage d’études'}</strong>
            </span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
            {sessionDistributions.length} distribution(s) autorisée(s)
          </span>
        </div>
      )}

      {/* Session Banner and Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
            <MapPin className="w-4 h-4 text-emerald-600" />
            Session de voyage :
          </div>

          <select
            value={effectiveSessionId}
            disabled={isPointerRole && !!assignedSessionId}
            onChange={(e) => {
              onSelectSessionId(e.target.value);
              setSelectedDistributionId('all');
            }}
            className="px-3 py-1.5 text-xs font-bold border border-emerald-300 rounded-lg bg-emerald-50/50 text-emerald-950 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-80"
          >
            {!isPointerRole && (
              <option value="all">
                {sessions.length === 0 ? 'Aucune session enregistrée' : 'Toutes les sessions de voyage'}
              </option>
            )}
            {sessions.map((sess) => (
              <option key={sess.id} value={sess.id}>
                {sess.nom} ({sess.destination ? `${sess.destination} • ` : ''}{sess.dateDebut} au {sess.dateFin})
              </option>
            ))}
          </select>

          {/* Distribution Filter */}
          <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
            <label htmlFor="dist-select" className="text-xs font-medium text-gray-700">
              Distribution :
            </label>
            <select
              id="dist-select"
              value={selectedDistributionId}
              onChange={(e) => setSelectedDistributionId(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">
                {sessionDistributions.length === 0 ? 'Aucune distribution' : `Toutes les distributions (${sessionDistributions.length})`}
              </option>
              {sessionDistributions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom} ({d.date} • {d.statut})
                </option>
              ))}
            </select>
          </div>

          {/* Pointer Account Filter */}
          <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
            <label htmlFor="pointer-select" className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-gray-500" />
              Compte pointeur :
            </label>
            <select
              id="pointer-select"
              value={selectedPointerId}
              onChange={(e) => setSelectedPointerId(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">
                {availablePointers.length === 0
                  ? 'Tous les pointeurs'
                  : `Tous les comptes pointeurs (${availablePointers.length})`}
              </option>
              {availablePointers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.email ? `(${p.email})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isPointerRole && (
            <button
              onClick={() => onNavigateToTab('sessions')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors"
            >
              <span>Gérer les sessions</span>
            </button>
          )}
          <button
            onClick={() =>
              exportAttendanceToExcel(
                relevantAttendances,
                `rapport-voyage-etudes-${new Date().toISOString().slice(0, 10)}.xlsx`
              )
            }
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
            Exporter rapport Excel
          </button>
        </div>
      </div>

      {/* Empty Sessions Notice */}
      {!isPointerRole && sessions.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Aucune session de voyage d'études n'est actuellement enregistrée. Créez une première session pour commencer à planifier les distributions de repas et organiser les effectifs étudiants.
            </span>
          </div>
          <button
            onClick={onOpenSessionModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shrink-0 transition-colors"
          >
            Créer une session
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* Total Students in Session */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Effectif
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{sessionStudents.length}</span>
            <span className="text-xs text-gray-500">étudiants inscrits</span>
          </div>
          <div className="mt-3 text-xs text-gray-500 flex items-center justify-between pt-2 border-t border-gray-100">
            <span>Ration par repas :</span>
            <span className="font-semibold text-emerald-800 font-mono">
              = {sessionStudents.length} portions
            </span>
          </div>
        </div>

        {/* Distributions in multi-day voyage */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Distributions du Voyage
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{sessionDistributions.length}</span>
            <span className="text-xs text-gray-500">repas programmés</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
              <Clock className="w-3 h-3" /> {plannedDistCount} planifiée(s)
            </span>
            <span className="inline-flex items-center gap-1 text-green-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {ongoingDistCount} en cours
            </span>
            <span className="text-gray-600 font-medium">
              {completedDistCount} finie(s)
            </span>
          </div>
        </div>

        {/* Valid Pointages / Pointages effectués (filtré par distribution et par compte pointeur) */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Pointages effectués
            </span>
            <div className="w-8 h-8 rounded-lg bg-green-50 text-green-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-green-700">{validPointagesCount}</span>
            <span className="text-xs text-gray-500">repas servis valides</span>
          </div>
          <div className="mt-3 text-xs text-gray-500 flex flex-col gap-1 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between text-[11px]">
              <span className="truncate font-medium text-gray-600">
                {selectedDistributionId !== 'all' ? '1 distribution ciblée' : 'Toutes distributions'}
                {selectedPointerId !== 'all' ? ' • 1 compte pointeur' : ''}
              </span>
              <span className={`font-semibold shrink-0 ${anomaliesCount > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
                {anomaliesCount} rejet(s)
              </span>
            </div>
          </div>
        </div>

        {/* Participation Rate */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Taux de Participation
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-green-700">{participationRate}%</span>
            <span className="text-xs text-gray-500">
              sur {sessionStudents.length} étudiants
            </span>
          </div>
          <div className="mt-3 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-green-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${participationRate}%` }}
            />
          </div>
        </div>
      </motion.div>

      {/* Selected Distribution Banner */}
      {selectedDistribution && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-emerald-950">
                Focus : {selectedDistribution.nom} ({selectedDistribution.typeDistribution})
              </h4>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-200 text-emerald-900">
                {selectedDistribution.date} ({selectedDistribution.heureDebut} - {selectedDistribution.heureFin})
              </span>
            </div>
            <p className="text-xs text-emerald-800 mt-1">
              Repas prévus : <strong>{selectedDistribution.repasProduits.join(', ')}</strong> • Quantité exacte : <strong>{selectedDistribution.quantitePrevue} rations</strong> (égal aux {sessionStudents.length} étudiants de la session)
            </p>
          </div>
          <div className="text-xs font-medium text-emerald-900 font-mono">
            {validPointagesCount} scans valides / {selectedDistribution.quantitePrevue} prévus
          </div>
        </div>
      )}

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Breakdown by Meal / Product */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-green-700" />
              <h4 className="text-sm font-bold text-gray-900">Répartition par repas / boisson</h4>
            </div>
            <span className="text-xs text-gray-500">{mealBreakdown.length} aliment(s)</span>
          </div>

          {mealBreakdown.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">
              Aucun pointage valide pour cette sélection.
            </div>
          ) : (
            <div className="space-y-3">
              {mealBreakdown.map(([meal, count]) => {
                const percent = Math.round((count / (validPointagesCount || 1)) * 100);
                return (
                  <div key={meal} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-gray-700">{meal}</span>
                      <span className="text-gray-900 font-bold">
                        {count} pointage(s) ({percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Breakdown by Pointer */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-green-700" />
              <h4 className="text-sm font-bold text-gray-900">Activité des pointeurs</h4>
            </div>
            <span className="text-xs text-gray-500">{pointerBreakdown.length} pointeur(s)</span>
          </div>

          {pointerBreakdown.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">
              Aucun pointage pour cette sélection.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pointerBreakdown.map((p, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-gray-800">{p.name}</span>
                  </div>
                  <span className="text-xs font-bold text-green-700 px-2.5 py-0.5 rounded-full bg-green-50 border border-green-100">
                    {p.count} pointage(s)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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
  ShieldCheck,
  ShieldAlert,
  Layers,
  Activity,
  Award,
  Percent,
  Check,
  XCircle,
  Sparkles,
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

  // Status counts for distributions
  const plannedDistCount = useMemo(
    () => sessionDistributions.filter((d) => d.statut === 'planned' || d.statut === 'draft').length,
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

  const selectedDistribution = useMemo(
    () => sessionDistributions.find((d) => d.id === selectedDistributionId),
    [sessionDistributions, selectedDistributionId]
  );

  // 1. DATA ANALYST METRICS: Attendance & Service Quantities
  const validAttendances = useMemo(
    () => relevantAttendances.filter((a) => a.statut === 'valid'),
    [relevantAttendances]
  );
  const validPointagesCount = validAttendances.length;

  const duplicateAttemptsCount = useMemo(
    () => relevantAttendances.filter((a) => a.statut === 'already_pointed').length,
    [relevantAttendances]
  );
  const ineligibleAttemptsCount = useMemo(
    () => relevantAttendances.filter((a) => a.statut === 'ineligible').length,
    [relevantAttendances]
  );
  const totalAnomaliesCount = duplicateAttemptsCount + ineligibleAttemptsCount;

  // Rate of successful pointages vs total scan attempts (Integrity score)
  const complianceRate = useMemo(() => {
    const total = relevantAttendances.length;
    if (total === 0) return 100;
    return Math.round((validPointagesCount / total) * 1000) / 10;
  }, [relevantAttendances.length, validPointagesCount]);

  // Unique students who received at least one meal in the current selection
  const uniqueStudentsServed = useMemo(() => {
    return new Set(validAttendances.map((a) => a.matricule));
  }, [validAttendances]);

  // Participation rate = (Unique students served / Total registered students) * 100%
  const studentReachRate = useMemo(() => {
    const total = sessionStudents.length;
    if (total === 0) return 0;
    return Math.min(100, Math.round((uniqueStudentsServed.size / total) * 1000) / 10);
  }, [sessionStudents.length, uniqueStudentsServed.size]);

  // Planned rations vs Actual rations served
  const plannedRationsCount = useMemo(() => {
    if (selectedDistribution) {
      return selectedDistribution.quantitePrevue || sessionStudents.length;
    }
    if (sessionDistributions.length === 0) return 0;
    return sessionDistributions.reduce(
      (acc, d) => acc + (d.quantitePrevue || sessionStudents.length),
      0
    );
  }, [selectedDistribution, sessionDistributions, sessionStudents.length]);

  const serviceCompletionRate = useMemo(() => {
    if (plannedRationsCount === 0) return 0;
    return Math.min(100, Math.round((validPointagesCount / plannedRationsCount) * 1000) / 10);
  }, [plannedRationsCount, validPointagesCount]);

  const unclaimedRationsCount = useMemo(() => {
    return Math.max(0, plannedRationsCount - validPointagesCount);
  }, [plannedRationsCount, validPointagesCount]);

  // 2. DISTRIBUTION PERFORMANCE MATRIX (Per-Meal Delivery & Real Coverage)
  const distributionDeliveryStats = useMemo(() => {
    return sessionDistributions.map((dist) => {
      const distAttendances = attendances.filter(
        (a) => a.distributionId === dist.id && a.statut === 'valid'
      );
      const targetCount = dist.quantitePrevue || sessionStudents.length || 1;
      const servedCount = distAttendances.length;
      const deliveryRate = Math.min(100, Math.round((servedCount / targetCount) * 1000) / 10);
      const remainingCount = Math.max(0, targetCount - servedCount);

      return {
        distribution: dist,
        served: servedCount,
        target: targetCount,
        rate: deliveryRate,
        remaining: remainingCount,
      };
    });
  }, [sessionDistributions, attendances, sessionStudents.length]);

  // 3. PARCOURS / FILIÈRE BREAKDOWN (Academic track participation)
  const parcoursStats = useMemo(() => {
    const byParcours: Record<string, { total: number; served: number }> = {};

    // Group students by parcours
    sessionStudents.forEach((s) => {
      const p = (s.parcours || s.niveau || 'Général').trim().toUpperCase();
      if (!byParcours[p]) {
        byParcours[p] = { total: 0, served: 0 };
      }
      byParcours[p].total++;
    });

    // Mark served
    uniqueStudentsServed.forEach((matricule) => {
      const st = sessionStudents.find((s) => s.matricule === matricule);
      if (st) {
        const p = (st.parcours || st.niveau || 'Général').trim().toUpperCase();
        if (byParcours[p]) {
          byParcours[p].served++;
        }
      }
    });

    return Object.entries(byParcours)
      .map(([parcours, data]) => ({
        parcours,
        total: data.total,
        served: data.served,
        rate: data.total > 0 ? Math.round((data.served / data.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [sessionStudents, uniqueStudentsServed]);

  // 4. POINTER TEAM ACTIVITY BREAKDOWN
  const pointerActivityStats = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    for (const a of validAttendances) {
      const id = a.pointeurId || 'unassigned';
      if (!counts[id]) {
        counts[id] = { name: a.pointeurNom || 'Pointeur', count: 0 };
      }
      counts[id].count++;
    }
    const list = Object.values(counts).sort((a, b) => b.count - a.count);
    return list.map((item) => ({
      ...item,
      share: validPointagesCount > 0 ? Math.round((item.count / validPointagesCount) * 100) : 0,
    }));
  }, [validAttendances, validPointagesCount]);

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

      {/* Global Filter & Analytical Control Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Session Selector */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
            <MapPin className="w-4 h-4 text-emerald-600" />
            Session :
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

          {/* Distribution Selector */}
          <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
            <label htmlFor="dist-select" className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
              Distribution :
            </label>
            <select
              id="dist-select"
              value={selectedDistributionId}
              onChange={(e) => setSelectedDistributionId(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">
                {sessionDistributions.length === 0 ? 'Aucune distribution' : `Vue globale (${sessionDistributions.length} repas)`}
              </option>
              {sessionDistributions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom} ({d.date} • {d.statut})
                </option>
              ))}
            </select>
          </div>

          {/* Pointer Account Selector */}
          <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
            <label htmlFor="pointer-select" className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-gray-500" />
              Agent pointeur :
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
                  : `Toute l'équipe (${availablePointers.length} pointeurs)`}
              </option>
              {availablePointers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.email ? `(${p.email})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
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
                `rapport-statistiques-repas-${new Date().toISOString().slice(0, 10)}.xlsx`
              )
            }
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors shadow-2xs"
            title="Télécharger l'analyse statistique complète sous Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Exporter rapport Excel
          </button>
        </div>
      </div>

      {/* Selected Distribution Detail Banner if Focused */}
      {selectedDistribution && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-gray-900">{selectedDistribution.nom}</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-200 text-emerald-900">
                  {selectedDistribution.typeDistribution}
                </span>
                <span className="text-xs text-emerald-800 font-medium">
                  {selectedDistribution.date} • {selectedDistribution.heureDebut} à {selectedDistribution.heureFin}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Contenu servi : <strong className="text-gray-900">{selectedDistribution.repasProduits.join(', ')}</strong> •
                Objectif de distribution : <strong className="text-gray-900">{selectedDistribution.quantitePrevue} portions</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-emerald-200 pt-3 md:pt-0 md:pl-4">
            <div className="text-right">
              <p className="text-[11px] font-semibold text-gray-500 uppercase">Taux de couverture</p>
              <p className="text-lg font-bold text-emerald-700">
                {serviceCompletionRate}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold text-gray-500 uppercase">Rations restantes</p>
              <p className="text-lg font-bold text-gray-900 font-mono">
                {unclaimedRationsCount}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* EXECUTIVE KPI SUMMARY CARDS */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* KPI 1: Effectif & Couverture Étudiante */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Couverture Étudiants
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{uniqueStudentsServed.size}</span>
            <span className="text-xs text-gray-500">/ {sessionStudents.length} inscrits</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
            <span>Taux de présence :</span>
            <span className="font-bold text-emerald-700 font-mono">{studentReachRate}%</span>
          </div>
        </div>

        {/* KPI 2: Repas Distribués (Volume Réel) */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Rations Distribuées
            </span>
            <div className="w-8 h-8 rounded-lg bg-green-50 text-green-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-green-700">{validPointagesCount}</span>
            <span className="text-xs text-gray-500">scans valides</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
            <span>Sur total prévu :</span>
            <span className="font-bold text-gray-900 font-mono">{plannedRationsCount} portions</span>
          </div>
        </div>

        {/* KPI 3: Taux d'Émargement Logistique */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Taux de Service
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-700">{serviceCompletionRate}%</span>
            <span className="text-xs text-gray-500">délivrance</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
            <span>Reste à servir :</span>
            <span className={`font-bold font-mono ${unclaimedRationsCount > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
              {unclaimedRationsCount} portion(s)
            </span>
          </div>
        </div>

        {/* KPI 4: Sécurité & Contrôle d'Accès */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Conformité Accès
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{complianceRate}%</span>
            <span className="text-xs text-gray-500">scans conformes</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
            <span>Doublons bloqués :</span>
            <span className={`font-bold font-mono ${duplicateAttemptsCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {duplicateAttemptsCount} évité(s)
            </span>
          </div>
        </div>
      </motion.div>

      {/* DETAILED STATISTICAL MODULES (2x2 Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module 1: Suivi Réel par Créneau de Repas (Replaces the broken 100% breakdown) */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-700" />
                <h4 className="text-sm font-bold text-gray-900">
                  Progression par distribution alimentaire
                </h4>
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {distributionDeliveryStats.length} créneau(x)
              </span>
            </div>

            {distributionDeliveryStats.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500">
                Aucune distribution planifiée pour cette session.
              </div>
            ) : (
              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                {distributionDeliveryStats.map(({ distribution: dist, served, target, rate, remaining }) => {
                  const isCurrent = selectedDistributionId === dist.id;
                  return (
                    <div
                      key={dist.id}
                      onClick={() => setSelectedDistributionId(isCurrent ? 'all' : dist.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-2xs'
                          : 'border-gray-100 hover:border-gray-200 bg-gray-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{dist.nom}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-700">
                            {dist.typeDistribution}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-emerald-800">
                          {served} / {target} ({rate}%)
                        </span>
                      </div>

                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-1.5">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            rate >= 90
                              ? 'bg-emerald-600'
                              : rate >= 50
                              ? 'bg-blue-600'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span>
                          {dist.date} • {dist.heureDebut} à {dist.heureFin}
                        </span>
                        <span>
                          {remaining === 0 ? 'Complet' : `${remaining} ration(s) restante(s)`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400 flex items-center justify-between">
            <span>Cliquez sur un créneau pour filtrer l'ensemble du tableau de bord.</span>
            {selectedDistributionId !== 'all' && (
              <button
                onClick={() => setSelectedDistributionId('all')}
                className="text-emerald-700 font-semibold hover:underline"
              >
                Réinitialiser le filtre
              </button>
            )}
          </div>
        </div>

        {/* Module 2: Présence par Parcours / Filière ENI (ASR, GB, IG...) */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-700" />
                <h4 className="text-sm font-bold text-gray-900">
                  Participation par filière (Parcours M1)
                </h4>
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {parcoursStats.length} filière(s)
              </span>
            </div>

            {parcoursStats.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500">
                Aucun étudiant enregistré pour cette session.
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
                {parcoursStats.map((item) => (
                  <div key={item.parcours} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-800">
                        {item.parcours}
                      </span>
                      <span className="font-mono text-gray-900">
                        <strong className="text-emerald-700 font-bold">{item.served}</strong> / {item.total} étudiants ({item.rate}%)
                      </span>
                    </div>

                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${item.rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Permet de vérifier qu'aucune promotion n'est oubliée lors des déplacements.</span>
          </div>
        </div>

        {/* Module 3: Répartition de la Charge Opérationnelle (Pointeurs) */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-700" />
                <h4 className="text-sm font-bold text-gray-900">
                  Activité et répartition des pointeurs
                </h4>
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {pointerActivityStats.length} agent(s) actif(s)
              </span>
            </div>

            {pointerActivityStats.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500">
                Aucun émargement enregistré pour cette sélection.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pointerActivityStats.map((item, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-gray-900 leading-tight">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {item.share}% de la charge globale
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-bold font-mono text-emerald-800 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100">
                      {item.count} scan(s)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
            Traçabilité nominale synchronisée en direct depuis les terminaux Android.
          </div>
        </div>

        {/* Module 4: Audit de Sécurité & Filtrage d'Accès */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <h4 className="text-sm font-bold text-gray-900">
                  Contrôle d'accès et prévention de fraude
                </h4>
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {relevantAttendances.length} vérification(s)
              </span>
            </div>

            <div className="space-y-3">
              {/* Stat 1: Scans valides */}
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Émargements valides autorisés</p>
                    <p className="text-[10px] text-gray-500">Badge QR Code conforme et étudiant éligible</p>
                  </div>
                </div>
                <span className="text-xs font-bold font-mono text-emerald-800">
                  {validPointagesCount}
                </span>
              </div>

              {/* Stat 2: Doublons évités */}
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Tentatives de doublon bloquées</p>
                    <p className="text-[10px] text-gray-500">Étudiant s'étant déjà présenté sur ce créneau</p>
                  </div>
                </div>
                <span className="text-xs font-bold font-mono text-amber-800">
                  {duplicateAttemptsCount}
                </span>
              </div>

              {/* Stat 3: Non-éligibles ou Inconnus */}
              <div className="p-3 rounded-xl bg-red-50/60 border border-red-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Rejets de conformité</p>
                    <p className="text-[10px] text-gray-500">Badge suspendu, hors session ou QR non répertorié</p>
                  </div>
                </div>
                <span className="text-xs font-bold font-mono text-red-800">
                  {ineligibleAttemptsCount}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500 flex items-center justify-between">
            <span>Règle d'unicité : 1 seule ration autorisée par étudiant et par distribution.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

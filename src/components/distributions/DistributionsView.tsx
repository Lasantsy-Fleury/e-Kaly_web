import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  StopCircle,
  Edit2,
  Trash2,
  Utensils,
  Users,
  MapPin,
  Sparkles,
  Calendar,
  Layers,
} from 'lucide-react';
import { Attendance, Distribution, DistributionStatus, Session, Student } from '../../types';
import { motion } from 'motion/react';
import { EmptyState } from '../common/EmptyState';
import { useConfirm } from '../common/ConfirmModal';
import { DistributionFormModal } from './DistributionFormModal';
import {
  changeDistributionStatus,
  deleteDistribution,
  createFullDayDistributions,
  getEffectiveStatus,
  isDistributionOpen,
} from '../../services/distributionService';

interface DistributionsViewProps {
  distributions: Distribution[];
  students: Student[];
  attendances: Attendance[];
  sessions: Session[];
  selectedSessionId: string;
  onSelectSessionId: (id: string) => void;
  onOpenSessionModal: () => void;
}

export const DistributionsView: React.FC<DistributionsViewProps> = ({
  distributions,
  students,
  attendances,
  sessions,
  selectedSessionId,
  onSelectSessionId,
  onOpenSessionModal,
}) => {
  const { confirm: customConfirm, alert: customAlert } = useConfirm();
  const [editingDistribution, setEditingDistribution] = useState<
    Distribution | null | undefined
  >(undefined);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [generatingFullDay, setGeneratingFullDay] = useState(false);
  const [generateDayDate, setGenerateDayDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const activeSession = sessions.find((s) => s.id === selectedSessionId);

  // Filter distributions by selected session
  const sessionDistributions = useMemo(() => {
    if (selectedSessionId === 'all') return distributions;
    return distributions.filter((d) => d.sessionId === selectedSessionId);
  }, [distributions, selectedSessionId]);

  // Distinct dates in session distributions
  const distinctDates = useMemo(() => {
    const set = new Set<string>();
    sessionDistributions.forEach((d) => set.add(d.date));
    return Array.from(set).sort();
  }, [sessionDistributions]);

  // Map attendance counts per distribution
  const attendanceCountsMap = useMemo(() => {
    const map = new Map<string, { valid: number; total: number }>();
    for (const a of attendances) {
      const cur = map.get(a.distributionId) || { valid: 0, total: 0 };
      cur.total++;
      if (a.statut === 'valid') cur.valid++;
      map.set(a.distributionId, cur);
    }
    return map;
  }, [attendances]);

  const filteredDistributions = useMemo(() => {
    return sessionDistributions.filter((d) => {
      const matchStatus = statusFilter === 'all' || d.statut === statusFilter;
      const matchDate = dateFilter === 'all' || d.date === dateFilter;
      return matchStatus && matchDate;
    });
  }, [sessionDistributions, statusFilter, dateFilter]);

  // Day-grouped view: the day is the parent section, distributions are nested.
  const groupedByDate = useMemo(() => {
    const map = new Map<string, Distribution[]>();
    for (const distribution of filteredDistributions) {
      const list = map.get(distribution.date) || [];
      list.push(distribution);
      map.set(distribution.date, list);
    }

    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => {
        const ordered = [...items].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
        const validCount = ordered.reduce(
          (sum, d) => sum + (attendanceCountsMap.get(d.id)?.valid || 0),
          0
        );
        const expectedCount = ordered.reduce((sum, d) => sum + (d.quantitePrevue || 0), 0);
        const mealTypes = Array.from(new Set(ordered.map((d) => d.typeDistribution)));
        return { date, items: ordered, validCount, expectedCount, mealTypes };
      });
  }, [filteredDistributions, attendanceCountsMap]);

  const formatDayLabel = (date: string) => {
    const parsed = new Date(`${date}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const handleStatusChange = async (dist: Distribution, newStatus: DistributionStatus) => {
    if (newStatus === 'ongoing' && !isDistributionOpen({ ...dist, statut: 'ongoing' })) {
      await customAlert({
        title: 'Créneau non débuté',
        message: `Cette distribution est programmée pour ${dist.heureDebut} – ${dist.heureFin} le ${new Date(
          `${dist.date}T12:00:00`
        ).toLocaleDateString('fr-FR')}. Elle s'ouvrira automatiquement dès l'arrivée de l'heure du créneau.`,
        variant: 'warning',
      });
      return;
    }

    try {
      await changeDistributionStatus(dist.id, newStatus);
    } catch (err) {
      await customAlert({
        title: 'Erreur',
        message: 'Erreur lors du changement de statut de la distribution.',
        variant: 'error',
      });
    }
  };

  const handleDelete = async (dist: Distribution) => {
    const counts = attendanceCountsMap.get(dist.id);
    let confirmMsg = `Êtes-vous certain de vouloir supprimer la distribution "${dist.nom}" ?`;
    let subtitle = undefined;

    if (counts && counts.total > 0) {
      confirmMsg = `Cette distribution contient ${counts.total} pointage(s) enregistrés. Supprimer la planification ? Les pointages resteront dans l'historique.`;
      subtitle = 'Pointages existants associés';
    }

    const confirmed = await customConfirm({
      title: 'Supprimer la distribution ?',
      subtitle,
      message: confirmMsg,
      confirmText: 'Supprimer définitivement',
      cancelText: 'Annuler',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await deleteDistribution(dist.id);
    } catch (err) {
      await customAlert({
        title: 'Erreur de suppression',
        message: 'Erreur lors de la suppression de la distribution.',
        variant: 'error',
      });
    }
  };

  // 1-Click Generate Full Day Meals (Petit-déjeuner, Eau, Déjeuner, Dîner)
  const handleGenerateFullDay = async () => {
    if (!activeSession) {
      await customAlert({
        title: 'Session requise',
        message: 'Veuillez sélectionner une session de voyage.',
        variant: 'warning',
      });
      return;
    }

    const sessionStudentsCount = students.filter((s) => s.sessionId === activeSession.id).length;
    if (sessionStudentsCount === 0) {
      const proceed = await customConfirm({
        title: 'Aucun étudiant rattaché',
        message: `Aucun étudiant n'est encore inscrit dans la session "${activeSession.nom}".\n\nVoulez-vous tout de même générer les 4 distributions de repas (quantité: 0) ?`,
        confirmText: 'Générer quand même',
        cancelText: 'Annuler',
        variant: 'warning',
      });
      if (!proceed) return;
    }

    setGeneratingFullDay(true);
    try {
      await createFullDayDistributions(
        activeSession.id,
        activeSession.nom,
        generateDayDate,
        sessionStudentsCount
      );
      setGeneratingFullDay(false);
      await customAlert({
        title: 'Génération réussie',
        message: `Les 4 distributions de repas pour le ${generateDayDate} ont été programmées avec succès (quantité: ${sessionStudentsCount} repas).`,
        variant: 'success',
      });
    } catch (err) {
      setGeneratingFullDay(false);
      await customAlert({
        title: 'Erreur de génération',
        message: 'Erreur lors de la génération automatique des repas de la journée.',
        variant: 'error',
      });
    }
  };

  const getStatusBadge = (status: DistributionStatus) => {
    switch (status) {
      case 'ongoing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            En cours
          </span>
        );
      case 'planned':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" />
            Planifiée
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <CheckCircle2 className="w-3 h-3" />
            Terminée
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            <AlertCircle className="w-3 h-3" />
            Annulée
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
            Brouillon
          </span>
        );
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Petit-déjeuner':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Eau':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Déjeuner':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Dîner':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Empty Sessions Alert Banner */}
      {sessions.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-amber-900 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Aucune session de voyage d'études configurée. Créez d'abord une session pour planifier des distributions.</span>
          </div>
          <button
            type="button"
            onClick={onOpenSessionModal}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shrink-0 transition-colors"
          >
            Créer une session
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">
              Planification des Distributions par Session
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Chaque session comprend plusieurs jours avec plusieurs distributions par jour (Petit-déjeuner, Eau, Déjeuner, Dîner).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenSessionModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>Gérer les sessions</span>
          </button>

          <button
            type="button"
            onClick={() => setEditingDistribution(null)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle distribution</span>
          </button>
        </div>
      </div>

      {/* Session Filter & Quick Generation Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              Session :
            </span>
            <select
              value={selectedSessionId}
              onChange={(e) => onSelectSessionId(e.target.value)}
              className="text-xs font-bold border border-emerald-300 rounded-lg px-2.5 py-1.5 bg-emerald-50/50 text-emerald-950 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">Toutes les sessions</option>
              {sessions.map((sess) => (
                <option key={sess.id} value={sess.id}>
                  {sess.nom} ({sess.dateDebut} au {sess.dateFin})
                </option>
              ))}
            </select>
          </div>

          {distinctDates.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Journée :</span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="text-xs font-medium border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800"
              >
                <option value="all">Tous les jours ({distinctDates.length} jours)</option>
                {distinctDates.map((d) => (
                  <option key={d} value={d}>
                    {new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 1-Click Fast Meal Plan Generator for a Voyage Day */}
        {activeSession && (
          <div className="flex items-center gap-2 bg-emerald-50/80 p-1.5 pl-3 rounded-lg border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-900 hidden sm:inline">
              Générer les 4 repas du jour :
            </span>
            <input
              type="date"
              value={generateDayDate}
              min={activeSession.dateDebut}
              max={activeSession.dateFin}
              onChange={(e) => setGenerateDayDate(e.target.value)}
              className="text-xs font-semibold px-2 py-1 bg-white border border-emerald-300 rounded text-gray-800"
            />
            <button
              type="button"
              disabled={generatingFullDay}
              onClick={handleGenerateFullDay}
              className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded shadow-xs transition-colors disabled:opacity-50"
            >
              <span>Générer (Petit-déj, Eau, Déj, Dîner)</span>
            </button>
          </div>
        )}
      </div>

      {/* Distributions List / Empty state */}
      {distributions.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Aucune distribution programmée"
          description="Créez une session de voyage d'études pour les étudiants de l' ENI et planifiez les distributions de repas pour chaque journée du voyage."
          actionLabel="Créer ma première distribution"
          onAction={() => setEditingDistribution(null)}
          secondaryActionLabel="Créer une session de voyage"
          onSecondaryAction={onOpenSessionModal}
        />
      ) : filteredDistributions.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
          <p className="text-sm text-gray-600 font-medium">
            Aucune distribution avec les filtres sélectionnés.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setDateFilter('all');
            }}
            className="mt-3 text-xs font-bold text-green-700 underline"
          >
            Afficher toutes les distributions de la session
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByDate.map((group) => {
            const isToday = group.date === todayIso;
            return (
              <section
                key={group.date}
                className={`bg-white rounded-xl border shadow-xs overflow-hidden ${
                  isToday ? 'border-green-300' : 'border-gray-200'
                }`}
              >
                {/* Day header — parent element of the day's distributions */}
                <header
                  className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${
                    isToday ? 'bg-green-50/70 border-green-200' : 'bg-gray-50/70 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isToday
                          ? 'bg-green-600 text-white'
                          : 'bg-white text-emerald-700 border border-gray-200'
                      }`}
                    >
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-900 capitalize truncate">
                          {formatDayLabel(group.date)}
                        </h3>
                        {isToday && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-600 text-white uppercase tracking-wide">
                            Aujourd'hui
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 font-medium">
                        {group.items.length} distribution(s) • {group.validCount} /{' '}
                        {group.expectedCount} pointages validés
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {group.mealTypes.map((type) => (
                      <span
                        key={type}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getTypeColor(
                          type
                        )}`}
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </header>

                {/* Distributions nested under their day */}
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {group.items.map((dist) => {
                    const counts = attendanceCountsMap.get(dist.id) || { valid: 0, total: 0 };
                    const effectiveStatus = getEffectiveStatus(dist);
                    return (
                      <motion.div
                        key={dist.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`bg-white rounded-lg border p-3.5 shadow-xs flex flex-col justify-between transition-all ${
                          effectiveStatus === 'ongoing'
                            ? 'border-green-400 ring-2 ring-green-100'
                            : 'border-gray-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${getTypeColor(
                                dist.typeDistribution || 'Déjeuner'
                              )}`}
                            >
                              {dist.typeDistribution || 'Repas'}
                            </span>
                            {getStatusBadge(effectiveStatus)}
                          </div>

                          <h3 className="text-sm font-bold text-gray-900 leading-snug mb-1">
                            {dist.nom}
                          </h3>

                          <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mb-2">
                            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="font-mono text-gray-700">
                              {dist.heureDebut} – {dist.heureFin}
                            </span>
                            {selectedSessionId === 'all' && dist.sessionNom && (
                              <>
                                <span>•</span>
                                <span className="truncate">{dist.sessionNom}</span>
                              </>
                            )}
                          </div>

                          {dist.description && (
                            <p className="text-[11px] text-gray-600 mb-2 bg-gray-50 p-2 rounded-lg line-clamp-2">
                              {dist.description}
                            </p>
                          )}

                          {/* Products */}
                          <div className="flex flex-wrap items-center gap-1 my-2">
                            {dist.repasProduits.map((item) => (
                              <span
                                key={item}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700"
                              >
                                {item}
                              </span>
                            ))}
                          </div>

                          {/* Quantity & live validated checkins */}
                          <div className="mt-2 py-1.5 px-2.5 bg-emerald-50/60 rounded-lg border border-emerald-100 flex items-center justify-between text-[11px] font-semibold text-emerald-950">
                            <span>Pointages validés :</span>
                            <span className="font-mono font-bold text-emerald-800">
                              {counts.valid} / {dist.quantitePrevue} prévus
                            </span>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="pt-2.5 mt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {(effectiveStatus === 'planned' || effectiveStatus === 'draft') && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(dist, 'ongoing')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-md border border-green-200 transition-colors"
                              >
                                <PlayCircle className="w-3.5 h-3.5 text-green-600" />
                                <span>Ouvrir</span>
                              </button>
                            )}

                            {effectiveStatus === 'ongoing' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(dist, 'completed')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors"
                              >
                                <StopCircle className="w-3.5 h-3.5 text-blue-600" />
                                <span>Clôturer</span>
                              </button>
                            )}

                            {effectiveStatus !== 'cancelled' && effectiveStatus !== 'completed' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(dist, 'cancelled')}
                                className="px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              >
                                Annuler
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingDistribution(dist)}
                              className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                              title="Modifier"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(dist)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {editingDistribution !== undefined && (
        <DistributionFormModal
          initialDistribution={editingDistribution}
          sessions={sessions}
          students={students}
          defaultSessionId={selectedSessionId !== 'all' ? selectedSessionId : undefined}
          onClose={() => setEditingDistribution(undefined)}
          onSaved={() => setEditingDistribution(undefined)}
        />
      )}
    </div>
  );
};

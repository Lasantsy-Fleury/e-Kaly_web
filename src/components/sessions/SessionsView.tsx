import React, { useState, useMemo } from 'react';
import {
  Compass,
  Plus,
  Search,
  Calendar,
  MapPin,
  Users,
  Utensils,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  CalendarDays,
  Coffee,
  Droplets,
} from 'lucide-react';
import { Session, SessionStatus, Student, Distribution, Attendance } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { updateSession, deleteSession } from '../../services/sessionService';
import { createFullDayDistributions } from '../../services/distributionService';
import { useConfirm } from '../common/ConfirmModal';
import { NavTab } from '../common/Sidebar';

interface SessionsViewProps {
  sessions: Session[];
  students: Student[];
  distributions: Distribution[];
  attendances: Attendance[];
  selectedSessionId: string;
  onSelectSessionId: (id: string) => void;
  onNavigateToTab: (tab: NavTab) => void;
  onOpenSessionModal: () => void;
  onEditSession: (session: Session) => void;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions,
  students,
  distributions,
  attendances,
  selectedSessionId,
  onSelectSessionId,
  onNavigateToTab,
  onOpenSessionModal,
  onEditSession,
}) => {
  const { alert: customAlert } = useConfirm();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SessionStatus>('all');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Day meal generation state
  const [generatingForDay, setGeneratingForDay] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<string | null>(null);

  // Deletion modal state
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Status update feedback
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = sessions.length;
    const ongoing = sessions.filter((s) => s.statut === 'ongoing').length;
    const planned = sessions.filter((s) => s.statut === 'planned').length;
    const completed = sessions.filter((s) => s.statut === 'completed' || s.statut === 'archived').length;
    const totalStudents = students.length;
    const totalDistributions = distributions.length;
    return { total, ongoing, planned, completed, totalStudents, totalDistributions };
  }, [sessions, students, distributions]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchesSearch =
        searchQuery === '' ||
        s.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || s.statut === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [sessions, searchQuery, statusFilter]);

  // Helpers to get students and distributions for a given session
  const getSessionStudentCount = (sessionId: string) => {
    return students.filter((st) => st.sessionId === sessionId).length;
  };

  const getSessionDistributions = (sessionId: string) => {
    return distributions.filter((d) => d.sessionId === sessionId);
  };

  // Helper to compute duration in days
  const getDurationInDays = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return 1;
    const s = new Date(startStr);
    const e = new Date(endStr);
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1;
    return diff > 0 ? diff : 1;
  };

  // Helper to list all dates of a session
  const getSessionDates = (startStr: string, endStr: string) => {
    const dates: string[] = [];
    if (!startStr || !endStr) return dates;
    const current = new Date(startStr);
    const end = new Date(endStr);
    while (current <= end && dates.length < 30) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  // Handle rapid status change
  const handleStatusChange = async (sessionId: string, newStatus: SessionStatus) => {
    setUpdatingStatusId(sessionId);
    try {
      await updateSession(sessionId, { statut: newStatus });
    } catch (err) {
      console.error('Error changing session status:', err);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Handle 1-click meal generation for a specific day in a session
  const handleGenerateDayMeals = async (session: Session, dateStr: string) => {
    const studentCount = getSessionStudentCount(session.id);
    if (studentCount === 0) {
      await customAlert({
        title: 'Attention',
        message: "Aucun étudiant n'est encore inscrit dans cette session. Importez d'abord les étudiants pour que la quantité de repas soit automatiquement calculée.",
        variant: 'warning',
      });
    }

    setGeneratingForDay(dateStr);
    setGenerationSuccess(null);
    try {
      await createFullDayDistributions(session.id, session.nom, dateStr, studentCount);
      setGenerationSuccess(`Les 4 repas pour le ${dateStr} ont été créés avec succès.`);
      setTimeout(() => setGenerationSuccess(null), 4000);
    } catch (err) {
      console.error('Error generating meals:', err);
      await customAlert({
        title: 'Erreur',
        message: 'Erreur lors de la génération des repas.',
        variant: 'error',
      });
    } finally {
      setGeneratingForDay(null);
    }
  };

  // Handle session deletion
  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteSession(sessionToDelete.id);
      if (selectedSessionId === sessionToDelete.id) {
        onSelectSessionId('all');
      }
      setSessionToDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: SessionStatus) => {
    switch (status) {
      case 'ongoing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            En cours
          </span>
        );
      case 'planned':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            Planifiée
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-gray-500" />
            Clôturée
          </span>
        );
      case 'archived':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            Archivée
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
          </div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Compass className="w-6 h-6 text-green-700" />
            Sessions de Voyages d'Études
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gérez chaque voyage d'études multi-jours, les effectifs d'étudiants rattachés et la planification journalière des repas.
          </p>
        </div>

        <button
          onClick={onOpenSessionModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-700 text-white rounded-xl hover:bg-green-800 font-medium text-sm transition-colors shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nouvelle session de voyage
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{metrics.total}</div>
            <div className="text-xs text-gray-500 font-medium">Sessions créées</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              {metrics.ongoing}
              {metrics.ongoing > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>
            <div className="text-xs text-gray-500 font-medium">Session en cours</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{metrics.totalStudents}</div>
            <div className="text-xs text-gray-500 font-medium">Étudiants rattachés</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Utensils className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{metrics.totalDistributions}</div>
            <div className="text-xs text-gray-500 font-medium">Distributions de repas</div>
          </div>
        </div>
      </div>

      {/* Success alert for meal generation */}
      {generationSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{generationSuccess}</span>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par nom, destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-green-600/30 focus:border-green-600 transition-colors"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Toutes ({sessions.length})
          </button>
          <button
            onClick={() => setStatusFilter('ongoing')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              statusFilter === 'ongoing'
                ? 'bg-emerald-700 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            En cours ({metrics.ongoing})
          </button>
          <button
            onClick={() => setStatusFilter('planned')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              statusFilter === 'planned'
                ? 'bg-blue-700 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Planifiées ({metrics.planned})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              statusFilter === 'completed'
                ? 'bg-gray-700 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Clôturées ({metrics.completed})
          </button>
        </div>
      </div>

      {/* Sessions List */}
      {filteredSessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <Compass className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">Aucune session trouvée</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'Aucun voyage ne correspond à votre recherche.'
              : 'Commencez par créer une première session pour le voyage d’études des M1.'}
          </p>
          <button
            onClick={onOpenSessionModal}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-xl hover:bg-green-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Créer une session
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => {
            const studentCount = getSessionStudentCount(session.id);
            const sessionDistributions = getSessionDistributions(session.id);
            const durationDays = getDurationInDays(session.dateDebut, session.dateFin);
            const isSelected = selectedSessionId === session.id;
            const isExpanded = expandedSessionId === session.id;
            const sessionDates = getSessionDates(session.dateDebut, session.dateFin);

            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`bg-white rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-green-600 ring-2 ring-green-600/10 shadow-sm'
                    : 'border-gray-200/90 shadow-2xs hover:border-gray-300'
                }`}
              >
                {/* Main Session Card Header */}
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Title, Destination, Status */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {getStatusBadge(session.statut)}

                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-700 text-white">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Session active de travail
                          </span>
                        ) : (
                          <button
                            onClick={() => onSelectSessionId(session.id)}
                            className="text-xs font-medium text-gray-500 hover:text-green-700 underline decoration-dotted"
                            title="Sélectionner cette session comme filtre global"
                          >
                            Définir comme active
                          </button>
                        )}
                      </div>

                      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        {session.nom}
                      </h2>

                      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-sm text-gray-600">
                        {session.destination && (
                          <span className="inline-flex items-center gap-1.5 font-medium text-gray-800">
                            <MapPin className="w-4 h-4 text-red-500" />
                            {session.destination}
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>
                            Du {new Date(session.dateDebut).toLocaleDateString('fr-FR')} au{' '}
                            {new Date(session.dateFin).toLocaleDateString('fr-FR')}
                          </span>
                          <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md">
                            {durationDays} {durationDays > 1 ? 'jours' : 'jour'}
                          </span>
                        </span>
                      </div>

                      {session.description && (
                        <p className="text-xs text-gray-500 line-clamp-2 max-w-2xl">
                          {session.description}
                        </p>
                      )}
                    </div>

                    {/* Right: Metrics & Quick Actions */}
                    <div className="flex flex-wrap items-center gap-3 lg:self-center">
                      {/* Metric: Students */}
                      <button
                        onClick={() => {
                          onSelectSessionId(session.id);
                          onNavigateToTab('students');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-left transition-colors group"
                        title="Voir la liste des étudiants de ce voyage"
                      >
                        <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-gray-400 group-hover:text-green-700" />
                          Effectif M1
                        </div>
                        <div className="text-base font-bold text-gray-900 group-hover:text-green-700 flex items-center gap-1">
                          {studentCount}
                          <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>

                      {/* Metric: Distributions */}
                      <button
                        onClick={() => {
                          onSelectSessionId(session.id);
                          onNavigateToTab('distributions');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-left transition-colors group"
                        title="Voir les distributions de ce voyage"
                      >
                        <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                          <Utensils className="w-3.5 h-3.5 text-gray-400 group-hover:text-green-700" />
                          Distributions
                        </div>
                        <div className="text-base font-bold text-gray-900 group-hover:text-green-700 flex items-center gap-1">
                          {sessionDistributions.length}
                          <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => onEditSession(session)}
                        className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors"
                        title="Modifier les informations du voyage"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => setSessionToDelete(session)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-gray-200 transition-colors"
                        title="Supprimer cette session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Expand Day Itinerary Toggle */}
                      <button
                        onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                      >
                        <CalendarDays className="w-4 h-4 text-green-700" />
                        <span>{isExpanded ? 'Masquer planning' : 'Planning des repas'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Quick Status State Switcher */}
                  <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Changer le statut :</span>
                      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                        <button
                          disabled={updatingStatusId === session.id || session.statut === 'planned'}
                          onClick={() => handleStatusChange(session.id, 'planned')}
                          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                            session.statut === 'planned'
                              ? 'bg-white text-blue-700 shadow-2xs'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Planifiée
                        </button>
                        <button
                          disabled={updatingStatusId === session.id || session.statut === 'ongoing'}
                          onClick={() => handleStatusChange(session.id, 'ongoing')}
                          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                            session.statut === 'ongoing'
                              ? 'bg-white text-emerald-700 shadow-2xs'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          En cours
                        </button>
                        <button
                          disabled={updatingStatusId === session.id || session.statut === 'completed'}
                          onClick={() => handleStatusChange(session.id, 'completed')}
                          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                            session.statut === 'completed'
                              ? 'bg-white text-gray-800 shadow-2xs'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Clôturée
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">
                        Quantité par repas  :{' '}
                        <strong className="text-gray-700">{studentCount} rations</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Day-by-Day Meal Planning Inspector (Expanded) */}
                {isExpanded && (
                  <div className="bg-gray-50/80 p-5 sm:p-6 border-t border-gray-200 rounded-b-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-green-700" />
                          Planning journalier des repas — {session.nom}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Visualisez et générez les 4 repas standards (Petit-déjeuner, Eau, Déjeuner, Dîner) pour chaque journée du voyage.
                        </p>
                      </div>

                      <div className="text-xs text-gray-500">
                        Effectif garanti pour chaque repas :{' '}
                        <span className="font-bold text-green-700">{studentCount} étudiants</span>
                      </div>
                    </div>

                    {sessionDates.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">Dates non définies</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-2">
                        {sessionDates.map((dateStr, idx) => {
                          const mealsForDay = sessionDistributions.filter((d) => d.date === dateStr);
                          const isGenerating = generatingForDay === dateStr;
                          const hasMeals = mealsForDay.length > 0;

                          return (
                            <div
                              key={dateStr}
                              className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between gap-3"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-gray-900">
                                    Jour {idx + 1} — {new Date(dateStr).toLocaleDateString('fr-FR', {
                                      weekday: 'short',
                                      day: 'numeric',
                                      month: 'short',
                                    })}
                                  </span>
                                  <span className="text-[11px] font-mono text-gray-400">
                                    {dateStr}
                                  </span>
                                </div>

                                {/* Scheduled Meals in this day */}
                                {hasMeals ? (
                                  <div className="space-y-1.5">
                                    {mealsForDay.map((meal) => (
                                      <div
                                        key={meal.id}
                                        className="flex items-center justify-between p-1.5 rounded-lg bg-gray-50 text-xs border border-gray-100"
                                      >
                                        <div className="flex items-center gap-1.5 truncate">
                                          {meal.typeDistribution === 'Petit-déjeuner' && (
                                            <Coffee className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                          )}
                                          {meal.typeDistribution === 'Eau' && (
                                            <Droplets className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                          )}
                                          {meal.typeDistribution === 'Déjeuner' && (
                                            <Utensils className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                          )}
                                          {meal.typeDistribution === 'Dîner' && (
                                            <Utensils className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                          )}
                                          <span className="font-medium text-gray-800 truncate">
                                            {meal.typeDistribution || meal.nom}
                                          </span>
                                        </div>
                                        <span className="text-[11px] font-mono text-gray-500 shrink-0">
                                          {meal.heureDebut}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="py-3 text-center text-xs text-gray-400 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                                    Aucun repas planifié pour ce jour
                                  </div>
                                )}
                              </div>

                              {/* Button to generate meals if not fully configured */}
                              <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                                <span className="text-[11px] text-gray-400">
                                  {mealsForDay.length} repas
                                </span>
                                <button
                                  disabled={isGenerating}
                                  onClick={() => handleGenerateDayMeals(session, dateStr)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 hover:text-white hover:bg-green-700 bg-green-50 border border-green-200 rounded-lg transition-colors"
                                  title="Créer les 4 repas standards (Petit-déjeuner, Eau, Déjeuner, Dîner)"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>{isGenerating ? 'Création...' : '+ 4 repas du jour'}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Session Deletion */}
      <AnimatePresence>
        {sessionToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100"
            >
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <div className="p-3 bg-red-100 rounded-xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Supprimer la session ?</h3>
                  <p className="text-xs text-gray-500">Cette action est irréversible</p>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Êtes-vous certain de vouloir supprimer la session{' '}
                <strong className="text-gray-900">{sessionToDelete.nom}</strong> ?
                {getSessionStudentCount(sessionToDelete.id) > 0 && (
                  <span className="block mt-2 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    ⚠️ Attention : {getSessionStudentCount(sessionToDelete.id)} étudiant(s) sont rattachés à cette session.
                  </span>
                )}
              </p>

              {deleteError && (
                <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-xl text-xs border border-red-200">
                  {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  disabled={isDeleting}
                  onClick={() => setSessionToDelete(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  disabled={isDeleting}
                  onClick={confirmDeleteSession}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Suppression...' : 'Supprimer définitivement'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

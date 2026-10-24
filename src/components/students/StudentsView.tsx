import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Plus,
  Search,
  Filter,
  QrCode,
  Edit2,
  Trash2,
  Archive,
  Users,
  Loader2,
  MapPin,
  GraduationCap,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Session, Student } from '../../types';
import { motion } from 'motion/react';
import { EmptyState } from '../common/EmptyState';
import { Pagination } from '../common/Pagination';
import { useConfirm } from '../common/ConfirmModal';
import { BadgeModal } from './BadgeModal';
import { ImportWizardModal } from './ImportWizardModal';
import { StudentFormModal } from './StudentFormModal';
import {
  deleteStudent,
  exportAllBadgesAsZip,
  repairAndSyncAllDriveQrTokens,
} from '../../services/studentService';
import { downloadStudentTemplate } from '../../services/excelService';

interface StudentsViewProps {
  students: Student[];
  sessions: Session[];
  selectedSessionId: string;
  onSelectSessionId: (id: string) => void;
  onOpenSessionModal: () => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  students,
  sessions,
  selectedSessionId,
  onSelectSessionId,
  onOpenSessionModal,
}) => {
  const { confirm: customConfirm, alert: customAlert } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [parcoursFilter, setParcoursFilter] = useState<string>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Modals state
  const [selectedBadgeStudent, setSelectedBadgeStudent] = useState<Student | null>(null);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null | undefined>(undefined);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);

  // Bulk ZIP export
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null);

  // QR Drive Repair / Decoding state
  const [isRepairingQr, setIsRepairingQr] = useState(false);
  const [repairProgress, setRepairProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  const unencodedDriveStudents = useMemo(() => {
    return students.filter(
      (s) => s.qrCodeUrl && (s.qrCodeToken.startsWith('http://') || s.qrCodeToken.startsWith('https://'))
    );
  }, [students]);

  const handleRepairDriveQrCodes = async () => {
    if (isRepairingQr || unencodedDriveStudents.length === 0) return;
    setIsRepairingQr(true);
    setRepairProgress({ current: 0, total: unencodedDriveStudents.length });

    try {
      const res = await repairAndSyncAllDriveQrTokens(students, (curr, tot) => {
        setRepairProgress({ current: curr, total: tot });
      });
      await customAlert({
        title: 'Synchronisation QR Codes',
        message: `${res.repaired} QR code(s) Google Drive ont été décodés et synchronisés dans Firestore. L'application mobile peut désormais les scanner !`,
        variant: 'info',
      });
    } catch (err) {
      await customAlert({
        title: 'Erreur de synchronisation',
        message: 'Une erreur est survenue lors du décodage des QR codes Google Drive.',
        variant: 'error',
      });
    } finally {
      setIsRepairingQr(false);
    }
  };

  // Distinct parcours for M1 ENI
  const parcoursList = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => s.parcours && set.add(s.parcours));
    return Array.from(set).sort();
  }, [students]);

  // Students in selected session
  const sessionStudents = useMemo(() => {
    if (selectedSessionId === 'all') return students;
    return students.filter((s) => s.sessionId === selectedSessionId);
  }, [students, selectedSessionId]);

  // Filtered students by search & parcours
  const filteredStudents = useMemo(() => {
    return sessionStudents.filter((s) => {
      const matchSearch =
        !searchTerm ||
        s.matricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.prenoms && s.prenoms.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchParcours = parcoursFilter === 'all' || s.parcours === parcoursFilter;

      return matchSearch && matchParcours;
    });
  }, [sessionStudents, searchTerm, parcoursFilter]);

  // Reset to first page when search, filter or session changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, parcoursFilter, selectedSessionId]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedStudents = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredStudents.slice(startIndex, startIndex + pageSize);
  }, [filteredStudents, safeCurrentPage, pageSize]);

  const activeSessionObj = sessions.find((s) => s.id === selectedSessionId);

  const handleExportAllZip = async () => {
    if (sessionStudents.length === 0) return;
    const confirmed = await customConfirm({
      title: 'Exportation des badges',
      message: `Générer et compresser les badges de ${sessionStudents.length} étudiant(s) de cette session au format ZIP ?`,
      confirmText: 'Exporter en ZIP',
      cancelText: 'Annuler',
      variant: 'info',
    });
    if (!confirmed) return;

    setIsExportingZip(true);
    try {
      await exportAllBadgesAsZip(sessionStudents, (current, total) => {
        setZipProgress({ current, total });
      });
      setIsExportingZip(false);
      setZipProgress(null);
    } catch (err) {
      console.error('ZIP generation error:', err);
      await customAlert({
        title: 'Erreur d’exportation',
        message: 'Erreur lors de la génération de l’archive ZIP des badges.',
        variant: 'error',
      });
      setIsExportingZip(false);
      setZipProgress(null);
    }
  };

  const handleDelete = async (student: Student) => {
    const confirmed = await customConfirm({
      title: "Supprimer l'étudiant ?",
      subtitle: `${student.nom.toUpperCase()} ${student.prenoms || ''} (${student.matricule})`,
      message: `Êtes-vous certain de vouloir supprimer définitivement cet étudiant de la promotion M1 ENI ?\n\nCette action ne supprime pas les pointages déjà enregistrés dans l'historique.`,
      confirmText: 'Supprimer définitivement',
      cancelText: 'Annuler',
      variant: 'danger',
    });
    if (!confirmed) return;

    setDeletingStudentId(student.id);
    try {
      await deleteStudent(student.id);
      setDeletingStudentId(null);
    } catch (err) {
      await customAlert({
        title: 'Erreur de suppression',
        message: 'Erreur lors de la suppression de l’étudiant.',
        variant: 'error',
      });
      setDeletingStudentId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Empty Sessions Alert Banner */}
      {sessions.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-amber-900 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Aucune session de voyage d'études configurée. Créez d'abord une session avant d'importer ou ajouter des étudiants.</span>
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

      {/* Unencoded Drive QR Codes Alert Banner */}
      {unencodedDriveStudents.length > 0 && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-950 text-xs shadow-xs">
          <div className="flex items-start gap-2.5">
            <RefreshCw className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-900">
                {unencodedDriveStudents.length} étudiant(s) possèdent un QR Code Drive à synchroniser avec l'application mobile
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Pour que le scanner mobile puisse identifier les étudiants (ex: codes de type <code className="font-mono bg-white px-1 py-0.5 rounded border border-emerald-200">MPT1|...</code>), les images Drive doivent être décodées et enregistrées dans la base.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isRepairingQr}
            onClick={handleRepairDriveQrCodes}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-lg shrink-0 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs"
          >
            {isRepairingQr ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>
              {isRepairingQr
                ? `Décodage... (${repairProgress.current}/${repairProgress.total})`
                : 'Décoder & Synchroniser QR Codes'}
            </span>
          </button>
        </div>
      )}

      {/* Action Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">
              Étudiants par Session de Voyage
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {sessionStudents.length} étudiant(s) inscrit(s) dans cette session • La quantité des distributions s'ajuste à cet effectif
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={downloadStudentTemplate}
            title="Télécharger la maquette Excel d'exemple"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span className="hidden sm:inline">Modèle Excel</span>
          </button>

          <button
            type="button"
            disabled={sessionStudents.length === 0 || isExportingZip}
            onClick={handleExportAllZip}
            title="Exporter tous les badges en archive ZIP"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
          >
            {isExportingZip ? (
              <Loader2 className="w-3.5 h-3.5 text-green-600 animate-spin" />
            ) : (
              <Archive className="w-3.5 h-3.5 text-green-700" />
            )}
            <span>
              {isExportingZip && zipProgress
                ? `Export ZIP (${zipProgress.current}/${zipProgress.total})`
                : 'Exporter badges (ZIP)'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowImportWizard(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Importer étudiants</span>
          </button>

          <button
            type="button"
            onClick={() => setEditingStudent(null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-green-800 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Ajout individuel</span>
          </button>
        </div>
      </div>

      {/* Session Selection & Search Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Session Selector */}
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
                  {sess.nom} ({sess.destination ? `${sess.destination} • ` : ''}{sess.dateDebut})
                </option>
              ))}
            </select>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Matricule, nom, prénom..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Parcours filter (ASR, GB, IG, etc.) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Parcours :</span>
          <select
            value={parcoursFilter}
            onChange={(e) => setParcoursFilter(e.target.value)}
            className="text-xs font-medium border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">Tous les parcours</option>
            {parcoursList.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Session Header Card when filtered by a specific session */}
      {activeSessionObj && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-950">
                Session active : {activeSessionObj.nom}
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                Du {activeSessionObj.dateDebut} au {activeSessionObj.dateFin}
              </span>
            </div>
            <p className="text-xs text-emerald-800 mt-1">
              Destination : <strong>{activeSessionObj.destination || 'Non spécifiée'}</strong> • Effectif : <strong>{sessionStudents.length} étudiants</strong>
            </p>
          </div>
          {/* <div className="text-xs text-emerald-900 font-semibold">
            Chaque repas distribué = {sessionStudents.length} rations
          </div> */}
        </div>
      )}

      {/* Students Data Table / Empty State */}
      {students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun étudiant dans cette session de voyage"
          description="Importez la liste des étudiants en Master 1 ENI participant à ce voyage d'études depuis un fichier Excel (.xlsx, .csv)."
          actionLabel="Importer un fichier Excel"
          onAction={() => setShowImportWizard(true)}
          secondaryActionLabel="Télécharger le modèle Excel"
          onSecondaryAction={downloadStudentTemplate}
        />
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
          <p className="text-sm text-gray-600 font-medium">
            Aucun étudiant ne correspond aux filtres ou à la recherche "{searchTerm}".
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setParcoursFilter('all');
            }}
            className="mt-3 text-xs font-bold text-green-700 underline"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 text-gray-700 font-bold border-b border-gray-200 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Matricule</th>
                  <th className="px-4 py-3">Nom & Prénoms</th>
                  <th className="px-4 py-3">Parcours</th>
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Badge & QR Code</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-green-800 bg-green-50 px-2 py-0.5 rounded-md border border-green-200">
                        {s.matricule}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900">{s.nom.toUpperCase()}</div>
                      <div className="text-gray-500 text-[11px]">{s.prenoms || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {s.parcours || 'Tronc commun'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-800 font-medium">
                        {s.sessionNom || sessions.find((sess) => sess.id === s.sessionId)?.nom || 'Session principale'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{s.email || '—'}</div>
                      <div className="text-gray-500 text-[11px]">{s.telephone || ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedBadgeStudent(s)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-green-800 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5 text-green-600" />
                          <span>Badge</span>
                        </button>
                        {/* {s.hasCustomQrCode || s.qrCodeUrl ? (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                            title="QR Code officiel"
                          >
                            Drive
                          </span>
                        ) : null} */}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingStudent(s)}
                          title="Modifier les informations"
                          className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={deletingStudentId === s.id}
                          onClick={() => handleDelete(s)}
                          title="Supprimer"
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={safeCurrentPage}
            totalItems={filteredStudents.length}
            pageSize={pageSize}
            pageSizeOptions={[10, 15, 25, 50, 100]}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            itemName="étudiant(s)"
          />
        </motion.div>
      )}

      {/* Modals */}
      {selectedBadgeStudent && (
        <BadgeModal
          student={selectedBadgeStudent}
          onClose={() => setSelectedBadgeStudent(null)}
        />
      )}

      {showImportWizard && (
        <ImportWizardModal
          existingStudents={students}
          sessions={sessions}
          defaultSessionId={selectedSessionId !== 'all' ? selectedSessionId : undefined}
          onClose={() => setShowImportWizard(false)}
          onSuccess={() => {
            // Handled via onSnapshot
          }}
        />
      )}

      {editingStudent !== undefined && (
        <StudentFormModal
          initialStudent={editingStudent}
          onClose={() => setEditingStudent(undefined)}
          onSaved={() => setEditingStudent(undefined)}
        />
      )}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import {
  QrCode,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  UserCheck,
  Plus,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { Attendance, AttendanceStatus, Distribution, Student, UserAccount } from '../../types';
import { EmptyState } from '../common/EmptyState';
import { useConfirm } from '../common/ConfirmModal';
import {
  exportAttendanceToCSV,
  exportAttendanceToExcel,
  recordScan,
  correctAttendanceStatus,
} from '../../services/attendanceService';
import {
  describeDistributionWindow,
  getEffectiveStatus,
  getMealIdentity,
  isDistributionOpen,
} from '../../services/distributionService';

interface AttendanceViewProps {
  attendances: Attendance[];
  distributions: Distribution[];
  students: Student[];
  currentAccount: UserAccount | null;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  attendances,
  distributions,
  students,
  currentAccount,
}) => {
  const { alert: customAlert } = useConfirm();
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [distributionFilter, setDistributionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [mealFilter, setMealFilter] = useState('all');
  const [pointerFilter, setPointerFilter] = useState('all');

  // Manual Scan / Check-in Modal
  const [showManualScanModal, setShowManualScanModal] = useState(false);
  const [scanMatricule, setScanMatricule] = useState('');
  const [scanDistributionId, setScanDistributionId] = useState(
    distributions.find((d) => isDistributionOpen(d))?.id || distributions[0]?.id || ''
  );
  const [scanResult, setScanResult] = useState<Attendance | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const scanDistribution = distributions.find((d) => d.id === scanDistributionId);
  const isScanSlotOpen = !!scanDistribution && isDistributionOpen(scanDistribution);

  // Correction Modal
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState<Attendance | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<AttendanceStatus>('cancelled');
  const [correctionMotif, setCorrectionMotif] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);

  // Distinct filters
  const distinctMeals = useMemo(() => {
    const set = new Set<string>();
    attendances.forEach((a) => a.repasProduit && set.add(a.repasProduit));
    return Array.from(set).sort();
  }, [attendances]);

  const distinctPointers = useMemo(() => {
    const set = new Set<string>();
    attendances.forEach((a) => a.pointeurNom && set.add(a.pointeurNom));
    return Array.from(set).sort();
  }, [attendances]);

  // Filtered list
  const filteredAttendances = useMemo(() => {
    return attendances.filter((att) => {
      const matchSearch =
        !searchTerm ||
        att.matricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
        att.studentNomComplet.toLowerCase().includes(searchTerm.toLowerCase()) ||
        att.distributionNom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        att.pointeurNom.toLowerCase().includes(searchTerm.toLowerCase());

      const matchDist = distributionFilter === 'all' || att.distributionId === distributionFilter;
      const matchStatus = statusFilter === 'all' || att.statut === statusFilter;
      const matchMeal = mealFilter === 'all' || att.repasProduit === mealFilter;
      const matchPointer = pointerFilter === 'all' || att.pointeurNom === pointerFilter;

      return matchSearch && matchDist && matchStatus && matchMeal && matchPointer;
    });
  }, [attendances, searchTerm, distributionFilter, statusFilter, mealFilter, pointerFilter]);

  const openManualScanModal = () => {
    setScanResult(null);
    setScanError(null);
    const openDistribution = distributions.find((d) => isDistributionOpen(d));
    setScanDistributionId(openDistribution?.id || distributions[0]?.id || '');
    setShowManualScanModal(true);
  };

  const handleManualScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setScanError(null);
    setScanResult(null);

    const safeMat = scanMatricule.trim();
    if (!safeMat) {
      setScanError('Veuillez entrer un matricule.');
      return;
    }

    const targetStudent = students.find((s) => s.matricule.toLowerCase() === safeMat.toLowerCase());
    if (!targetStudent) {
      setScanError(`Aucun étudiant trouvé avec le matricule "${safeMat}".`);
      return;
    }

    const targetDistribution = distributions.find((d) => d.id === scanDistributionId);
    if (!targetDistribution) {
      setScanError('Veuillez sélectionner une distribution.');
      return;
    }

    if (!isDistributionOpen(targetDistribution)) {
      setScanError(
        `La distribution "${targetDistribution.nom}" n'est pas ouverte (${describeDistributionWindow(
          targetDistribution
        )}). Aucun pointage ne peut être enregistré hors du créneau ouvert.`
      );
      return;
    }

    setIsScanning(true);
    try {
      const existingForDist = attendances.filter((a) => a.distributionId === scanDistributionId);
      const res = await recordScan({
        student: targetStudent,
        distribution: targetDistribution,
        repasProduit: getMealIdentity(targetDistribution),
        pointeurId: currentAccount?.uid || 'admin_web',
        pointeurNom: currentAccount?.displayName || 'Administrateur e-Kaly',
        pointeurEmail: currentAccount?.email,
        existingAttendancesForDistribution: existingForDist,
      });

      setScanResult(res);
      setIsScanning(false);
      setScanMatricule('');
    } catch (err) {
      setIsScanning(false);
      setScanError(err instanceof Error ? err.message : 'Échec du pointage');
    }
  };

  const handleApplyCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordForCorrection) return;
    if (!correctionMotif.trim()) {
      await customAlert({
        title: 'Motif obligatoire',
        message: 'Veuillez préciser le motif de la correction administrative.',
        variant: 'warning',
      });
      return;
    }

    setIsCorrecting(true);
    try {
      await correctAttendanceStatus(
        selectedRecordForCorrection.id,
        correctionStatus,
        correctionMotif.trim()
      );
      setIsCorrecting(false);
      setSelectedRecordForCorrection(null);
      setCorrectionMotif('');
    } catch (err) {
      setIsCorrecting(false);
      await customAlert({
        title: 'Erreur',
        message: 'Erreur lors de la mise à jour du statut.',
        variant: 'error',
      });
    }
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'valid':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">
            <CheckCircle2 className="w-3 h-3 text-green-600" />
            Valide
          </span>
        );
      case 'duplicate_attempt':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Doublon
          </span>
        );
      case 'ineligible':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
            <ShieldAlert className="w-3 h-3 text-orange-600" />
            Non éligible
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
            <XCircle className="w-3 h-3 text-red-600" />
            Annulé
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
          <h2 className="text-lg font-bold text-gray-900">
            Journal et Suivi des Pointages
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {attendances.length} pointage(s) synchronisés depuis les terminaux mobiles et postes de pointage
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={attendances.length === 0}
            onClick={() => exportAttendanceToCSV(filteredAttendances)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            disabled={attendances.length === 0}
            onClick={() => exportAttendanceToExcel(filteredAttendances)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={openManualScanModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Enregistrer un pointage</span>
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par matricule, nom étudiant, pointeur..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Distribution filter */}
            <select
              value={distributionFilter}
              onChange={(e) => setDistributionFilter(e.target.value)}
              className="text-xs font-medium border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">Toutes les distributions</option>
              {distributions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom} ({d.date})
                </option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-medium border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="valid">Valide uniquement</option>
              <option value="duplicate_attempt">Doublons détectés</option>
              <option value="ineligible">Non éligibles</option>
              <option value="cancelled">Annulés</option>
            </select>

            {/* Meal filter */}
            <select
              value={mealFilter}
              onChange={(e) => setMealFilter(e.target.value)}
              className="text-xs font-medium border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">Tous les repas / produits</option>
              {distinctMeals.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {/* Pointer filter */}
            <select
              value={pointerFilter}
              onChange={(e) => setPointerFilter(e.target.value)}
              className="text-xs font-medium border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">Tous les pointeurs</option>
              {distinctPointers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Pointages Table / Empty State */}
      {attendances.length === 0 ? (
        <EmptyState
          icon={QrCode}
          title="Aucun pointage enregistré"
          description="Les pointages apparaîtront ici dès que les pointeurs scanneront les badges étudiants depuis l'application mobile ou que vous en enregistrerez un manuellement."
          actionLabel="Enregistrer un premier pointage"
          onAction={openManualScanModal}
        />
      ) : filteredAttendances.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
          <p className="text-sm text-gray-600 font-medium">
            Aucun pointage ne correspond aux filtres actuels.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setDistributionFilter('all');
              setStatusFilter('all');
              setMealFilter('all');
              setPointerFilter('all');
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
                  <th className="px-4 py-3">Matricule & Étudiant</th>
                  <th className="px-4 py-3">Distribution</th>
                  <th className="px-4 py-3">Repas / Produit</th>
                  <th className="px-4 py-3">Horaires (Scan & Sync)</th>
                  <th className="px-4 py-3">Pointeur</th>
                  <th className="px-4 py-3">Statut & Anomalie</th>
                  <th className="px-4 py-3 text-right">Contrôle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAttendances.map((att) => (
                  <tr key={att.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-green-800 bg-green-50 px-2 py-0.5 rounded-md border border-green-200">
                          {att.matricule}
                        </span>
                        <span className="font-bold text-gray-900">{att.studentNomComplet}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800">{att.distributionNom}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                        {att.repasProduit}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">
                        Scan : {new Date(att.scannedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        Sync : {new Date(att.syncedAt).toLocaleTimeString('fr-FR')} ({new Date(att.syncedAt).toLocaleDateString('fr-FR')})
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      {att.pointeurNom}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        {getStatusBadge(att.statut)}
                        {att.anomalie && (
                          <span className="text-[11px] text-red-600 font-medium">
                            {att.anomalie}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {currentAccount?.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRecordForCorrection(att);
                            setCorrectionStatus(att.statut === 'valid' ? 'cancelled' : 'valid');
                          }}
                          className="text-[11px] font-semibold text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2 py-1 rounded-md transition-colors"
                        >
                          Corriger
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
            <span>Affichage de {filteredAttendances.length} sur {attendances.length} pointage(s)</span>
            <span className="font-medium text-gray-700">Pointages certifiés</span>
          </div>
        </div>
      )}

      {/* Manual Pointage / Scan Modal */}
      {showManualScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-gray-100 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-green-700" />
                <h3 className="text-base font-bold text-gray-900">
                  Enregistrer un pointage manuel
                </h3>
              </div>
              <button
                onClick={() => setShowManualScanModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualScan} className="p-6 space-y-4">
              {scanError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{scanError}</span>
                </div>
              )}

              {scanDistribution && !isScanSlotOpen && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Cette distribution n'est pas ouverte. Le pointage est autorisé uniquement
                    pendant le créneau {describeDistributionWindow(scanDistribution)} et lorsque la
                    distribution est marquée « En cours ».
                  </span>
                </div>
              )}

              {scanResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs ${
                    scanResult.statut === 'valid'
                      ? 'bg-green-50 border-green-200 text-green-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    {scanResult.statut === 'valid' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        Pointage validé avec succès !
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Anomalie enregistrée : {scanResult.statut}
                      </>
                    )}
                  </div>
                  <p>
                    Étudiant : <strong>{scanResult.studentNomComplet}</strong> ({scanResult.matricule})
                  </p>
                  <p>
                    Distribution : {scanResult.distributionNom} • {scanResult.repasProduit}
                  </p>
                  {scanResult.anomalie && (
                    <p className="text-red-700 font-semibold mt-1">
                      Détail : {scanResult.anomalie}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Matricule étudiant <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={scanMatricule}
                  onChange={(e) => setScanMatricule(e.target.value)}
                  placeholder="Ex: 00124 (ou saisie au scanner)"
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Distribution concernée <span className="text-red-500">*</span>
                </label>
                {distributions.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    Aucune distribution créée. Veuillez d'abord programmer une distribution dans l'onglet <strong>Distributions</strong>.
                  </p>
                ) : (
                  <select
                    value={scanDistributionId}
                    onChange={(e) => {
                      setScanDistributionId(e.target.value);
                    }}
                    className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    required
                  >
                    {distributions.map((d) => {
                      const open = isDistributionOpen(d);
                      return (
                        <option key={d.id} value={d.id}>
                          {open ? '● ' : '○ '}
                          {d.nom} ({d.date} • {getEffectiveStatus(d)}){open ? ' — ouverte' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Repas concerné
                </label>
                <div className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800 font-semibold">
                  {scanDistribution ? getMealIdentity(scanDistribution) : '—'}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Identité du repas utilisée pour détecter les doublons Web / Mobile.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowManualScanModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  disabled={
                    isScanning ||
                    distributions.length === 0 ||
                    students.length === 0 ||
                    !isScanSlotOpen
                  }
                  className="px-5 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-xs disabled:opacity-50"
                >
                  {isScanning ? 'Vérification...' : 'Valider le pointage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exceptional Traceable Correction Modal */}
      {selectedRecordForCorrection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-base font-bold text-gray-900">
                Correction administrative de pointage
              </h3>
              <button
                onClick={() => setSelectedRecordForCorrection(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyCorrection} className="p-6 space-y-4">
              <p className="text-xs text-gray-600">
                Étudiant : <strong>{selectedRecordForCorrection.studentNomComplet}</strong> ({selectedRecordForCorrection.matricule})
                <br />
                Pointage du {new Date(selectedRecordForCorrection.scannedAt).toLocaleString('fr-FR')}
              </p>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nouveau statut
                </label>
                <select
                  value={correctionStatus}
                  onChange={(e) => setCorrectionStatus(e.target.value as AttendanceStatus)}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="valid">Valide</option>
                  <option value="cancelled">Annulé</option>
                  <option value="duplicate_attempt">Doublon</option>
                  <option value="ineligible">Non éligible</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Motif obligatoire de la correction (traçabilité) <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={correctionMotif}
                  onChange={(e) => setCorrectionMotif(e.target.value)}
                  placeholder="Précisez la justification administrative de cette modification..."
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedRecordForCorrection(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCorrecting}
                  className="px-4 py-2 text-xs font-bold text-white bg-green-700 hover:bg-green-800 rounded-lg shadow-xs disabled:opacity-50"
                >
                  {isCorrecting ? 'Enregistrement...' : 'Confirmer la correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

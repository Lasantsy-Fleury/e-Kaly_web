import React, { useState } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Download,
  AlertCircle,
  Database,
  FileUp,
  MapPin,
} from 'lucide-react';
import { ColumnMapping, ImportPreviewRow, ImportSummary, Session, Student } from '../../types';
import {
  parseExcelOrCsvFile,
  validateAndMapRows,
  downloadStudentTemplate,
  exportImportErrorsToExcel,
} from '../../services/excelService';
import { batchImportStudents } from '../../services/studentService';

interface ImportWizardModalProps {
  existingStudents: Student[];
  sessions: Session[];
  defaultSessionId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export const ImportWizardModal: React.FC<ImportWizardModalProps> = ({
  existingStudents,
  sessions,
  defaultSessionId,
  onClose,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  // Selected session for import
  const [targetSessionId, setTargetSessionId] = useState<string>(
    defaultSessionId || sessions[0]?.id || ''
  );

  // Parsed data
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    matricule: '',
    nom: '',
    prenoms: '',
    genre: '',
    parcours: '',
    dateNaissance: '',
    lieuNaissance: '',
    situationMatrimoniale: '',
    nationalite: '',
    adresse: '',
    email: '',
    telephone: '',
    photo: '',
    qrCode: '',
  });

  // Validation & preview
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  // Execution
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    updated: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const existingMap = new Map(existingStudents.map((s) => [s.matricule, s]));
  const targetSession = sessions.find((s) => s.id === targetSessionId) || {
    id: targetSessionId || 'default',
    nom: 'Session de voyage',
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setFileError(null);
    if (sessions.length === 0 || !targetSessionId) {
      setFileError("Veuillez d'abord créer une session de voyage dans l'onglet 'Sessions' avant d'importer des étudiants.");
      return;
    }
    const validExts = ['.xlsx', '.xls', '.csv'];
    const hasValidExt = validExts.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setFileError('Format non supporté. Veuillez sélectionner un fichier Excel (.xlsx, .xls) ou CSV.');
      return;
    }

    try {
      setParsing(true);
      setSelectedFile(file);
      const parsed = await parseExcelOrCsvFile(file);
      setHeaders(parsed.headers);
      setRawRows(parsed.rawRows);
      setMapping(parsed.detectedMapping);

      const { previewRows: initialPreview, summary: initialSummary } = validateAndMapRows(
        parsed.rawRows,
        parsed.detectedMapping,
        existingMap,
        { id: targetSession.id, nom: targetSession.nom }
      );
      setPreviewRows(initialPreview);
      setSummary({ ...initialSummary, fileName: file.name });
      setParsing(false);
      setCurrentStep(2);
    } catch (err) {
      setParsing(false);
      setFileError(err instanceof Error ? err.message : 'Erreur lors de la lecture du fichier.');
    }
  };

  const updateMappingField = (field: keyof ColumnMapping, value: string) => {
    const updated = { ...mapping, [field]: value };
    setMapping(updated);
    if (rawRows.length > 0) {
      const { previewRows: newPreview, summary: newSummary } = validateAndMapRows(
        rawRows,
        updated,
        existingMap,
        { id: targetSession.id, nom: targetSession.nom }
      );
      setPreviewRows(newPreview);
      if (selectedFile) {
        setSummary({ ...newSummary, fileName: selectedFile.name });
      }
    }
  };

  const executeImport = async () => {
    if (!summary || previewRows.length === 0) return;
    setIsImporting(true);
    setCurrentStep(6);
    setImportProgress(0);

    const validStudentsToImport = previewRows
      .filter((r) => r.status === 'new' || r.status === 'update')
      .map((r) => r.parsedStudent!)
      .filter(Boolean);

    try {
      const result = await batchImportStudents(
        validStudentsToImport,
        existingMap,
        { id: targetSession.id, nom: targetSession.nom },
        (progress) => setImportProgress(progress)
      );
      setImportResult(result);
      setIsImporting(false);
      onSuccess();
    } catch (err) {
      setIsImporting(false);
      setImportResult({
        inserted: 0,
        updated: 0,
        failed: validStudentsToImport.length,
        errors: [err instanceof Error ? err.message : 'Échec du traitement par lots'],
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full overflow-hidden border border-gray-100 flex flex-col max-h-[92vh]">
        {/* Wizard Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-700" />
              <h3 className="text-base font-bold text-gray-900">
                Importation des Étudiants
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Rattachement par session de voyage d'études
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Tabs */}
        <div className="px-6 py-2.5 bg-gray-50 border-b border-gray-200 overflow-x-auto">
          <div className="flex items-center space-x-2 sm:space-x-3 text-xs font-semibold">
            {[
              { num: 1, title: 'Session & Fichier' },
              { num: 2, title: 'Colonnes' },
              { num: 3, title: 'Aperçu' },
              { num: 4, title: 'Validation' },
              { num: 5, title: 'Confirmation' },
              { num: 6, title: 'Résultat' },
            ].map((s) => (
              <div
                key={s.num}
                className={`flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full ${
                  currentStep === s.num
                    ? 'bg-green-600 text-white'
                    : currentStep > s.num
                    ? 'bg-green-100 text-green-800'
                    : 'text-gray-400 bg-gray-100'
                }`}
              >
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold bg-white/20">
                  {s.num}
                </span>
                <span>{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Étape 1 : Session et Sélection du fichier */}
          {currentStep === 1 && (
            <div className="space-y-5">
              {/* Target Session Selector */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                  <label className="text-xs font-bold text-emerald-950">
                    Session de voyage d'études de destination <span className="text-red-500">*</span>
                  </label>
                </div>
                {sessions.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Aucune session trouvée. Vous devez d'abord créer une session de voyage dans l'onglet <strong>Sessions</strong> avant d'importer des étudiants.</span>
                  </div>
                ) : (
                  <select
                    value={targetSessionId}
                    onChange={(e) => setTargetSessionId(e.target.value)}
                    className="w-full text-xs font-semibold border border-emerald-300 rounded-lg p-2.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nom} ({s.destination ? `${s.destination} • ` : ''}{s.dateDebut} au {s.dateFin})
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[11px] text-emerald-800 mt-1.5">
                  Règle métier : Les étudiants sont importés par session. Le nombre total d'étudiants définira strictement la quantité exacte de chaque repas distribué.
                </p>
              </div>

              {/* File Dropzone */}
              <div
                onDragOver={(e) => {
                  if (sessions.length > 0) e.preventDefault();
                }}
                onDrop={(e) => {
                  if (sessions.length > 0) handleDrop(e);
                  else e.preventDefault();
                }}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center ${
                  sessions.length === 0
                    ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                    : 'border-gray-300 hover:border-green-500 bg-gray-50/50 hover:bg-green-50/30'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
                  sessions.length === 0 ? 'bg-gray-200 text-gray-400' : 'bg-green-100 text-green-700'
                }`}>
                  <FileUp className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-gray-900 mb-1">
                  Déposez la liste des étudiants de la session ici
                </h4>
                <p className="text-xs text-gray-500 max-w-sm mb-4">
                  Formats acceptés : <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong>.
                </p>

                {sessions.length === 0 ? (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 text-xs font-semibold rounded-xl cursor-not-allowed shadow-xs"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Créer d'abord une session</span>
                  </button>
                ) : (
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>Sélectionner le fichier</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {parsing && (
                <div className="flex items-center justify-center gap-2 py-3 text-xs font-medium text-green-700">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyse du fichier en cours...
                </div>
              )}

              {fileError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Erreur :</strong> {fileError}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-gray-900">
                    Modèle de fichier pour le voyage
                  </h5>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Téléchargez le modèle Excel contenant les colonnes attendues.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadStudentTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Télécharger modèle
                </button>
              </div>
            </div>
          )}

          {/* Étape 2 : Analyse & Correspondance des colonnes */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    Étape 2 — Correspondance des colonnes détectées
                  </h4>
                  <p className="text-xs text-gray-500">
                    {rawRows.length} lignes lues. Tous les étudiants sont inscrits en <strong>Master 1 ENI</strong> pour la session <strong>{targetSession.nom}</strong>.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Matricule (Obligatoire) */}
                <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/50">
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    Matricule <span className="text-red-500">* (Identifiant métier principal)</span>
                  </label>
                  <select
                    value={mapping.matricule}
                    onChange={(e) => updateMappingField('matricule', e.target.value)}
                    className="w-full text-xs font-medium border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                  >
                    <option value="">-- Sélectionner la colonne --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nom (Obligatoire) */}
                <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/50">
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    Nom <span className="text-red-500">* (Requis)</span>
                  </label>
                  <select
                    value={mapping.nom}
                    onChange={(e) => updateMappingField('nom', e.target.value)}
                    className="w-full text-xs font-medium border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                  >
                    <option value="">-- Sélectionner la colonne --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Prénoms */}
                <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/50">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Prénoms
                  </label>
                  <select
                    value={mapping.prenoms}
                    onChange={(e) => updateMappingField('prenoms', e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                  >
                    <option value="">-- Non mappé --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Parcours (ASR, GB, IG, etc.) */}
                <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/50">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Parcours (ex: ASR, GB, IG)
                  </label>
                  <select
                    value={mapping.parcours}
                    onChange={(e) => updateMappingField('parcours', e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                  >
                    <option value="">-- Non mappé --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Genre */}
                <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/50">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Genre / Sexe
                  </label>
                  <select
                    value={mapping.genre}
                    onChange={(e) => updateMappingField('genre', e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                  >
                    <option value="">-- Non mappé --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Téléphone */}
                <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/50">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Téléphone
                  </label>
                  <select
                    value={mapping.telephone}
                    onChange={(e) => updateMappingField('telephone', e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                  >
                    <option value="">-- Non mappé --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* QR Code existant si présent */}
                <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/50 md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Lien Google Drive / Image QR Code officiel (conservé fidèlement sur les badges)
                  </label>
                  <p className="text-[11px] text-gray-500 mb-2">
                    Si l'étudiant possède un lien vers son image QR sur Google Drive, elle sera imprimée telle quelle sur son badge. S'il n'en possède pas (champ vide), un nouveau QR Code e-Kaly sera créé automatiquement.
                  </p>
                  <select
                    value={mapping.qrCode}
                    onChange={(e) => updateMappingField('qrCode', e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                  >
                    <option value="">-- Création automatique e-Kaly si aucun lien --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Étape 3 : Aperçu */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    Étape 3 — Prévisualisation des étudiants de la session
                  </h4>
                  <p className="text-xs text-gray-500">
                    Session : <strong>{targetSession.nom}</strong> ({rawRows.length} lignes détectées)
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2.5">N°</th>
                      <th className="px-3 py-2.5">Matricule</th>
                      <th className="px-3 py-2.5">Nom & Prénoms</th>
                      <th className="px-3 py-2.5">Niveau</th>
                      <th className="px-3 py-2.5">Parcours</th>
                      <th className="px-3 py-2.5">QR Code Badge</th>
                      <th className="px-3 py-2.5">Action prévue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {previewRows.slice(0, 5).map((row) => (
                      <tr key={row.rowNumber} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 text-gray-400 font-mono">{row.rowNumber}</td>
                        <td className="px-3 py-2 font-mono font-bold text-green-900">
                          {row.parsedStudent?.matricule || <span className="text-red-500">Absent</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-800">
                          {row.parsedStudent?.nom} {row.parsedStudent?.prenoms}
                        </td>
                        <td className="px-3 py-2 text-gray-600 font-medium">Master 1 ENI</td>
                        <td className="px-3 py-2 text-gray-600">{row.parsedStudent?.parcours || '—'}</td>
                        <td className="px-3 py-2">
                          {row.parsedStudent?.hasCustomQrCode || row.parsedStudent?.qrCodeUrl ? (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                              title={row.parsedStudent?.qrCodeUrl || 'QR Code Drive'}
                            >
                              Drive (officiel)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                              Création auto
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              row.status === 'new'
                                ? 'bg-green-100 text-green-800'
                                : row.status === 'update'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {row.status === 'new' ? 'Nouveau' : row.status === 'update' ? 'Mise à jour' : 'Erreur'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Étape 4 : Validation */}
          {currentStep === 4 && summary && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    Étape 4 — Bilan de validation & Cohérence
                  </h4>
                  <p className="text-xs text-gray-500">
                    Contrôle des matricules et calcul de l'effectif pour la session {targetSession.nom}.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                  <div className="text-xs font-semibold text-green-700">Étudiants Valides</div>
                  <div className="text-2xl font-bold text-green-900 mt-1">
                    {summary.newCount + summary.updateCount}
                  </div>
                  <div className="text-[11px] text-green-700 mt-0.5">
                    Effectif de ration calculé
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                  <div className="text-xs font-semibold text-red-700">Erreurs bloquantes</div>
                  <div className="text-2xl font-bold text-red-900 mt-1">
                    {summary.errorCount}
                  </div>
                  <div className="text-[11px] text-red-700 mt-0.5">
                    Cellules vides ou doublons
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="text-xs font-semibold text-gray-600">Total Lignes</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">
                    {summary.totalDetected}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Lignes dans le fichier source
                  </div>
                </div>
              </div>

              {summary.errors.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      Détail des anomalies détectées ({summary.errors.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => exportImportErrorsToExcel(summary.errors)}
                      className="text-xs font-semibold text-amber-900 underline hover:text-amber-950"
                    >
                      Exporter les erreurs en Excel
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 text-xs text-amber-800">
                    {summary.errors.map((err, i) => (
                      <div key={i} className="py-0.5">
                        • {err.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Étape 5 : Confirmation */}
          {currentStep === 5 && summary && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    Étape 5 — Confirmation de l'importation dans la session
                  </h4>
                  <p className="text-xs text-gray-500">
                    Session cible : <strong>{targetSession.nom}</strong>
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 space-y-3">
                <div className="flex items-center justify-between text-xs py-1 border-b border-gray-200">
                  <span className="font-semibold text-gray-700">Nouveaux étudiants M1 ENI à inscrire :</span>
                  <span className="font-bold text-green-700 font-mono">+{summary.newCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-b border-gray-200">
                  <span className="font-semibold text-gray-700">Étudiants existants à réassigner à la session :</span>
                  <span className="font-bold text-blue-700 font-mono">~{summary.updateCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-b border-gray-200">
                  <span className="font-semibold text-gray-700">Lignes avec erreurs (ignorées) :</span>
                  <span className="font-bold text-red-700 font-mono">{summary.errorCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1 pt-2 font-bold text-gray-900">
                  <span>Effectif total certifié pour les distributions de la session :</span>
                  <span className="font-mono text-green-800 text-sm">
                    {summary.newCount + summary.updateCount} étudiants
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Étape 6 : Résultat & Exécution */}
          {currentStep === 6 && (
            <div className="space-y-6 py-4">
              {isImporting ? (
                <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
                  <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">
                      Importation et décodage des QR Codes Drive...
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Décodage des images Drive et synchronisation Firestore : {importProgress}%
                    </p>
                  </div>
                  <div className="w-full max-w-md bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-green-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              ) : importResult ? (
                <div className="space-y-4">
                  {importResult.inserted + importResult.updated > 0 ? (
                    <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                      <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
                      <div>
                        <h4 className="text-sm font-bold text-green-900">
                          Importation terminée !
                        </h4>
                        <p className="text-xs text-green-700 mt-0.5">
                          {importResult.inserted} nouveau(x) étudiant(s) ajoutés • {importResult.updated} mis à jour
                          {importResult.failed > 0 ? ` • ${importResult.failed} ligne(s) en échec` : ''}.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
                      <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
                      <div>
                        <h4 className="text-sm font-bold text-red-900">
                          Aucun étudiant n'a pu être importé
                        </h4>
                        <p className="text-xs text-red-700 mt-0.5">
                          {importResult.failed} ligne(s) en échec. Consultez le détail ci-dessous puis corrigez le fichier
                          ou la session avant de relancer l'importation.
                        </p>
                      </div>
                    </div>
                  )}

                  {importResult.failed > 0 && importResult.errors.length > 0 && (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-700" />
                        Détail des erreurs d'importation ({importResult.errors.length})
                      </span>
                      <div className="max-h-40 overflow-y-auto space-y-1 text-xs text-amber-800">
                        {importResult.errors.map((err, i) => (
                          <div key={i} className="py-0.5 break-words">
                            • {err}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-200">
                    Chaque repas (Petit-déjeuner, Eau, Déjeuner, Dîner) créé pour cette session sera désormais automatiquement dimensionné sur cet effectif ({importResult.inserted + importResult.updated} rations).
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <div>
            {currentStep > 1 && currentStep < 6 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as Step)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Étape précédente
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentStep < 5 && (
              <button
                type="button"
                disabled={!selectedFile || (currentStep === 2 && (!mapping.matricule || !mapping.nom))}
                onClick={() => setCurrentStep((prev) => (prev + 1) as Step)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 active:bg-green-800 rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                <span>Étape suivante</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 5 && (
              <button
                type="button"
                onClick={executeImport}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-green-700 hover:bg-green-800 rounded-lg shadow-xs transition-colors"
              >
                <Database className="w-4 h-4" />
                Lancer l'importation réelle ({(summary?.newCount ?? 0) + (summary?.updateCount ?? 0)} étudiants)
              </button>
            )}

            {currentStep === 6 && !isImporting && (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-xs font-bold text-white bg-green-700 hover:bg-green-800 rounded-lg shadow-xs transition-colors"
              >
                Fermer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

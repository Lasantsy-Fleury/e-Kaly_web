import React, { useState } from 'react';
import { X, Save, UserCheck, AlertCircle, MapPin } from 'lucide-react';
import { Session, Student } from '../../types';
import { upsertStudent } from '../../services/studentService';

interface StudentFormModalProps {
  initialStudent?: Student | null;
  sessions?: Session[];
  defaultSessionId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export const StudentFormModal: React.FC<StudentFormModalProps> = ({
  initialStudent,
  sessions = [],
  defaultSessionId,
  onClose,
  onSaved,
}) => {
  const isEditing = !!initialStudent;

  const [matricule, setMatricule] = useState(initialStudent?.matricule || '');
  const [sessionId, setSessionId] = useState<string>(
    initialStudent?.sessionId || defaultSessionId || sessions[0]?.id || ''
  );
  const [nom, setNom] = useState(initialStudent?.nom || '');
  const [prenoms, setPrenoms] = useState(initialStudent?.prenoms || '');
  const [parcours, setParcours] = useState(initialStudent?.parcours || 'ASR');
  const [genre, setGenre] = useState(initialStudent?.genre || 'Masculin');
  const [dateNaissance, setDateNaissance] = useState(initialStudent?.dateNaissance || '');
  const [lieuNaissance, setLieuNaissance] = useState(initialStudent?.lieuNaissance || '');
  const [adresse, setAdresse] = useState(initialStudent?.adresse || '');
  const [email, setEmail] = useState(initialStudent?.email || '');
  const [telephone, setTelephone] = useState(initialStudent?.telephone || '');
  const [qrCodeUrl, setQrCodeUrl] = useState(initialStudent?.qrCodeUrl || '');
  const [active, setActive] = useState(initialStudent?.active !== false);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedSession = sessions.find((s) => s.id === sessionId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const safeMatricule = matricule.trim();
    if (!safeMatricule) {
      setError('Le matricule est obligatoire.');
      return;
    }
    if (safeMatricule === '.' || safeMatricule === '..' || safeMatricule.includes('/')) {
      setError('Matricule invalide comme identifiant Firestore (« / » ou « . » seul interdit).');
      return;
    }
    if (!sessionId && sessions.length === 0) {
      setError("Aucune session disponible. Veuillez d'abord créer une session de voyage dans l'onglet 'Sessions'.");
      return;
    }
    if (!nom.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }

    setSaving(true);
    try {
      const payload: Student = {
        id: safeMatricule,
        matricule: safeMatricule,
        sessionId,
        sessionNom: selectedSession?.nom || 'Session de voyage',
        nom: nom.trim(),
        prenoms: prenoms.trim(),
        niveau: 'M1', // Master 1 ENI
        parcours: parcours.trim(),
        genre: genre.trim(),
        dateNaissance: dateNaissance.trim(),
        lieuNaissance: lieuNaissance.trim(),
        adresse: adresse.trim(),
        email: email.trim(),
        telephone: telephone.trim(),
        qrCodeToken: initialStudent?.qrCodeToken || `EKALY-${safeMatricule}`,
        qrCodeUrl: qrCodeUrl.trim() || undefined,
        hasCustomQrCode: Boolean(qrCodeUrl.trim()) || Boolean(initialStudent?.hasCustomQrCode && !qrCodeUrl.trim()),
        active,
        createdAt: initialStudent?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await upsertStudent(payload);
      setSaving(false);
      onSaved();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full overflow-hidden border border-gray-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-green-700" />
            <h3 className="text-base font-bold text-gray-900">
              {isEditing ? `Modifier l'étudiant — ${initialStudent.matricule}` : 'Ajouter un étudiant M1 ENI'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              Session de voyage d'études <span className="text-red-500">*</span>
            </label>
            {sessions.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Aucune session trouvée. Veuillez d'abord créer une session dans l'onglet <strong>Sessions</strong>.</span>
              </div>
            ) : (
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 border border-gray-300 rounded-lg bg-white"
                required
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom} ({s.dateDebut} au {s.dateFin})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Matricule <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                disabled={isEditing}
                value={matricule}
                onChange={(e) => setMatricule(e.target.value)}
                placeholder="Ex: 00124 (zéros préservés)"
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex: ANDRIANTSOA"
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg uppercase focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Prénoms
              </label>
              <input
                type="text"
                value={prenoms}
                onChange={(e) => setPrenoms(e.target.value)}
                placeholder="Ex: Toky Nirina"
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Niveau académique
              </label>
              <input
                type="text"
                disabled
                value="Master 1 ENI"
                className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-700 font-semibold cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Parcours
              </label>
              <input
                type="text"
                value={parcours}
                onChange={(e) => setParcours(e.target.value)}
                placeholder="Ex: ASR, GB, IG..."
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Genre
              </label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="Masculin">Masculin</option>
                <option value="Féminin">Féminin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Téléphone
              </label>
              <input
                type="text"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+261 34 ..."
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="etudiant@eni.mg"
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Lien Google Drive du QR Code (optionnel)
              </label>
              <input
                type="text"
                value={qrCodeUrl}
                onChange={(e) => setQrCodeUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/... ou laisser vide pour générer automatiquement"
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 font-mono text-[11px]"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Lien vers l'image du QR Code sur Google Drive. Si vide, un nouveau QR Code e-Kaly standard sera généré.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 text-green-600 rounded-sm border-gray-300 focus:ring-green-500"
                />
                <span className="text-xs font-semibold text-gray-800">
                  Étudiant actif participant au voyage d'études
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || (!isEditing && sessions.length === 0)}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-xs disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

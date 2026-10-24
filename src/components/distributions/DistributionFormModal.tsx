import React, { useState, useEffect, useMemo } from 'react';
import { X, CalendarPlus, Save, AlertCircle, MapPin, Users, Clock } from 'lucide-react';
import { Distribution, DistributionStatus, DistributionType, Session, Student } from '../../types';
import { createDistribution, updateDistribution } from '../../services/distributionService';

interface DistributionFormModalProps {
  initialDistribution?: Distribution | null;
  sessions: Session[];
  students: Student[];
  defaultSessionId?: string;
  onClose: () => void;
  onSaved: () => void;
}

const DISTRIBUTION_TYPES: Array<{
  type: DistributionType;
  defaultTime: { debut: string; fin: string };
  defaultProduits: string[];
}> = [
  {
    type: 'Petit-déjeuner',
    defaultTime: { debut: '06:30', fin: '08:30' },
    defaultProduits: ['Petit-déjeuner complet', 'Pain', 'Boisson chaude'],
  },
  {
    type: 'Eau',
    defaultTime: { debut: '09:00', fin: '10:30' },
    defaultProduits: ["Bouteille d'eau minérale 1.5L"],
  },
  {
    type: 'Déjeuner',
    defaultTime: { debut: '11:45', fin: '14:00' },
    defaultProduits: ['Plat chaud déjeuner', 'Dessert'],
  },
  {
    type: 'Dîner',
    defaultTime: { debut: '19:00', fin: '21:30' },
    defaultProduits: ['Repas du soir', 'Collation'],
  },
  {
    type: 'Collation',
    defaultTime: { debut: '16:00', fin: '17:00' },
    defaultProduits: ['Goûter / Ration de route'],
  },
];

export const DistributionFormModal: React.FC<DistributionFormModalProps> = ({
  initialDistribution,
  sessions,
  students,
  defaultSessionId,
  onClose,
  onSaved,
}) => {
  const isEditing = !!initialDistribution;

  const [sessionId, setSessionId] = useState<string>(
    initialDistribution?.sessionId || defaultSessionId || sessions[0]?.id || ''
  );

  const selectedSession = sessions.find((s) => s.id === sessionId);

  // Exact number of students enrolled in this session
  const sessionStudentCount = useMemo(() => {
    return students.filter((s) => s.sessionId === sessionId).length;
  }, [students, sessionId]);

  const [typeDistribution, setTypeDistribution] = useState<DistributionType>(
    initialDistribution?.typeDistribution || 'Déjeuner'
  );
  const [nom, setNom] = useState(
    initialDistribution?.nom || 'Déjeuner'
  );
  const [date, setDate] = useState(
    initialDistribution?.date || selectedSession?.dateDebut || new Date().toISOString().slice(0, 10)
  );
  const [heureDebut, setHeureDebut] = useState(initialDistribution?.heureDebut || '11:45');
  const [heureFin, setHeureFin] = useState(initialDistribution?.heureFin || '14:00');
  const [description, setDescription] = useState(initialDistribution?.description || '');
  const [statut, setStatut] = useState<DistributionStatus>(
    initialDistribution?.statut || 'planned'
  );

  const [repasProduits, setRepasProduits] = useState<string[]>(
    initialDistribution?.repasProduits || []
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When type changes, auto-fill standard times and meal items
  const handleTypeChange = (type: DistributionType) => {
    setTypeDistribution(type);
    const preset = DISTRIBUTION_TYPES.find((d) => d.type === type);
    if (preset) {
      setHeureDebut(preset.defaultTime.debut);
      setHeureFin(preset.defaultTime.fin);
      setRepasProduits(preset.defaultProduits);
      setNom(`${type} — ${selectedSession?.destination || 'Voyage'}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sessionId || sessions.length === 0) {
      setError("Aucune session disponible. Veuillez d'abord créer une session de voyage dans l'onglet 'Sessions'.");
      return;
    }
    if (!nom.trim()) {
      setError('Le nom de la distribution est obligatoire.');
      return;
    }
    if (!date) {
      setError('La date est obligatoire.');
      return;
    }

    setSaving(true);
    try {
      const payload: Omit<Distribution, 'id' | 'createdAt' | 'updatedAt'> = {
        sessionId,
        sessionNom: selectedSession?.nom || 'Session de voyage',
        nom: nom.trim(),
        date,
        heureDebut,
        heureFin,
        typeDistribution,
        repasProduits,
        // Rule: strictly equal to the number of students in the session!
        quantitePrevue: sessionStudentCount,
        statut,
        description: description.trim(),
      };

      if (isEditing && initialDistribution) {
        await updateDistribution(initialDistribution.id, payload);
      } else {
        await createDistribution(payload);
      }

      setSaving(false);
      onSaved();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full overflow-hidden border border-gray-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-green-700" />
            <h3 className="text-base font-bold text-gray-900">
              {isEditing ? `Modifier la distribution` : 'Programmer une distribution de repas'}
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

          {/* Session Selection */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              Session de voyage d'études <span className="text-red-500">*</span>
            </label>
            {sessions.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Aucune session active. Veuillez créer une session dans l'onglet <strong>Sessions</strong> avant de créer une distribution.</span>
              </div>
            ) : (
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full text-xs font-semibold border border-gray-300 rounded-lg p-2.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom} ({s.dateDebut} au {s.dateFin} • {s.destination || 'Destination'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Type of distribution picker */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Type de distribution alimentaire <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {DISTRIBUTION_TYPES.map((dt) => {
                const isSelected = typeDistribution === dt.type;
                return (
                  <button
                    type="button"
                    key={dt.type}
                    onClick={() => handleTypeChange(dt.type)}
                    className={`text-xs px-2.5 py-2 rounded-lg font-bold border transition-colors ${
                      isSelected
                        ? 'bg-green-600 text-white border-green-700 shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {dt.type}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Titre de la distribution <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex: Déjeuner Jour 1 - Toliara"
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-semibold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Date de distribution <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                min={selectedSession?.dateDebut}
                max={selectedSession?.dateFin}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
                required
              />
              {selectedSession && (
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  Période du voyage : {selectedSession.dateDebut} au {selectedSession.dateFin}
                </span>
              )}
            </div>

            {/* Quantity strictly bound to session students count */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-green-600" />
                Quantité exacte à distribuer
              </label>
              <div className="w-full text-xs px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-lg font-bold flex items-center justify-between">
                <span>{sessionStudentCount} portions</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Heure de début <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={heureDebut}
                onChange={(e) => setHeureDebut(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Heure de fin <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={heureFin}
                onChange={(e) => setHeureFin(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Statut
              </label>
              <select
                value={statut}
                onChange={(e) => setStatut(e.target.value as DistributionStatus)}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white font-medium"
              >
                <option value="planned">Planifiée</option>
                <option value="ongoing">En cours (Pointage ouvert)</option>
                <option value="completed">Terminée</option>
                <option value="draft">Brouillon</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Rations / Produits servis (séparés par virgules)
              </label>
              <input
                type="text"
                value={repasProduits.join(', ')}
                onChange={(e) =>
                  setRepasProduits(
                    e.target.value
                      .split(',')
                      .map((p) => p.trim())
                      .filter(Boolean)
                  )
                }
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Remarques / Emplacement (facultatif)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Réfectoire de l'hôtel, distribution par les pointeurs autorisés..."
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg"
              />
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
              disabled={saving || sessions.length === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-xs disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Programmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { X, MapPin, Calendar, Save, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Session, SessionStatus } from '../../types';
import { createSession, updateSession } from '../../services/sessionService';

interface SessionModalProps {
  initialSession?: Session | null;
  onClose: () => void;
  onSaved: (sessionId: string) => void;
}

export const SessionModal: React.FC<SessionModalProps> = ({
  initialSession,
  onClose,
  onSaved,
}) => {
  const isEditing = !!initialSession;

  const [nom, setNom] = useState(initialSession?.nom || '');
  const [destination, setDestination] = useState(initialSession?.destination || '');
  const [dateDebut, setDateDebut] = useState(
    initialSession?.dateDebut || new Date().toISOString().slice(0, 10)
  );
  const [dateFin, setDateFin] = useState(initialSession?.dateFin || '');
  const [statut, setStatut] = useState<SessionStatus>(
    initialSession?.statut || 'planned'
  );
  const [description, setDescription] = useState(
    initialSession?.description || ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nom.trim()) {
      setError('Le nom de la session de voyage est obligatoire.');
      return;
    }
    if (!dateDebut || !dateFin) {
      setError('Les dates de début et de fin sont obligatoires.');
      return;
    }
    if (new Date(dateFin) < new Date(dateDebut)) {
      setError('La date de fin ne peut pas être antérieure à la date de début.');
      return;
    }

    setSaving(true);
    try {
      const payload: Omit<Session, 'id' | 'createdAt' | 'updatedAt'> = {
        nom: nom.trim(),
        destination: destination.trim(),
        dateDebut,
        dateFin,
        statut,
        description: description.trim(),
      };

      let id = initialSession?.id;
      if (isEditing && initialSession) {
        await updateSession(initialSession.id, payload);
      } else {
        id = await createSession(payload);
      }

      setSaving(false);
      onSaved(id || '');
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-gray-100 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-700" />
            <h3 className="text-base font-bold text-gray-900">
              {isEditing ? `Modifier la session de voyage` : 'Nouvelle session de voyage d’études'}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Nom de la session <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex: Voyage d'Études M1 ENI 2026"
              className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Destination / Itinéraire
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Ex: Toliara • Mahajanga • Antsirabe"
              className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Date de début <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Date de fin <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Statut du voyage
            </label>
            <select
              value={statut}
              onChange={(e) => setStatut(e.target.value as SessionStatus)}
              className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white font-medium"
            >
              <option value="planned">Planifiée</option>
              <option value="ongoing">En cours (Active)</option>
              <option value="completed">Terminée</option>
              <option value="archived">Archivée</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Description / Notes
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Voyage d'études M1 ENI..."
              className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
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
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-xs disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Créer la session'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

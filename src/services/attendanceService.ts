import * as XLSX from 'xlsx';
import { ekalyApi } from './apiClient';
import { Attendance, AttendanceStatus, Distribution, Student } from '../types';
import {
  describeDistributionWindow,
  getMealIdentity,
  isDistributionOpen,
} from './distributionService';

export interface RecordScanInput {
  student: Student;
  distribution: Distribution;
  pointeurId: string;
  pointeurNom: string;
  pointeurEmail: string;
  existingAttendancesForDistribution: Attendance[];
}

/**
 * Abonnement réactif aux pointages depuis PostgreSQL
 */
export function subscribeToAttendance(
  onUpdate: (records: Attendance[]) => void,
  onError: (err: any) => void
) {
  const fetchAttendance = async () => {
    try {
      const rows = await ekalyApi.attendance.list();
      const list: Attendance[] = rows.map((data: any) => {
        const dateIso = data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString();
        const syncIso = data.synced_at ? new Date(data.synced_at).toISOString() : dateIso;

        return {
          id: data.id,
          distributionId: data.distribution_id || data.distributionId || '',
          distributionNom: data.distribution_nom || data.distributionNom || 'Distribution',
          matricule: data.matricule || '',
          studentId: data.matricule || data.id,
          studentNomComplet: data.student_nom_complet || data.studentNomComplet || '',
          repasProduit: data.repas_produit || data.mealType || 'Repas',
          scannedAt: dateIso,
          syncedAt: syncIso,
          pointeurId: data.pointeur_id || data.pointeurId || '',
          pointeurNom: data.pointeur_nom || data.pointeurNom || 'Pointeur',
          pointeurEmail: data.pointeur_email || '',
          statut: (data.statut as AttendanceStatus) || 'valid',
          anomalie: data.anomalie,
          createdAt: dateIso,
        };
      });

      list.sort((a, b) => b.syncedAt.localeCompare(a.syncedAt));
      onUpdate(list);
    } catch (error) {
      console.error('[PostgreSQL] Erreur chargement pointages:', error);
      onError(error);
    }
  };

  fetchAttendance();
  const intervalId = window.setInterval(fetchAttendance, 4000);
  return () => window.clearInterval(intervalId);
}

export async function recordScan(input: RecordScanInput): Promise<Attendance> {
  const { student, distribution, pointeurId, pointeurNom } = input;

  if (!isDistributionOpen(distribution)) {
    throw new Error(
      `La distribution "${distribution.nom}" n'est pas ouverte (${describeDistributionWindow(
        distribution
      )}). Aucun pointage ne peut être enregistré.`
    );
  }

  const meal = getMealIdentity(distribution);

  const res = await ekalyApi.attendance.record({
    distributionId: distribution.id,
    matricule: student.matricule,
    studentNomComplet: `${student.nom} ${student.prenoms}`.trim(),
    parcours: student.parcours || 'GB',
    mealType: meal,
    pointageMethod: 'web_console',
    pointeurId,
    pointeurNom,
  });

  const row = res.pointage;
  const now = new Date().toISOString();

  return {
    id: row?.id || `att_${distribution.id}_${student.matricule}_${meal}`,
    distributionId: distribution.id,
    distributionNom: distribution.nom,
    studentId: student.matricule,
    matricule: student.matricule,
    studentNomComplet: `${student.nom} ${student.prenoms}`.trim(),
    repasProduit: meal,
    scannedAt: row?.timestamp ? new Date(row.timestamp).toISOString() : now,
    syncedAt: row?.synced_at ? new Date(row.synced_at).toISOString() : now,
    pointeurId,
    pointeurNom,
    statut: res.statut || (row?.statut as AttendanceStatus) || 'valid',
    anomalie: res.statut === 'duplicate' ? 'Pointage déjà existant' : undefined,
  };
}

export async function correctAttendanceStatus(
  id: string,
  newStatus: AttendanceStatus,
  motif: string
): Promise<void> {
  if (newStatus === 'cancelled') {
    await ekalyApi.attendance.delete(id);
  }
}

export function exportAttendanceToCSV(records: Attendance[], filename = 'pointages-e-kaly.csv') {
  const headers = [
    'Matricule',
    'Nom Étudiant',
    'Distribution',
    'Repas / Produit',
    'Date & Heure Scan',
    'Date & Heure Synchronisation',
    'Pointeur',
    'Statut',
    'Anomalie / Motif',
  ];

  const rows = records.map((r) => [
    `"${r.matricule}"`,
    `"${r.studentNomComplet.replace(/"/g, '""')}"`,
    `"${r.distributionNom.replace(/"/g, '""')}"`,
    `"${r.repasProduit}"`,
    `"${new Date(r.scannedAt).toLocaleString('fr-FR')}"`,
    `"${new Date(r.syncedAt).toLocaleString('fr-FR')}"`,
    `"${r.pointeurNom}"`,
    `"${r.statut}"`,
    `"${(r.anomalie || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportAttendanceToExcel(records: Attendance[], filename = 'pointages-e-kaly.xlsx') {
  const data = records.map((r) => ({
    'Matricule': r.matricule,
    'Nom Complet Étudiant': r.studentNomComplet,
    'Distribution': r.distributionNom,
    'Repas / Produit': r.repasProduit,
    'Date & Heure Scan': new Date(r.scannedAt).toLocaleString('fr-FR'),
    'Date & Heure Sync Serveur': new Date(r.syncedAt).toLocaleString('fr-FR'),
    'Pointeur Responsable': r.pointeurNom,
    'Statut Pointage':
      r.statut === 'valid'
        ? 'Valide'
        : r.statut === 'duplicate_attempt'
        ? 'Tentative de doublon'
        : r.statut === 'ineligible'
        ? 'Non éligible'
        : 'Annulé',
    'Anomalie': r.anomalie || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pointages');
  XLSX.writeFile(workbook, filename);
}

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Attendance, AttendanceStatus, Distribution, Student } from '../types';

export function subscribeToAttendance(
  onUpdate: (records: Attendance[]) => void,
  onError: (err: any) => void
) {
  let attendanceList: Attendance[] = [];
  let pointagesList: Attendance[] = [];

  const mergeAndNotify = () => {
    const map = new Map<string, Attendance>();
    // Insert pointages first
    for (const p of pointagesList) {
      map.set(p.id, p);
    }
    // Attendance overrides or adds
    for (const a of attendanceList) {
      map.set(a.id, a);
    }
    const combined = Array.from(map.values());
    combined.sort((a, b) => b.syncedAt.localeCompare(a.syncedAt));
    onUpdate(combined);
  };

  const unsubAttendance = onSnapshot(
    collection(db, 'attendance'),
    (snapshot) => {
      attendanceList = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          sessionId: data.sessionId,
          matricule: data.matricule || data.studentMatricule || '',
          studentId: data.studentId || data.matricule,
          studentNomComplet: data.studentNomComplet || data.studentName || '',
          distributionId: data.distributionId || '',
          distributionNom: data.distributionNom || data.distributionName || '',
          repasProduit: data.repasProduit || data.mealType || 'Repas',
          scannedAt: data.scannedAt || (data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.scannedAt) || new Date().toISOString(),
          syncedAt: data.syncedAt || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.syncedAt) || new Date().toISOString(),
          pointeurId: data.pointeurId || data.pointerId || '',
          pointeurNom: data.pointeurNom || data.pointerName || '',
          pointeurEmail: data.pointeurEmail || '',
          statut: (data.statut as AttendanceStatus) || 'valid',
          anomalie: data.anomalie,
          createdAt: data.createdAt,
        };
      });
      mergeAndNotify();
    },
    (error) => {
      console.warn('Attendance collection listener warning:', error);
      onError(error);
    }
  );

  const unsubPointages = onSnapshot(
    collection(db, 'pointages'),
    (snapshot) => {
      pointagesList = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const dateIso = data.timestamp?.toDate
          ? data.timestamp.toDate().toISOString()
          : (data.scannedAt || new Date().toISOString());
        const syncIso = data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : (data.syncedAt || dateIso);

        return {
          id: docSnap.id,
          matricule: data.studentMatricule || data.matricule || '',
          studentId: data.studentId || data.matricule,
          studentNomComplet: data.studentName || data.studentNomComplet || '',
          distributionId: data.distributionId || '',
          distributionNom: data.distributionName || data.distributionNom || '',
          repasProduit: data.mealType || data.repasProduit || 'Repas',
          scannedAt: dateIso,
          syncedAt: syncIso,
          pointeurId: data.pointerId || data.pointeurId || '',
          pointeurNom: data.pointerName || data.pointeurNom || '',
          pointeurEmail: data.pointeurEmail || '',
          statut: (data.statut as AttendanceStatus) || 'valid',
          anomalie: data.anomalie,
          createdAt: dateIso,
        };
      });
      mergeAndNotify();
    },
    (error) => {
      console.warn('Pointages collection listener notice:', error);
    }
  );

  return () => {
    unsubAttendance();
    unsubPointages();
  };
}

export interface RecordScanInput {
  student: Student;
  distribution: Distribution;
  repasProduit: string;
  pointeurId: string;
  pointeurNom: string;
  pointeurEmail?: string;
  existingAttendancesForDistribution: Attendance[];
}

export async function recordScan(input: RecordScanInput): Promise<Attendance> {
  const {
    student,
    distribution,
    repasProduit,
    pointeurId,
    pointeurNom,
    pointeurEmail,
    existingAttendancesForDistribution,
  } = input;

  const now = new Date().toISOString();
  const newId = `att_${Date.now()}_${student.matricule}_${Math.random().toString(36).substring(2, 6)}`;
  const docRef = doc(db, 'attendance', newId);

  // Check 1: Duplicate check (Has student already scanned for this distribution and meal product?)
  const duplicate = existingAttendancesForDistribution.find(
    (att) =>
      att.matricule === student.matricule &&
      att.repasProduit === repasProduit &&
      att.statut === 'valid'
  );

  let statut: AttendanceStatus = 'valid';
  let anomalie: string | undefined = undefined;

  if (duplicate) {
    statut = 'duplicate_attempt';
    anomalie = `Déjà pointé à ${new Date(duplicate.scannedAt).toLocaleTimeString('fr-FR')} par ${duplicate.pointeurNom || 'un pointeur'}`;
  } else {
    // Check 2: Session validation (Student must be enrolled in the distribution's voyage session)
    if (distribution.sessionId && student.sessionId && student.sessionId !== distribution.sessionId) {
      statut = 'ineligible';
      anomalie = `Étudiant non inscrit à la session de voyage "${distribution.sessionNom || distribution.sessionId}"`;
    }
  }

  const record: Attendance = {
    id: newId,
    sessionId: distribution.sessionId,
    matricule: student.matricule,
    studentId: student.id,
    studentNomComplet: `${student.nom.toUpperCase()} ${student.prenoms || ''}`.trim(),
    distributionId: distribution.id,
    distributionNom: distribution.nom,
    repasProduit,
    scannedAt: now,
    syncedAt: now,
    pointeurId,
    pointeurNom,
    pointeurEmail,
    statut,
    anomalie,
    createdAt: now,
  };

  try {
    await setDoc(docRef, record);
    return record;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `attendance/${newId}`);
  }
}

export async function correctAttendanceStatus(
  id: string,
  newStatus: AttendanceStatus,
  motif: string
): Promise<void> {
  const docRef = doc(db, 'attendance', id);
  try {
    await updateDoc(docRef, {
      statut: newStatus,
      anomalie: motif ? `Correction administrative: ${motif}` : undefined,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `attendance/${id}`);
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
    'Statut Pointage': r.statut === 'valid' ? 'Valide' : r.statut === 'duplicate_attempt' ? 'Tentative de doublon' : r.statut === 'ineligible' ? 'Non éligible' : 'Annulé',
    'Anomalie': r.anomalie || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pointages');
  XLSX.writeFile(workbook, filename);
}

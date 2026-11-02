import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  getDoc,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Attendance, AttendanceStatus, Distribution, Student } from '../types';
import {
  describeDistributionWindow,
  getMealIdentity,
  isDistributionOpen,
} from './distributionService';

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

const MAX_DOC_ID_LENGTH = 120;

/** Mirrors the sanitisation used by the mobile app for idempotency keys. */
export function sanitizeForDocId(value: string): string {
  return String(value ?? '')
    .replace(/[^a-zA-Z0-9_\-.]/g, '_')
    .slice(0, MAX_DOC_ID_LENGTH);
}

/**
 * Deterministic attendance id shared by Web and Mobile. Using the canonical
 * meal identity (distribution type) instead of a product label guarantees the
 * same document is targeted from both clients, so repeated scans cannot create
 * duplicate pointages.
 */
export function buildAttendanceId(
  distributionId: string,
  matricule: string,
  mealIdentity: string
): string {
  return sanitizeForDocId(`${distributionId}_${matricule}_${mealIdentity}`);
}

function timestampToIso(value: any, fallback: string): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function mapAttendanceSnapshot(id: string, data: any, fallback: string): Attendance {
  return {
    id,
    sessionId: data.sessionId,
    matricule: data.matricule || data.studentMatricule || '',
    studentId: data.studentId || data.matricule,
    studentNomComplet: data.studentNomComplet || data.studentName || '',
    distributionId: data.distributionId || '',
    distributionNom: data.distributionNom || data.distributionName || '',
    repasProduit: data.repasProduit || data.mealType || 'Repas',
    scannedAt: timestampToIso(data.scannedAt, fallback),
    syncedAt: timestampToIso(data.syncedAt || data.createdAt, fallback),
    pointeurId: data.pointeurId || data.pointerId || '',
    pointeurNom: data.pointeurNom || data.pointerName || '',
    pointeurEmail: data.pointeurEmail || '',
    statut: (data.statut as AttendanceStatus) || 'valid',
    anomalie: data.anomalie,
    createdAt: data.createdAt,
  };
}

export async function recordScan(input: RecordScanInput): Promise<Attendance> {
  const {
    student,
    distribution,
    pointeurId,
    pointeurNom,
    pointeurEmail,
    existingAttendancesForDistribution,
  } = input;

  // Authoritative client-side gate: no pointage outside of an open slot.
  // The Firestore rules enforce the same condition server-side.
  if (!isDistributionOpen(distribution)) {
    throw new Error(
      `La distribution "${distribution.nom}" n'est pas ouverte (${describeDistributionWindow(
        distribution
      )}). Aucun pointage ne peut être enregistré.`
    );
  }

  const now = new Date().toISOString();
  const meal = getMealIdentity(distribution);
  const attendanceId = buildAttendanceId(distribution.id, student.matricule, meal);
  const docRef = doc(db, 'attendance', attendanceId);

  // Check 1: legacy duplicates (records created before deterministic ids).
  const legacyDuplicate = existingAttendancesForDistribution.find(
    (att) =>
      att.statut === 'valid' &&
      att.matricule === student.matricule &&
      att.id !== attendanceId &&
      (att.repasProduit === meal || (distribution.repasProduits || []).includes(att.repasProduit))
  );

  // Check 2: deterministic document already exists (cross-device scan).
  let deterministicDuplicate: Attendance | undefined;
  try {
    const existingSnapshot = await getDoc(docRef);
    if (existingSnapshot.exists()) {
      const existing = mapAttendanceSnapshot(
        existingSnapshot.id,
        existingSnapshot.data() || {},
        now
      );
      if (existing.statut === 'valid') deterministicDuplicate = existing;
    }
  } catch (error) {
    console.warn('Unable to pre-read attendance document:', error);
  }

  const duplicate = deterministicDuplicate || legacyDuplicate;

  let statut: AttendanceStatus = 'valid';
  let anomalie: string | undefined = undefined;

  if (duplicate) {
    statut = 'duplicate_attempt';
    const time = new Date(duplicate.scannedAt).toLocaleTimeString('fr-FR');
    anomalie = `Déjà pointé à ${time} par ${duplicate.pointeurNom || 'un pointeur'}`;
  } else if (distribution.sessionId && student.sessionId && student.sessionId !== distribution.sessionId) {
    // Check 3: Session validation (Student must be enrolled in the voyage session)
    statut = 'ineligible';
    anomalie = `Étudiant non inscrit à la session de voyage "${distribution.sessionNom || distribution.sessionId}"`;
  }

  // Only valid pointages use the deterministic id. Anomalies (duplicates,
  // ineligible students) are stored as separate traceable records so they can
  // never overwrite a valid pointage.
  const recordId =
    statut === 'valid'
      ? attendanceId
      : `att_${Date.now()}_${sanitizeForDocId(student.matricule).slice(0, 32)}_${Math.random()
          .toString(36)
          .substring(2, 6)}`;

  const buildRecord = (id: string): Attendance => ({
    id,
    sessionId: distribution.sessionId,
    matricule: student.matricule,
    studentId: student.id,
    studentNomComplet: `${student.nom.toUpperCase()} ${student.prenoms || ''}`.trim(),
    distributionId: distribution.id,
    distributionNom: distribution.nom,
    repasProduit: meal,
    scannedAt: now,
    syncedAt: now,
    pointeurId,
    pointeurNom,
    pointeurEmail,
    statut,
    anomalie,
    createdAt: now,
  });

  const record = buildRecord(recordId);

  try {
    await setDoc(doc(db, 'attendance', recordId), record);
    return record;
  } catch (error) {
    const code = (error as { code?: string })?.code;

    // Race lost against another device: the deterministic document now exists
    // and belongs to another pointer. Never overwrite it, record the attempt.
    if (code === 'permission-denied' && statut === 'valid') {
      try {
        const racedSnapshot = await getDoc(docRef);
        if (racedSnapshot.exists()) {
          const prior = mapAttendanceSnapshot(racedSnapshot.id, racedSnapshot.data() || {}, now);
          const duplicateRecord = buildRecord(
            `att_${Date.now()}_${sanitizeForDocId(student.matricule).slice(0, 32)}_${Math.random()
              .toString(36)
              .substring(2, 6)}`
          );
          duplicateRecord.statut = 'duplicate_attempt';
          duplicateRecord.anomalie = `Déjà pointé à ${new Date(prior.scannedAt).toLocaleTimeString(
            'fr-FR'
          )} par ${prior.pointeurNom || 'un pointeur'}`;
          await setDoc(doc(db, 'attendance', duplicateRecord.id), duplicateRecord);
          return duplicateRecord;
        }
      } catch (raceError) {
        console.warn('Unable to resolve attendance race:', raceError);
      }
    }

    handleFirestoreError(error, OperationType.WRITE, `attendance/${recordId}`);
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

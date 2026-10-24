import * as XLSX from 'xlsx';
import { ColumnMapping, ImportPreviewRow, ImportSummary, Student } from '../types';

export interface ParseResult {
  headers: string[];
  rawRows: Record<string, any>[];
  detectedMapping: ColumnMapping;
}

/**
 * Extracts a Google Drive file ID from various link formats (sharing link, open?id, uc?id, thumbnail, etc.)
 */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Pattern 1: /file/d/([a-zA-Z0-9_-]+)
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch) return fileDMatch[1];

  // Pattern 2: [?&]id=([a-zA-Z0-9_-]+)
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];

  // Pattern 3: lh3.googleusercontent.com/d/([a-zA-Z0-9_-]+)
  const lh3Match = trimmed.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match) return lh3Match[1];

  // Pattern 4: /thumbnail\?id=([a-zA-Z0-9_-]+)
  const thumbMatch = trimmed.match(/\/thumbnail\?id=([a-zA-Z0-9_-]+)/);
  if (thumbMatch) return thumbMatch[1];

  // Pattern 5: /open\?id=([a-zA-Z0-9_-]+)
  const openMatch = trimmed.match(/\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];

  return null;
}

/**
 * Converts a Google Drive link to a direct high-res CORS-enabled image URL
 */
export function getDriveImageDirectUrl(url: string): string {
  const fileId = extractGoogleDriveFileId(url);
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
  }
  return url.trim();
}

export function autoDetectMapping(headers: string[], rawRows: Record<string, any>[] = []): ColumnMapping {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const mapping: ColumnMapping = {
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
  };

  for (const h of headers) {
    const norm = normalize(h);
    if (!mapping.matricule && (norm.includes('matricule') || norm === 'mat' || norm === 'id')) {
      mapping.matricule = h;
    } else if (!mapping.nom && (norm === 'nom' || norm.includes('nom de famille') || norm.startsWith('nom '))) {
      mapping.nom = h;
    } else if (!mapping.prenoms && (norm.includes('prenom') || norm === 'prenoms')) {
      mapping.prenoms = h;
    } else if (!mapping.parcours && (norm.includes('parcours') || norm.includes('filiere') || norm.includes('mention') || norm === 'option' || norm.includes('specialite'))) {
      mapping.parcours = h;
    } else if (!mapping.genre && (norm.includes('genre') || norm.includes('sexe'))) {
      mapping.genre = h;
    } else if (!mapping.dateNaissance && (norm.includes('date') && (norm.includes('naissance') || norm.includes('naiss')))) {
      mapping.dateNaissance = h;
    } else if (!mapping.lieuNaissance && (norm.includes('lieu') && norm.includes('naissance'))) {
      mapping.lieuNaissance = h;
    } else if (!mapping.situationMatrimoniale && (norm.includes('matrimonial') || norm.includes('situation'))) {
      mapping.situationMatrimoniale = h;
    } else if (!mapping.nationalite && (norm.includes('nationalite') || norm.includes('pays'))) {
      mapping.nationalite = h;
    } else if (!mapping.adresse && (norm.includes('adresse') || norm.includes('domicile') || norm.includes('residence'))) {
      mapping.adresse = h;
    } else if (!mapping.email && (norm.includes('email') || norm.includes('mail') || norm.includes('courriel'))) {
      mapping.email = h;
    } else if (!mapping.telephone && (norm.includes('tel') || norm.includes('telephone') || norm.includes('contact') || norm.includes('phone'))) {
      mapping.telephone = h;
    } else if (!mapping.photo && (norm.includes('photo') || norm.includes('portrait') || norm.includes('avatar'))) {
      mapping.photo = h;
    } else if (!mapping.qrCode && (
      norm.includes('qr') ||
      norm.includes('qrcode') ||
      norm.includes('code qr') ||
      norm.includes('codeqr') ||
      norm.includes('drive') ||
      norm.includes('badge') ||
      (norm.includes('code') && !norm.includes('postal'))
    )) {
      mapping.qrCode = h;
    }
  }

  // Deep check: If qrCode is still not mapped, inspect first few data rows for Google Drive links
  if (!mapping.qrCode && rawRows.length > 0) {
    for (const h of headers) {
      if (h === mapping.photo || h === mapping.matricule || h === mapping.nom) continue;
      const sampleHasDriveLink = rawRows.slice(0, 5).some((row) => {
        const val = String(row[h] || '').trim().toLowerCase();
        return (
          val.includes('drive.google.com') ||
          val.includes('lh3.googleusercontent.com') ||
          val.includes('docs.google.com/file') ||
          Boolean(extractGoogleDriveFileId(val))
        );
      });
      if (sampleHasDriveLink) {
        mapping.qrCode = h;
        break;
      }
    }
  }

  return mapping;
}

export async function parseExcelOrCsvFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Le fichier sélectionné ne contient aucune feuille de calcul.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
    raw: false,
    defval: '',
  });

  if (rawRows.length === 0) {
    throw new Error('La feuille de calcul est vide.');
  }

  const headers = Object.keys(rawRows[0]);
  const detectedMapping = autoDetectMapping(headers, rawRows);

  return {
    headers,
    rawRows,
    detectedMapping,
  };
}

export function validateAndMapRows(
  rawRows: Record<string, any>[],
  mapping: ColumnMapping,
  existingStudentsMap: Map<string, Student>,
  targetSession: { id: string; nom: string }
): { previewRows: ImportPreviewRow[]; summary: ImportSummary } {
  const previewRows: ImportPreviewRow[] = [];
  const seenMatriculesInFile = new Set<string>();

  let newCount = 0;
  let updateCount = 0;
  let errorCount = 0;
  let ignoredCount = 0;
  const errorsList: Array<{ rowNumber: number; matricule?: string; message: string }> = [];

  for (let index = 0; index < rawRows.length; index++) {
    const row = rawRows[index];
    const rowNumber = index + 2;

    const rawMatricule = mapping.matricule ? String(row[mapping.matricule] || '').trim() : '';

    if (!rawMatricule) {
      errorCount++;
      const err = `Ligne ${rowNumber} : Le matricule est obligatoire mais la cellule est vide.`;
      errorsList.push({ rowNumber, message: err });
      previewRows.push({
        rowNumber,
        raw: row,
        status: 'error',
        error: err,
      });
      continue;
    }

    // Le matricule sert d'identifiant de document Firestore : on autorise
    // tout caractère excepté "/" (et "." / "..") pour rester compatible avec
    // les véritables listes d'étudiants.
    if (rawMatricule === '.' || rawMatricule === '..' || rawMatricule.includes('/')) {
      errorCount++;
      const err = `Ligne ${rowNumber} : Matricule "${rawMatricule}" invalide comme identifiant Firestore (« / » ou « . » seul interdit).`;
      errorsList.push({ rowNumber, matricule: rawMatricule, message: err });
      previewRows.push({
        rowNumber,
        raw: row,
        status: 'error',
        error: err,
      });
      continue;
    }

    if (seenMatriculesInFile.has(rawMatricule)) {
      errorCount++;
      const err = `Ligne ${rowNumber} : Doublon de matricule "${rawMatricule}" détecté dans ce même fichier.`;
      errorsList.push({ rowNumber, matricule: rawMatricule, message: err });
      previewRows.push({
        rowNumber,
        raw: row,
        status: 'error',
        error: err,
      });
      continue;
    }

    seenMatriculesInFile.add(rawMatricule);

    const nom = mapping.nom ? String(row[mapping.nom] || '').trim() : '';
    if (!nom) {
      errorCount++;
      const err = `Ligne ${rowNumber} : Le nom de l'étudiant est requis.`;
      errorsList.push({ rowNumber, matricule: rawMatricule, message: err });
      previewRows.push({
        rowNumber,
        raw: row,
        status: 'error',
        error: err,
      });
      continue;
    }

    const prenoms = mapping.prenoms ? String(row[mapping.prenoms] || '').trim() : '';
    const parcours = mapping.parcours ? String(row[mapping.parcours] || '').trim() : '';
    const genre = mapping.genre ? String(row[mapping.genre] || '').trim() : '';
    const situationMatrimoniale = mapping.situationMatrimoniale ? String(row[mapping.situationMatrimoniale] || '').trim() : '';
    const nationalite = mapping.nationalite ? String(row[mapping.nationalite] || '').trim() : '';
    const dateNaissance = mapping.dateNaissance ? String(row[mapping.dateNaissance] || '').trim() : '';
    const lieuNaissance = mapping.lieuNaissance ? String(row[mapping.lieuNaissance] || '').trim() : '';
    const adresse = mapping.adresse ? String(row[mapping.adresse] || '').trim() : '';
    const email = mapping.email ? String(row[mapping.email] || '').trim() : '';
    const telephone = mapping.telephone ? String(row[mapping.telephone] || '').trim() : '';
    const rawQrCode = mapping.qrCode ? String(row[mapping.qrCode] || '').trim() : '';

    const mappedColumns = new Set(Object.values(mapping).filter(Boolean));
    const extraFields: Record<string, any> = {};
    for (const [key, val] of Object.entries(row)) {
      if (!mappedColumns.has(key) && val !== '') {
        extraFields[key] = val;
      }
    }

    const existingStudent = existingStudentsMap.get(rawMatricule);
    const isExisting = !!existingStudent;

    // Détection stricte : un QR code personnalisé existe-t-il dans le fichier ou chez l'étudiant existant ?
    const hasCustomQrCode = Boolean(rawQrCode) || Boolean(existingStudent?.hasCustomQrCode && !rawQrCode);
    const qrCodeUrl = rawQrCode || existingStudent?.qrCodeUrl || '';
    // Règle métier : Ne créer un nouveau token que si l'étudiant à importer n'en possède pas
    const qrCodeToken = rawQrCode || existingStudent?.qrCodeToken || `EKALY-${rawMatricule}`;

    const parsedStudent: Partial<Student> = {
      matricule: rawMatricule,
      sessionId: targetSession.id,
      sessionNom: targetSession.nom,
      nom,
      prenoms,
      genre: genre || existingStudent?.genre,
      niveau: 'M1', // Unique level for ENI Study Trips
      parcours: parcours || existingStudent?.parcours,
      situationMatrimoniale: situationMatrimoniale || existingStudent?.situationMatrimoniale,
      nationalite: nationalite || existingStudent?.nationalite,
      dateNaissance: dateNaissance || existingStudent?.dateNaissance,
      lieuNaissance: lieuNaissance || existingStudent?.lieuNaissance,
      adresse: adresse || existingStudent?.adresse,
      email: email || existingStudent?.email,
      telephone: telephone || existingStudent?.telephone,
      qrCodeToken,
      qrCodeUrl: qrCodeUrl || undefined,
      hasCustomQrCode,
      active: true,
      extraFields,
    };

    if (isExisting) {
      updateCount++;
      previewRows.push({
        rowNumber,
        raw: row,
        parsedStudent,
        status: 'update',
      });
    } else {
      newCount++;
      previewRows.push({
        rowNumber,
        raw: row,
        parsedStudent,
        status: 'new',
      });
    }
  }

  const summary: ImportSummary = {
    fileName: '',
    totalDetected: rawRows.length,
    newCount,
    updateCount,
    errorCount,
    ignoredCount,
    errors: errorsList,
  };

  return { previewRows, summary };
}

export function downloadStudentTemplate() {
  const sampleData = [
    {
      'Matricule': '00124',
      'Parcours': 'ASR',
      'Nom': 'ANDRIANTSOA',
      'Prénoms': 'Toky Nirina',
      'Genre': 'Masculin',
      'Situation matrimoniale': 'Célibataire',
      'Nationalité': 'Malagasy',
      'Date de naissance': '15/04/2001',
      'Lieu de naissance': 'Antananarivo',
      'Adresse': 'Cité Universitaire Fianarantsoa',
      'Email': 'toky.andrian@eni.mg',
      'Téléphone': '+261 34 12 345 67',
      'Lien QR Code (Drive / Image)': 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view?usp=sharing',
    },
    {
      'Matricule': '00125',
      'Parcours': 'ASR',
      'Nom': 'RAKOTOMALALA',
      'Prénoms': 'Hasina Feno',
      'Genre': 'Féminin',
      'Situation matrimoniale': 'Célibataire',
      'Nationalité': 'Malagasy',
      'Date de naissance': '08/09/2001',
      'Lieu de naissance': 'Toliara',
      'Adresse': 'Logement ENI Tanambao',
      'Email': 'hasina.rako@eni.mg',
      'Téléphone': '+261 32 98 765 43',
      'Lien QR Code (Drive / Image)': '', // Laisser vide si l'étudiant n'a pas de QR Code (e-Kaly en créera un nouveau)
    },
    {
      'Matricule': '00126',
      'Parcours': 'GB',
      'Nom': 'RAZAFINDRABE',
      'Prénoms': 'Rivo Lalaina',
      'Genre': 'Masculin',
      'Situation matrimoniale': 'Célibataire',
      'Nationalité': 'Malagasy',
      'Date de naissance': '22/11/2000',
      'Lieu de naissance': 'Fianarantsoa',
      'Adresse': 'Lot IV K 12 Andrainjato',
      'Email': 'rivo.razaf@eni.mg',
      'Téléphone': '+261 33 45 678 90',
      'Lien QR Code (Drive / Image)': '',
    },
    {
      'Matricule': '00127',
      'Parcours': 'IG',
      'Nom': 'RAMIANDRISOA',
      'Prénoms': 'Mialy Faniry',
      'Genre': 'Féminin',
      'Situation matrimoniale': 'Célibataire',
      'Nationalité': 'Malagasy',
      'Date de naissance': '03/02/2002',
      'Lieu de naissance': 'Antsirabe',
      'Adresse': 'Cité ENI Bloc 3',
      'Email': 'mialy.ram@eni.mg',
      'Téléphone': '+261 34 56 789 01',
      'Lien QR Code (Drive / Image)': '',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Etudiants_M1_ENI');
  XLSX.writeFile(wb, 'modele_etudiants_voyage_etudes.xlsx');
}

export function exportImportErrorsToExcel(
  errors: Array<{ rowNumber: number; matricule?: string; message: string }>
) {
  const data = errors.map((e) => ({
    'N° Ligne Fichier': e.rowNumber,
    'Matricule concerné': e.matricule || 'N/A',
    'Erreur détectée': e.message,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Erreurs_Importation');
  XLSX.writeFile(wb, `erreurs_import_e-kaly_${Date.now()}.xlsx`);
}

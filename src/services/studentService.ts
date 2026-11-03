import QRCode from 'qrcode';
import jsQR from 'jsqr';
import JSZip from 'jszip';
import { ekalyApi } from './apiClient';
import { Student } from '../types';
import { getDriveImageDirectUrl } from './excelService';

export function subscribeToStudents(
  onUpdate: (students: Student[]) => void,
  onError: (err: any) => void
) {
  let lastSignature = '';

  const fetchStudents = async () => {
    try {
      const rows = await ekalyApi.students.list();
      const list: Student[] = rows.map((data: any) => ({
        id: data.id,
        matricule: data.matricule || data.id,
        sessionId: data.session_id || data.sessionId || '',
        sessionNom: data.session_nom || data.sessionNom || '',
        nom: data.last_name || data.nom || '',
        prenoms: data.first_name || data.prenoms || '',
        genre: data.genre || '',
        niveau: 'M1', // Master 1 ENI
        parcours: data.faculty || data.parcours || 'GB',
        situationMatrimoniale: data.situationMatrimoniale || '',
        nationalite: data.nationalite || 'Malagasy',
        dateNaissance: data.dateNaissance || '',
        lieuNaissance: data.lieuNaissance || '',
        adresse: data.adresse || '',
        email: data.email || '',
        telephone: data.telephone || '',
        photoUrl: data.photo_url || data.photoUrl || '',
        qrCodeToken: data.qr_code || data.qrCodeToken || `EKALY-${data.matricule || data.id}`,
        qrCodeUrl: data.qrCodeUrl || '',
        hasCustomQrCode: data.hasCustomQrCode !== undefined ? Boolean(data.hasCustomQrCode) : Boolean(data.qrCodeUrl),
        active: data.is_eligible !== false && data.active !== false,
        extraFields: data.extraFields || {},
        createdAt: data.created_at || data.createdAt,
        updatedAt: data.updated_at || data.updatedAt,
      }));

      // Sort alphabetically by nom, prenoms
      list.sort((a, b) => a.nom.localeCompare(b.nom));

      const sig = `${list.length}:` + list.map((s) => `${s.id}:${s.active}:${s.sessionId}:${s.updatedAt || ''}`).join('|');
      if (sig !== lastSignature) {
        lastSignature = sig;
        onUpdate(list);
      }
    } catch (error) {
      console.error('[PostgreSQL] Erreur chargement étudiants:', error);
      onError(error);
    }
  };

  fetchStudents();
  const intervalId = window.setInterval(fetchStudents, 10000);
  return () => window.clearInterval(intervalId);
}

export async function upsertStudent(student: Student): Promise<void> {
  const rawMat = (student.matricule || '').trim();
  const safeId = rawMat || student.id || '';

  await ekalyApi.students.create({
    id: safeId,
    sessionId: student.sessionId,
    sessionNom: student.sessionNom,
    matricule: safeId,
    firstName: student.prenoms,
    lastName: student.nom,
    qrCode: student.qrCodeToken || `EKALY-${safeId}`,
    faculty: student.parcours || 'GB',
    isEligible: student.active !== false,
    photoUrl: student.photoUrl,
  });
}

export async function deleteStudent(studentId: string): Promise<void> {
  await ekalyApi.students.delete(studentId);
}

export interface BatchImportResult {
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
}

/**
 * Loads a QR Code image from a URL (Google Drive or any web image) and decodes its payload text using jsQR.
 */
export async function decodeQrCodeFromImageUrl(imageUrl: string): Promise<string | null> {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  try {
    const directUrl = getDriveImageDirectUrl(trimmed);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';

    // Un lien Google Drive qui ne répond jamais ne doit pas bloquer tout l'import.
    const QR_IMAGE_TIMEOUT_MS = 10000;
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        img.src = '';
        reject(new Error('Délai de chargement de l\'image QR dépassé'));
      }, QR_IMAGE_TIMEOUT_MS);

      img.onload = () => {
        clearTimeout(timeoutId);
        resolve();
      };
      img.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error('Erreur chargement image'));
      };
      img.src = directUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width || 400;
    canvas.height = img.naturalHeight || img.height || 400;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, canvas.width, canvas.height);
    if (code && code.data && code.data.trim()) {
      return code.data.trim();
    }
  } catch (err) {
    console.warn('[QR Decode] Impossible de décoder le QR code depuis:', imageUrl, err);
  }
  return null;
}

/**
 * Automatically inspects students whose qrCodeToken is still a Drive URL (http...)
 * and decodes their actual QR code image to update Firestore with the true scanned payload.
 */
export async function repairAndSyncAllDriveQrTokens(
  students: Student[],
  onProgress?: (repaired: number, total: number) => void
): Promise<{ repaired: number; alreadyOk: number; failed: number }> {
  let repaired = 0;
  let alreadyOk = 0;
  let failed = 0;

  const toCheck = students.filter(
    (s) => s.qrCodeUrl && (s.qrCodeToken.startsWith('http://') || s.qrCodeToken.startsWith('https://'))
  );

  for (let i = 0; i < toCheck.length; i++) {
    const student = toCheck[i];
    try {
      const decoded = await decodeQrCodeFromImageUrl(student.qrCodeUrl!);
      if (decoded && decoded !== student.qrCodeToken) {
        await upsertStudent({
          ...student,
          qrCodeToken: decoded,
        });
        repaired++;
      } else {
        alreadyOk++;
      }
    } catch (err) {
      console.warn(`[Repair] Échec décodage pour ${student.matricule}:`, err);
      failed++;
    }

    if (onProgress) {
      onProgress(i + 1, toCheck.length);
    }
  }

  return { repaired, alreadyOk, failed };
}

/**
 * Construit l'identifiant de document Firestore d'un étudiant à partir de son matricule.
 *
 * Les matricules réels peuvent contenir des espaces et des caractères spéciaux
 * (ex: "1595 H-F", "1595/H-F", "MPT1|..." ). Firestore accepte la plupart des
 * caractères dans un ID de document, SAUF le slash "/" (et les IDs "." et "..").
 * On conserve donc le matricule brut comme ID quand c'est possible (compatibilité
 * avec les documents existants) et on l'encode uniquement pour les cas interdits.
 */
export function getStudentDocId(matricule: string): string {
  const mat = (matricule || '').trim();
  if (!mat) return '';
  if (mat === '.' || mat === '..' || mat.includes('/')) {
    return `enc_${encodeURIComponent(mat)}`;
  }
  return mat;
}

/**
 * Indique si une chaîne peut être utilisée telle quelle comme ID de document Firestore.
 * Aligné sur les contraintes réelles de Firestore (pas de "/", pas "." ni "..", max ~1500 octets).
 */
export function isValidStudentDocId(id: string): boolean {
  if (!id) return false;
  if (id === '.' || id === '..') return false;
  if (id.includes('/')) return false;
  return new TextEncoder().encode(id).length <= 1400;
}

export async function batchImportStudents(
  incomingStudents: Partial<Student>[],
  existingStudentsMap: Map<string, Student>,
  targetSession: { id: string; nom: string },
  onProgress?: (progressPercent: number) => void
): Promise<BatchImportResult> {
  const result: BatchImportResult = {
    inserted: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  const total = incomingStudents.length;
  if (total === 0) {
    if (onProgress) onProgress(100);
    return result;
  }

  const CHUNK_SIZE = 25;
  const chunks: Partial<Student>[][] = [];
  for (let i = 0; i < total; i += CHUNK_SIZE) {
    chunks.push(incomingStudents.slice(i, i + CHUNK_SIZE));
  }

  let processedCount = 0;
  // Keep 100% for the very end so the bar never claims completion too early.
  const reportProgress = () => {
    if (onProgress) {
      onProgress(Math.min(99, Math.round((processedCount / total) * 100)));
    }
  };

  interface PendingWrite {
    matricule: string;
    data: Student;
    existed: boolean;
  }

  const countSuccess = (existed: boolean) => {
    if (existed) {
      result.updated++;
    } else {
      result.inserted++;
    }
  };

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    const pending: PendingWrite[] = [];

    for (const item of chunk) {
      processedCount++;

      const rawMat = item.matricule !== undefined && item.matricule !== null
        ? String(item.matricule).trim()
        : '';

      if (!rawMat) {
        result.failed++;
        result.errors.push('Ligne sans matricule ignorée.');
        reportProgress();
        continue;
      }

      const mat = rawMat;
      const existing = existingStudentsMap.get(mat);

      try {
        const rawCustomUrl = item.qrCodeUrl || existing?.qrCodeUrl || '';
        const hasCustomQrCode = item.hasCustomQrCode !== undefined
          ? item.hasCustomQrCode
          : (existing?.hasCustomQrCode ?? Boolean(rawCustomUrl));

        // Décoder l'image QR Drive si disponible afin de stocker le VRAI code scanné (ex: MPT1|JPT64NCN|...)
        let qrCodeToken = item.qrCodeToken || existing?.qrCodeToken || '';
        if (rawCustomUrl && (!qrCodeToken || qrCodeToken.startsWith('http') || qrCodeToken.startsWith('EKALY-'))) {
          const decoded = await decodeQrCodeFromImageUrl(rawCustomUrl);
          if (decoded) {
            qrCodeToken = decoded;
          }
        }

        // Règle métier : Ne générer un nouveau token standard que si aucun QR n'existe
        if (!qrCodeToken) {
          qrCodeToken = `EKALY-${mat}`;
        }
        const now = new Date().toISOString();

        const mergedData: Student = {
          id: mat,
          matricule: mat,
          sessionId: targetSession.id,
          sessionNom: targetSession.nom,
          nom: item.nom || existing?.nom || '',
          prenoms: item.prenoms || existing?.prenoms || '',
          genre: item.genre || existing?.genre || '',
          niveau: 'M1', // Master 1 ENI
          parcours: item.parcours || existing?.parcours || '',
          situationMatrimoniale: item.situationMatrimoniale || existing?.situationMatrimoniale || '',
          nationalite: item.nationalite || existing?.nationalite || '',
          dateNaissance: item.dateNaissance || existing?.dateNaissance || '',
          lieuNaissance: item.lieuNaissance || existing?.lieuNaissance || '',
          adresse: item.adresse || existing?.adresse || '',
          email: item.email || existing?.email || '',
          telephone: item.telephone || existing?.telephone || '',
          photoUrl: item.photoUrl || existing?.photoUrl || '',
          qrCodeToken,
          qrCodeUrl: rawCustomUrl || '',
          hasCustomQrCode,
          active: item.active !== undefined ? item.active : (existing?.active ?? true),
          extraFields: { ...(existing?.extraFields || {}), ...(item.extraFields || {}) },
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };

        pending.push({ matricule: mat, data: mergedData, existed: Boolean(existing) });
      } catch (error) {
        result.failed++;
        result.errors.push(`${mat} : ${error instanceof Error ? error.message : String(error)}`);
        console.warn(`[BatchImport] Préparation impossible pour ${mat}:`, error);
      }

      reportProgress();
    }

    if (pending.length === 0) continue;

    try {
      const studentsToImport = pending.map((p) => ({
        id: p.data.id,
        sessionId: p.data.sessionId,
        sessionNom: p.data.sessionNom,
        matricule: p.data.matricule,
        firstName: p.data.prenoms,
        lastName: p.data.nom,
        qrCode: p.data.qrCodeToken,
        faculty: p.data.parcours || 'GB',
        isEligible: p.data.active !== false,
        photoUrl: p.data.photoUrl,
      }));

      await ekalyApi.students.batchImport(studentsToImport, targetSession.id, targetSession.nom);
      pending.forEach((entry) => countSuccess(entry.existed));
    } catch (error) {
      console.error('[PostgreSQL] Batch commit fallback:', error);
      for (const entry of pending) {
        try {
          await upsertStudent(entry.data);
          countSuccess(entry.existed);
        } catch (writeError) {
          result.failed++;
          result.errors.push(
            `${entry.matricule} : ${writeError instanceof Error ? writeError.message : String(writeError)}`
          );
        }
      }
    }
  }

  if (onProgress) onProgress(100);
  return result;
}

export async function generateQrCodeDataUrl(text: string): Promise<string> {
  return await QRCode.toDataURL(text, {
    width: 256,
    margin: 1,
    color: {
      dark: '#14532d',
      light: '#ffffff',
    },
  });
}

/**
 * Loads the exact QR Code image from Google Drive if the student has one.
 * ONLY generates a new synthetic QR code if the student does NOT possess a QR code image/link.
 */
export async function loadStudentBadgeQrImage(
  student: Student
): Promise<{ img: HTMLImageElement; isCustom: boolean }> {
  // Check if student has a Drive QR code URL or custom image URL
  const candidateUrl = (student.qrCodeUrl || '').trim() || (
    student.qrCodeToken && (
      student.qrCodeToken.startsWith('http://') ||
      student.qrCodeToken.startsWith('https://') ||
      student.qrCodeToken.startsWith('data:image/') ||
      student.qrCodeToken.includes('drive.google.com')
    ) ? student.qrCodeToken.trim() : ''
  );

  if (candidateUrl) {
    const directUrl = getDriveImageDirectUrl(candidateUrl);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(new Error(`Impossible de charger l'image QR Drive: ${e}`));
        img.src = directUrl;
      });

      // Si le qrCodeToken de l'étudiant est encore une URL HTTP brute, décoder l'image et synchroniser Firestore
      if (!student.qrCodeToken || student.qrCodeToken.startsWith('http')) {
        try {
          const offCanvas = document.createElement('canvas');
          offCanvas.width = img.naturalWidth || img.width || 400;
          offCanvas.height = img.naturalHeight || img.height || 400;
          const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
          if (offCtx) {
            offCtx.drawImage(img, 0, 0, offCanvas.width, offCanvas.height);
            const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
            const decoded = jsQR(imgData.data, offCanvas.width, offCanvas.height);
            if (decoded && decoded.data && decoded.data.trim()) {
              const realToken = decoded.data.trim();
              student.qrCodeToken = realToken;
              upsertStudent({
                ...student,
                qrCodeToken: realToken,
              }).catch(console.error);
            }
          }
        } catch (decodeErr) {
          console.warn('[Badge QR Decode] Could not decode QR on the fly:', decodeErr);
        }
      }

      return { img, isCustom: true };
    } catch (err) {
      console.warn(
        `[Badge] Échec de chargement de l'image QR Google Drive pour l'étudiant ${student.matricule}:`,
        err
      );
      // Fallback: If network/CORS fails, synthesize a fallback QR code so badge is still printable
    }
  }

  // Fallback / Auto-génération : UNIQUEMENT si l'étudiant n'a pas de QR Code existant
  const payload = student.qrCodeToken && !student.qrCodeToken.startsWith('http')
    ? student.qrCodeToken
    : `EKALY-${student.matricule}`;
  const generatedDataUrl = await generateQrCodeDataUrl(payload);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = generatedDataUrl;
  });

  return { img, isCustom: false };
}

/**
 * Draws an official badge tailored to Master 1 ENI study trips
 */
export async function generateStudentBadgeCanvas(student: Student): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const width = 600;
  const height = 920;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Outer border & frame
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#15803d'; // Green-700
  ctx.strokeRect(6, 6, width - 12, height - 12);

  // Top header banner
  ctx.fillStyle = '#16a34a'; // Emerald / green
  ctx.fillRect(12, 12, width - 24, 150);

  // Institution title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("ÉCOLE NATIONALE D'INFORMATIQUE", width / 2, 48);

  ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('e - K a l y', width / 2, 85);

  ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#dcfce7';
  ctx.fillText("VOYAGE D'ÉTUDES", width / 2, 118);

  ctx.font = '400 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('RESTAURATION & BADGE DE DISTRIBUTION', width / 2, 142);

  // Student Photo Placeholder or Avatar Box
  const avatarY = 185;
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect((width - 120) / 2, avatarY, 120, 120);
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 2;
  ctx.strokeRect((width - 120) / 2, avatarY, 120, 120);

  ctx.fillStyle = '#6b7280';
  ctx.font = 'bold 42px "Plus Jakarta Sans", sans-serif';
  const initials = `${(student.nom?.[0] || 'E').toUpperCase()}${(student.prenoms?.[0] || '').toUpperCase()}`;
  ctx.fillText(initials, width / 2, avatarY + 75);

  // Student Full Name
  const fullName = `${student.nom.toUpperCase()} ${student.prenoms || ''}`.trim();
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(fullName.length > 28 ? fullName.slice(0, 28) + '...' : fullName, width / 2, 345);

  // Matricule badge
  ctx.fillStyle = '#ecfdf5';
  ctx.fillRect((width - 280) / 2, 370, 280, 42);
  ctx.strokeStyle = '#86efac';
  ctx.lineWidth = 1.5;
  ctx.strokeRect((width - 280) / 2, 370, 280, 42);

  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 18px "Plus Jakarta Sans", monospace';
  ctx.fillText(`MATRICULE : ${student.matricule}`, width / 2, 397);

  // Academic Details: Master 1 ENI & Parcours
  ctx.fillStyle = '#374151';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  const trackInfo = [
    'Niveau : Master 1 ENI',
    student.parcours ? `Parcours : ${student.parcours}` : null,
  ].filter(Boolean).join('  •  ');
  ctx.fillText(trackInfo, width / 2, 445);

  if (student.sessionNom) {
    ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#059669';
    ctx.fillText(`Session : ${student.sessionNom}`, width / 2, 470);
  }

  // Divider
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 490);
  ctx.lineTo(width - 60, 490);
  ctx.stroke();

  // Charger et dessiner le QR Code exact (issu de Drive si fourni, ou auto-généré uniquement si absent)
  const { img: qrImage, isCustom } = await loadStudentBadgeQrImage(student);

  const qrSize = 240;
  const qrX = (width - qrSize) / 2;
  const qrY = 510;

  // Boîte cadre pour le QR Code
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16);
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16);

  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  // Instructions
  ctx.fillStyle = '#4b5563';
  ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Présenter ce QR Code au pointeur lors de chaque repas / ration', width / 2, 785);

  ctx.fillStyle = isCustom ? '#15803d' : '#9ca3af';
  ctx.font = isCustom ? '600 11px "Plus Jakarta Sans", sans-serif' : '400 11px "Plus Jakarta Sans", monospace';
  ctx.fillText(
    isCustom ? `QR Code officiel (Google Drive) • ${student.matricule}` : `ID Technique : ${student.qrCodeToken || student.matricule}`,
    width / 2,
    810
  );

  // Bottom footer bar
  ctx.fillStyle = '#15803d';
  ctx.fillRect(12, height - 45, width - 24, 33);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('ENI Fianarantsoa • Système e-Kaly de Restauration Étudiante', width / 2, height - 24);

  return canvas;
}

export async function downloadStudentBadge(student: Student): Promise<void> {
  const canvas = await generateStudentBadgeCanvas(student);
  const dataUrl = canvas.toDataURL('image/png');
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = `${student.matricule}.png`;
  anchor.click();
}

export async function exportAllBadgesAsZip(
  students: Student[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder('badges_e-kaly_m1_eni');

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const canvas = await generateStudentBadgeCanvas(student);
    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.split(',')[1];
    folder?.file(`${student.matricule}.png`, base64Data, { base64: true });

    if (onProgress) {
      onProgress(i + 1, students.length);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `e-kaly-badges-m1-eni-${new Date().toISOString().slice(0, 10)}.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}

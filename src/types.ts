export type UserRole = 'admin' | 'pointer';
export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: AccountStatus;
  requestedAt: string;
  updatedAt?: string;
  updatedBy?: string;
  assignedSessionId?: string | null;
  assignedSessionNom?: string | null;
  sessionId?: string | null;
}

export type SessionStatus = 'planned' | 'ongoing' | 'completed' | 'archived';

export interface Session {
  id: string;
  nom: string;
  destination: string;
  dateDebut: string; // YYYY-MM-DD
  dateFin: string;   // YYYY-MM-DD
  statut: SessionStatus;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Student {
  id: string; // Typically matricule
  matricule: string;
  sessionId: string; // Study trip session
  sessionNom?: string;
  nom: string;
  prenoms: string;
  genre?: string;
  niveau?: string; // Always 'M1' (Master 1 ENI)
  parcours?: string; // ASR, GB, IG, etc.
  situationMatrimoniale?: string;
  nationalite?: string;
  dateNaissance?: string;
  lieuNaissance?: string;
  adresse?: string;
  email?: string;
  telephone?: string;
  photoUrl?: string;
  qrCodeToken: string;
  qrCodeUrl?: string; // Exact Google Drive link or image URL from import
  hasCustomQrCode?: boolean; // True if from Drive/Excel, false if auto-generated
  active: boolean;
  extraFields?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export type DistributionStatus = 'draft' | 'planned' | 'ongoing' | 'completed' | 'cancelled';
export type DistributionType = 'Petit-déjeuner' | 'Eau' | 'Déjeuner' | 'Dîner' | 'Collation';

export interface Distribution {
  id: string;
  sessionId: string;
  sessionNom?: string;
  nom: string;
  date: string; // YYYY-MM-DD
  heureDebut: string; // HH:mm
  heureFin: string; // HH:mm
  typeDistribution: DistributionType;
  repasProduits: string[];
  quantitePrevue: number; // Always equal to the number of students in the session
  description?: string;
  statut: DistributionStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type AttendanceStatus = 'valid' | 'duplicate_attempt' | 'ineligible' | 'cancelled';

export interface Attendance {
  id: string;
  sessionId?: string;
  matricule: string;
  studentId?: string;
  studentNomComplet: string;
  distributionId: string;
  distributionNom: string;
  repasProduit: string;
  scannedAt: string;
  syncedAt: string;
  pointeurId: string;
  pointeurNom: string;
  pointeurEmail?: string;
  statut: AttendanceStatus;
  anomalie?: string;
  createdAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  performedByUid: string;
  performedByName: string;
  performedByEmail: string;
  timestamp: string;
}

export interface ColumnMapping {
  matricule: string;
  nom: string;
  prenoms: string;
  genre?: string;
  parcours?: string;
  dateNaissance?: string;
  lieuNaissance?: string;
  situationMatrimoniale?: string;
  nationalite?: string;
  adresse?: string;
  email?: string;
  telephone?: string;
  photo?: string;
  qrCode?: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  raw: Record<string, any>;
  parsedStudent?: Partial<Student>;
  status: 'new' | 'update' | 'error' | 'ignored';
  error?: string;
}

export interface ImportSummary {
  fileName: string;
  totalDetected: number;
  newCount: number;
  updateCount: number;
  errorCount: number;
  ignoredCount: number;
  errors: Array<{ rowNumber: number; matricule?: string; message: string }>;
}

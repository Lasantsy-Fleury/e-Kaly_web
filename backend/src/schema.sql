-- ============================================================================
-- e-Kaly PostgreSQL Database Schema
-- Production ready for Render.com PostgreSQL
-- ============================================================================

-- 1. Sessions de voyage d'études
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(128) PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  annee VARCHAR(50) NOT NULL,
  statut VARCHAR(50) NOT NULL DEFAULT 'active',
  date_debut VARCHAR(50),
  date_fin VARCHAR(50),
  lieu VARCHAR(255),
  description TEXT,
  total_etudiants INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Utilisateurs et comptes pointeurs / admins
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(128) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) DEFAULT '',
  role VARCHAR(50) NOT NULL DEFAULT 'pointer', -- 'admin', 'pointer'
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'approved', 'pending', 'suspended'
  assigned_session_id VARCHAR(128) REFERENCES sessions(id) ON DELETE SET NULL,
  assigned_session_nom VARCHAR(255),
  photo_url TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Étudiants (Master 1 ENI)
CREATE TABLE IF NOT EXISTS students (
  id VARCHAR(128) PRIMARY KEY,
  session_id VARCHAR(128) REFERENCES sessions(id) ON DELETE CASCADE,
  session_nom VARCHAR(255),
  matricule VARCHAR(100) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  qr_code VARCHAR(255),
  faculty VARCHAR(100), -- GB, IG, SR, etc.
  is_eligible BOOLEAN DEFAULT TRUE,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_matricule_per_session UNIQUE (session_id, matricule)
);

-- 4. Distributions de repas
CREATE TABLE IF NOT EXISTS distributions (
  id VARCHAR(128) PRIMARY KEY,
  session_id VARCHAR(128) REFERENCES sessions(id) ON DELETE CASCADE,
  session_nom VARCHAR(255),
  nom VARCHAR(255) NOT NULL,
  date VARCHAR(50) NOT NULL, -- Format YYYY-MM-DD
  heure_debut VARCHAR(20) NOT NULL, -- Format HH:mm
  heure_fin VARCHAR(20) NOT NULL, -- Format HH:mm
  type_distribution VARCHAR(100) NOT NULL, -- 'Petit-déjeuner', 'Eau', 'Déjeuner', 'Dîner'
  repas_produits JSONB DEFAULT '[]'::jsonb,
  quantite_prevue INT DEFAULT 0,
  statut VARCHAR(50) NOT NULL DEFAULT 'planned', -- 'planned', 'ongoing', 'completed', 'cancelled'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Pointages (Attendance)
CREATE TABLE IF NOT EXISTS attendance (
  id VARCHAR(255) PRIMARY KEY,
  distribution_id VARCHAR(128) NOT NULL REFERENCES distributions(id) ON DELETE CASCADE,
  matricule VARCHAR(100) NOT NULL,
  student_nom_complet VARCHAR(255),
  parcours VARCHAR(100),
  repas_produit VARCHAR(255),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  statut VARCHAR(50) NOT NULL DEFAULT 'valid', -- 'valid', 'duplicate', 'ineligible'
  pointage_method VARCHAR(50) DEFAULT 'qr_camera', -- 'qr_camera', 'manual', 'offline_sync'
  pointeur_id VARCHAR(128),
  pointeur_nom VARCHAR(255),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_distribution_matricule UNIQUE (distribution_id, matricule)
);

-- 6. Journal d'audit (Audit logs)
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(128) PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  performed_by_uid VARCHAR(128),
  details JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour optimiser les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_assigned_session ON users(assigned_session_id);
CREATE INDEX IF NOT EXISTS idx_students_session ON students(session_id);
CREATE INDEX IF NOT EXISTS idx_students_matricule ON students(matricule);
CREATE INDEX IF NOT EXISTS idx_distributions_session ON distributions(session_id);
CREATE INDEX IF NOT EXISTS idx_distributions_date ON distributions(date);
CREATE INDEX IF NOT EXISTS idx_distributions_statut ON distributions(statut);
CREATE INDEX IF NOT EXISTS idx_attendance_distribution ON attendance(distribution_id);
CREATE INDEX IF NOT EXISTS idx_attendance_matricule ON attendance(matricule);
CREATE INDEX IF NOT EXISTS idx_attendance_statut ON attendance(statut);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- ============================================================================
-- Données initiales d'amorçage (Seed)
-- ============================================================================

-- Compte Administrateur initial bootstrappé
INSERT INTO users (id, email, display_name, role, status)
VALUES ('admin_root', 'tokiniainanarivelosoa@gmail.com', 'Administrateur Principal', 'admin', 'approved')
ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  status = 'approved';

-- Session par défaut de démonstration si aucune n'existe
INSERT INTO sessions (id, nom, annee, statut, date_debut, date_fin, lieu, description, total_etudiants)
VALUES (
  'session_2026_m1',
  'Voyage d''Études M1 ENI 2026',
  '2026',
  'active',
  '2026-11-01',
  '2026-11-07',
  'Fianarantsoa - Mahajanga',
  'Voyage pédagogique et d''immersion technologique pour la promotion Master 1 ENI.',
  120
)
ON CONFLICT (id) DO NOTHING;

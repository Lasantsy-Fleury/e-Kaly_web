import { Router } from 'express';
import { query } from '../db.js';

const router = Router();
const BOOTSTRAP_ADMIN_EMAIL = 'tokiniainanarivelosoa@gmail.com';

// Helper to decode a Google JWT ID token payload safely
function decodeGoogleJwt(jwtToken) {
  try {
    const parts = jwtToken.split('.');
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payloadJson);
  } catch (e) {
    return null;
  }
}

// POST /api/auth/google
// Authentifie un utilisateur via son identité Google et synchronise avec PostgreSQL
router.post('/google', async (req, res, next) => {
  try {
    const { credential, email: directEmail, displayName: directName, photoUrl: directPhoto, uid: directUid } = req.body;

    let email = directEmail;
    let displayName = directName;
    let photoUrl = directPhoto;
    let uid = directUid;

    // If Google JWT token provided, decode payload
    if (credential) {
      const decoded = decodeGoogleJwt(credential);
      if (decoded && decoded.email) {
        email = decoded.email;
        displayName = displayName || decoded.name;
        photoUrl = photoUrl || decoded.picture;
        uid = uid || decoded.sub;
      }
    }

    if (!email) {
      return res.status(400).json({ error: 'Adresse email Google introuvable' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const resolvedId = uid || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const resolvedName = displayName || cleanEmail.split('@')[0];

    // Bootstrap Admin rule
    const isBootstrapAdmin = cleanEmail === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
    const initialRole = isBootstrapAdmin ? 'admin' : 'pointer';
    const initialStatus = isBootstrapAdmin ? 'approved' : 'pending';

    // Insert or update in PostgreSQL
    const result = await query(
      `INSERT INTO users (id, email, display_name, role, status, photo_url, requested_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET
         display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), users.display_name),
         photo_url = COALESCE(NULLIF(EXCLUDED.photo_url, ''), users.photo_url),
         role = CASE WHEN users.email = $7 THEN 'admin' ELSE users.role END,
         status = CASE WHEN users.email = $7 THEN 'approved' ELSE users.status END,
         updated_at = NOW()
       RETURNING id, email, display_name, role, status, assigned_session_id, assigned_session_nom, photo_url, created_at, updated_at`,
      [
        resolvedId,
        cleanEmail,
        resolvedName,
        initialRole,
        initialStatus,
        photoUrl || null,
        BOOTSTRAP_ADMIN_EMAIL.toLowerCase(),
      ]
    );

    const user = result.rows[0];

    // Format for frontend UserAccount structure
    const account = {
      uid: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      status: user.status,
      assignedSessionId: user.assigned_session_id,
      assignedSessionNom: user.assigned_session_nom,
      photoURL: user.photo_url,
      requestedAt: user.created_at,
    };

    // Return session token (or signed JWT if required)
    const token = `ekaly_token_${Buffer.from(`${user.id}:${user.email}:${Date.now()}`).toString('base64')}`;

    res.json({
      success: true,
      user: account,
      token,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
// Récupère le profil actuel de l'utilisateur depuis PostgreSQL
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const userId = req.query.userId || req.headers['x-user-id'];
    const email = req.query.email || req.headers['x-user-email'];

    let sql = 'SELECT * FROM users WHERE 1=0';
    const params = [];

    if (userId) {
      params.push(userId);
      sql = `SELECT * FROM users WHERE id = $${params.length}`;
    } else if (email) {
      params.push(String(email).toLowerCase().trim());
      sql = `SELECT * FROM users WHERE email = $${params.length}`;
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      // Decode user from basic bearer token
      const raw = authHeader.substring(7);
      if (raw.startsWith('ekaly_token_')) {
        const decoded = Buffer.from(raw.replace('ekaly_token_', ''), 'base64').toString('utf8');
        const [id] = decoded.split(':');
        if (id) {
          params.push(id);
          sql = `SELECT * FROM users WHERE id = $1`;
        }
      }
    }

    const result = await query(sql, params);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Session invalide ou utilisateur non trouvé' });
    }

    const user = result.rows[0];
    res.json({
      uid: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      status: user.status,
      assignedSessionId: user.assigned_session_id,
      assignedSessionNom: user.assigned_session_nom,
      photoURL: user.photo_url,
      requestedAt: user.created_at,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Déconnecté avec succès' });
});

export default router;

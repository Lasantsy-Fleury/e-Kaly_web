import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// GET all users
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, email, display_name, role, status, assigned_session_id, assigned_session_nom, photo_url, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET user by ID
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// CREATE or UPSERT user
router.post('/', async (req, res, next) => {
  try {
    const {
      id = `usr_${Date.now()}`,
      email,
      displayName = '',
      role = 'pointer',
      status = 'pending',
      assignedSessionId = null,
      assignedSessionNom = null,
      photoUrl = '',
    } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email obligatoire' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if bootstrapped admin email
    const isBootstrappedAdmin = cleanEmail === 'tokiniainanarivelosoa@gmail.com';
    const effectiveRole = isBootstrappedAdmin ? 'admin' : role;
    const effectiveStatus = isBootstrappedAdmin ? 'approved' : status;

    const result = await query(
      `INSERT INTO users (id, email, display_name, role, status, assigned_session_id, assigned_session_nom, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE SET
         display_name = COALESCE(EXCLUDED.display_name, users.display_name),
         photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
         updated_at = NOW()
       RETURNING *`,
      [
        id,
        cleanEmail,
        displayName,
        effectiveRole,
        effectiveStatus,
        assignedSessionId,
        assignedSessionNom,
        photoUrl,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// UPDATE user status (approved, pending, suspended)
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status, role } = req.body;
    if (!status && !role) {
      return res.status(400).json({ error: 'status ou role obligatoire' });
    }

    const result = await query(
      `UPDATE users
       SET status = COALESCE($1, status),
           role = COALESCE($2, role),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, role, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ASSIGN session to user
router.patch('/:id/session', async (req, res, next) => {
  try {
    const { sessionId, sessionNom } = req.body;
    const result = await query(
      `UPDATE users
       SET assigned_session_id = $1,
           assigned_session_nom = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [sessionId || null, sessionNom || null, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;

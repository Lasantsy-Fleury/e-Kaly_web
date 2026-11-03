import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// GET students (filter by sessionId if provided)
router.get('/', async (req, res, next) => {
  try {
    const { sessionId } = req.query;
    let result;
    if (sessionId) {
      result = await query(
        'SELECT * FROM students WHERE session_id = $1 ORDER BY last_name, first_name',
        [sessionId]
      );
    } else {
      result = await query('SELECT * FROM students ORDER BY last_name, first_name');
    }
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET student by ID
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM students WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Étudiant non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET student by matricule
router.get('/by-matricule/:matricule', async (req, res, next) => {
  try {
    const { sessionId } = req.query;
    let result;
    if (sessionId) {
      result = await query(
        'SELECT * FROM students WHERE matricule = $1 AND session_id = $2',
        [req.params.matricule, sessionId]
      );
    } else {
      result = await query(
        'SELECT * FROM students WHERE matricule = $1',
        [req.params.matricule]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Matricule non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// CREATE student
router.post('/', async (req, res, next) => {
  try {
    const {
      id = `stu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId,
      sessionNom = '',
      matricule,
      firstName,
      lastName,
      qrCode = matricule,
      faculty = 'GB',
      isEligible = true,
      photoUrl = '',
    } = req.body;

    if (!matricule || !firstName || !lastName || !sessionId) {
      return res.status(400).json({ error: 'sessionId, matricule, firstName et lastName sont obligatoires' });
    }

    const result = await query(
      `INSERT INTO students (id, session_id, session_nom, matricule, first_name, last_name, qr_code, faculty, is_eligible, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (session_id, matricule) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         qr_code = EXCLUDED.qr_code,
         faculty = EXCLUDED.faculty,
         is_eligible = EXCLUDED.is_eligible,
         photo_url = EXCLUDED.photo_url,
         updated_at = NOW()
       RETURNING *`,
      [id, sessionId, sessionNom, matricule.trim(), firstName.trim(), lastName.trim(), qrCode, faculty, isEligible, photoUrl]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// BATCH import students
router.post('/batch', async (req, res, next) => {
  try {
    const { students = [], sessionId, sessionNom = '' } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: "Liste d'étudiants vide" });
    }

    let inserted = 0;
    for (const s of students) {
      const id = s.id || `stu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const sId = s.sessionId || sessionId;
      const sNom = s.sessionNom || sessionNom;
      if (!s.matricule || !sId) continue;

      await query(
        `INSERT INTO students (id, session_id, session_nom, matricule, first_name, last_name, qr_code, faculty, is_eligible, photo_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (session_id, matricule) DO UPDATE SET
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           faculty = EXCLUDED.faculty,
           is_eligible = EXCLUDED.is_eligible,
           updated_at = NOW()`,
        [
          id,
          sId,
          sNom,
          s.matricule.trim(),
          s.firstName || '',
          s.lastName || '',
          s.qrCode || s.matricule.trim(),
          s.faculty || 'GB',
          s.isEligible !== false,
          s.photoUrl || '',
        ]
      );
      inserted++;
    }

    // Update total_etudiants count on session
    if (sessionId) {
      await query(
        `UPDATE sessions SET total_etudiants = (SELECT COUNT(*) FROM students WHERE session_id = $1) WHERE id = $1`,
        [sessionId]
      );
    }

    res.json({ success: true, count: inserted });
  } catch (err) {
    next(err);
  }
});

// UPDATE student
router.put('/:id', async (req, res, next) => {
  try {
    const { firstName, lastName, faculty, isEligible, photoUrl } = req.body;
    const result = await query(
      `UPDATE students
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           faculty = COALESCE($3, faculty),
           is_eligible = COALESCE($4, is_eligible),
           photo_url = COALESCE($5, photo_url),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [firstName, lastName, faculty, isEligible, photoUrl, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Étudiant non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE student
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await query('DELETE FROM students WHERE id = $1 RETURNING id, session_id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Étudiant non trouvé' });
    }

    if (result.rows[0]?.session_id) {
      await query(
        `UPDATE sessions SET total_etudiants = (SELECT COUNT(*) FROM students WHERE session_id = $1) WHERE id = $1`,
        [result.rows[0].session_id]
      );
    }

    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    next(err);
  }
});

export default router;

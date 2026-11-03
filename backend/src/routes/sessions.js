import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// GET all sessions
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM sessions ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET session by ID
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM sessions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// CREATE session
router.post('/', async (req, res, next) => {
  try {
    const {
      id = `sess_${Date.now()}`,
      nom,
      annee = new Date().getFullYear().toString(),
      statut = 'active',
      dateDebut,
      dateFin,
      lieu = '',
      description = '',
      totalEtudiants = 0,
    } = req.body;

    if (!nom) {
      return res.status(400).json({ error: 'Le nom de la session est obligatoire' });
    }

    const result = await query(
      `INSERT INTO sessions (id, nom, annee, statut, date_debut, date_fin, lieu, description, total_etudiants)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, nom, annee, statut, dateDebut, dateFin, lieu, description, totalEtudiants]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// UPDATE session
router.put('/:id', async (req, res, next) => {
  try {
    const { nom, annee, statut, dateDebut, dateFin, lieu, description, totalEtudiants } = req.body;
    const result = await query(
      `UPDATE sessions
       SET nom = COALESCE($1, nom),
           annee = COALESCE($2, annee),
           statut = COALESCE($3, statut),
           date_debut = COALESCE($4, date_debut),
           date_fin = COALESCE($5, date_fin),
           lieu = COALESCE($6, lieu),
           description = COALESCE($7, description),
           total_etudiants = COALESCE($8, total_etudiants),
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [nom, annee, statut, dateDebut, dateFin, lieu, description, totalEtudiants, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE session
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await query('DELETE FROM sessions WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    next(err);
  }
});

export default router;

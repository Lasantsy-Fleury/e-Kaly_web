import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// GET audit logs
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const result = await query(
      'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1',
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// CREATE audit log entry
router.post('/', async (req, res, next) => {
  try {
    const {
      id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      action,
      performedByUid = '',
      details = {},
    } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action obligatoire' });
    }

    const result = await query(
      `INSERT INTO audit_logs (id, action, performed_by_uid, details, timestamp)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [id, action, performedByUid, JSON.stringify(details)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;

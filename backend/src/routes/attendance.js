import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// GET attendance records
router.get('/', async (req, res, next) => {
  try {
    const { distributionId, matricule, pointeurId } = req.query;
    const conditions = [];
    const params = [];

    if (distributionId) {
      params.push(distributionId);
      conditions.push(`distribution_id = $${params.length}`);
    }
    if (matricule) {
      params.push(matricule);
      conditions.push(`matricule = $${params.length}`);
    }
    if (pointeurId) {
      params.push(pointeurId);
      conditions.push(`pointeur_id = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM attendance ${whereClause} ORDER BY timestamp DESC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET attendance summary counts grouped by distribution
router.get('/summary', async (req, res, next) => {
  try {
    const { distributionId } = req.query;
    let sql = `
      SELECT
        distribution_id,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE statut = 'valid') AS valid,
        COUNT(*) FILTER (WHERE statut = 'duplicate') AS duplicate,
        COUNT(*) FILTER (WHERE statut = 'ineligible') AS ineligible
      FROM attendance
    `;
    const params = [];
    if (distributionId) {
      sql += ' WHERE distribution_id = $1';
      params.push(distributionId);
    }
    sql += ' GROUP BY distribution_id';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// RECORD a new pointage
router.post('/', async (req, res, next) => {
  try {
    const {
      distributionId,
      matricule,
      studentNomComplet = '',
      parcours = '',
      mealType = 'Repas',
      pointageMethod = 'qr_camera',
      pointeurId = '',
      pointeurNom = '',
    } = req.body;

    if (!distributionId || !matricule) {
      return res.status(400).json({ error: 'distributionId et matricule obligatoires' });
    }

    const cleanMatricule = matricule.trim();
    const id = `att_${distributionId}_${cleanMatricule}_${mealType.replace(/\s+/g, '_')}`;

    // 1. Check if student exists and is eligible
    const stuRes = await query(
      'SELECT first_name, last_name, faculty, is_eligible FROM students WHERE matricule = $1',
      [cleanMatricule]
    );

    let resolvedName = studentNomComplet;
    let resolvedParcours = parcours;
    let statut = 'valid';

    if (stuRes.rows.length > 0) {
      const stu = stuRes.rows[0];
      resolvedName = `${stu.first_name} ${stu.last_name}`.trim();
      resolvedParcours = stu.faculty || parcours;
      if (stu.is_eligible === false) {
        statut = 'ineligible';
      }
    }

    // 2. Check if already scanned for this distribution
    const existing = await query(
      'SELECT id, timestamp, statut FROM attendance WHERE distribution_id = $1 AND matricule = $2',
      [distributionId, cleanMatricule]
    );

    if (existing.rows.length > 0 && statut !== 'ineligible') {
      return res.status(409).json({
        success: false,
        error: 'Pointage déjà enregistré pour cet étudiant sur cette distribution',
        statut: 'duplicate',
        existing: existing.rows[0],
      });
    }

    // 3. Insert pointage
    const insertRes = await query(
      `INSERT INTO attendance (id, distribution_id, matricule, student_nom_complet, parcours, repas_produit, statut, pointage_method, pointeur_id, pointeur_nom, timestamp, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       ON CONFLICT (distribution_id, matricule) DO NOTHING
       RETURNING *`,
      [
        id,
        distributionId,
        cleanMatricule,
        resolvedName,
        resolvedParcours,
        mealType,
        statut,
        pointageMethod,
        pointeurId,
        pointeurNom,
      ]
    );

    if (insertRes.rows.length === 0) {
      return res.status(409).json({
        success: false,
        statut: 'duplicate',
        error: 'Pointage concurrent déjà enregistré',
      });
    }

    res.status(201).json({
      success: true,
      statut,
      pointage: insertRes.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// BATCH SYNC offline pointages from mobile
router.post('/sync', async (req, res, next) => {
  try {
    const { pointages = [] } = req.body;
    if (!Array.isArray(pointages) || pointages.length === 0) {
      return res.json({ syncedCount: 0, failedCount: 0, conflictCount: 0, message: 'Aucun pointage à synchroniser' });
    }

    let syncedCount = 0;
    let conflictCount = 0;
    let failedCount = 0;

    for (const p of pointages) {
      try {
        const id = p.id || `att_${p.distributionId}_${p.matricule}_${(p.mealType || 'Repas').replace(/\s+/g, '_')}`;
        const insertRes = await query(
          `INSERT INTO attendance (id, distribution_id, matricule, student_nom_complet, parcours, repas_produit, timestamp, statut, pointage_method, pointeur_id, pointeur_nom, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()), $8, $9, $10, $11, NOW())
           ON CONFLICT (distribution_id, matricule) DO NOTHING
           RETURNING id`,
          [
            id,
            p.distributionId,
            p.matricule?.trim(),
            p.studentNomComplet || '',
            p.parcours || '',
            p.mealType || 'Repas',
            p.timestamp || null,
            p.statut || 'valid',
            p.pointageMethod || 'offline_sync',
            p.pointeurId || '',
            p.pointeurNom || '',
          ]
        );

        if (insertRes.rows.length > 0) {
          syncedCount++;
        } else {
          conflictCount++;
        }
      } catch (e) {
        failedCount++;
      }
    }

    res.json({
      success: true,
      syncedCount,
      conflictCount,
      failedCount,
      message: `${syncedCount} pointage(s) synchronisé(s), ${conflictCount} doublon(s) ignoré(s)`,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE pointage
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await query('DELETE FROM attendance WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pointage non trouvé' });
    }
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    next(err);
  }
});

export default router;

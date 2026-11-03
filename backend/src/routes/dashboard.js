import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// GET executive dashboard metrics
router.get('/stats', async (req, res, next) => {
  try {
    const { sessionId } = req.query;

    const sessionFilter = sessionId ? 'WHERE session_id = $1' : '';
    const sessionParams = sessionId ? [sessionId] : [];

    // 1. Total counts
    const [studentsCountRes, sessionsCountRes, distCountRes, attCountRes] = await Promise.all([
      query(`SELECT COUNT(*) AS count FROM students ${sessionFilter}`, sessionParams),
      query(`SELECT COUNT(*) AS count FROM sessions`),
      query(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE statut = 'ongoing') AS ongoing,
           COUNT(*) FILTER (WHERE statut = 'completed') AS completed,
           COUNT(*) FILTER (WHERE statut = 'planned') AS planned
         FROM distributions ${sessionFilter}`,
        sessionParams
      ),
      query(
        sessionId
          ? `SELECT
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE a.statut = 'valid') AS valid,
               COUNT(*) FILTER (WHERE a.statut = 'duplicate') AS duplicate,
               COUNT(*) FILTER (WHERE a.statut = 'ineligible') AS ineligible
             FROM attendance a
             JOIN distributions d ON a.distribution_id = d.id
             WHERE d.session_id = $1`
          : `SELECT
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE statut = 'valid') AS valid,
               COUNT(*) FILTER (WHERE statut = 'duplicate') AS duplicate,
               COUNT(*) FILTER (WHERE statut = 'ineligible') AS ineligible
             FROM attendance`,
        sessionParams
      ),
    ]);

    // 2. Attendance by Meal
    const mealRes = await query(
      sessionId
        ? `SELECT a.repas_produit, COUNT(*) as count
           FROM attendance a
           JOIN distributions d ON a.distribution_id = d.id
           WHERE d.session_id = $1 AND a.statut = 'valid'
           GROUP BY a.repas_produit`
        : `SELECT repas_produit, COUNT(*) as count
           FROM attendance
           WHERE statut = 'valid'
           GROUP BY repas_produit`,
      sessionParams
    );

    // 3. Attendance by Parcours
    const parcoursRes = await query(
      sessionId
        ? `SELECT a.parcours, COUNT(*) as count
           FROM attendance a
           JOIN distributions d ON a.distribution_id = d.id
           WHERE d.session_id = $1 AND a.statut = 'valid'
           GROUP BY a.parcours`
        : `SELECT parcours, COUNT(*) as count
           FROM attendance
           WHERE statut = 'valid'
           GROUP BY parcours`,
      sessionParams
    );

    // 4. Pointer Workload
    const pointerRes = await query(
      sessionId
        ? `SELECT a.pointeur_nom, COUNT(*) as count
           FROM attendance a
           JOIN distributions d ON a.distribution_id = d.id
           WHERE d.session_id = $1 AND a.statut = 'valid'
           GROUP BY a.pointeur_nom`
        : `SELECT pointeur_nom, COUNT(*) as count
           FROM attendance
           WHERE statut = 'valid'
           GROUP BY pointeur_nom`,
      sessionParams
    );

    res.json({
      students: Number(studentsCountRes.rows[0]?.count || 0),
      sessions: Number(sessionsCountRes.rows[0]?.count || 0),
      distributions: {
        total: Number(distCountRes.rows[0]?.total || 0),
        ongoing: Number(distCountRes.rows[0]?.ongoing || 0),
        completed: Number(distCountRes.rows[0]?.completed || 0),
        planned: Number(distCountRes.rows[0]?.planned || 0),
      },
      attendance: {
        total: Number(attCountRes.rows[0]?.total || 0),
        valid: Number(attCountRes.rows[0]?.valid || 0),
        duplicate: Number(attCountRes.rows[0]?.duplicate || 0),
        ineligible: Number(attCountRes.rows[0]?.ineligible || 0),
      },
      byMeal: mealRes.rows,
      byParcours: parcoursRes.rows,
      byPointer: pointerRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

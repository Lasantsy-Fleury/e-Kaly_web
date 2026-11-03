import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// GET all distributions (filter by sessionId if provided)
router.get('/', async (req, res, next) => {
  try {
    const { sessionId } = req.query;
    let result;
    if (sessionId) {
      result = await query(
        'SELECT * FROM distributions WHERE session_id = $1 ORDER BY date DESC, heure_debut DESC',
        [sessionId]
      );
    } else {
      result = await query(
        'SELECT * FROM distributions ORDER BY date DESC, heure_debut DESC'
      );
    }
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET distribution by ID
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM distributions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Distribution non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// CREATE distribution
router.post('/', async (req, res, next) => {
  try {
    const {
      id = `dist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId,
      sessionNom = '',
      nom,
      date,
      heureDebut = '11:30',
      heureFin = '13:30',
      typeDistribution = 'Déjeuner',
      repasProduits = ['Déjeuner'],
      quantitePrevue = 0,
      statut = 'planned',
      description = '',
    } = req.body;

    if (!nom || !date || !sessionId) {
      return res.status(400).json({ error: 'sessionId, nom et date sont obligatoires' });
    }

    const result = await query(
      `INSERT INTO distributions (id, session_id, session_nom, nom, date, heure_debut, heure_fin, type_distribution, repas_produits, quantite_prevue, statut, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        id,
        sessionId,
        sessionNom,
        nom,
        date,
        heureDebut,
        heureFin,
        typeDistribution,
        JSON.stringify(repasProduits),
        quantitePrevue,
        statut,
        description,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// CREATE standard full-day meal set (Petit-déjeuner, Eau, Déjeuner, Dîner)
router.post('/full-day', async (req, res, next) => {
  try {
    const { sessionId, sessionNom = '', date, studentCount = 120 } = req.body;
    if (!sessionId || !date) {
      return res.status(400).json({ error: 'sessionId et date sont obligatoires' });
    }

    const standardMeals = [
      {
        nom: `Petit-déjeuner — ${date}`,
        type: 'Petit-déjeuner',
        debut: '06:30',
        fin: '08:30',
        produits: ['Petit-déjeuner complet', 'Boisson chaude', 'Pain'],
      },
      {
        nom: `Ration d'eau minérale — ${date}`,
        type: 'Eau',
        debut: '09:00',
        fin: '10:30',
        produits: ["Bouteille d'eau 1.5L"],
      },
      {
        nom: `Déjeuner — ${date}`,
        type: 'Déjeuner',
        debut: '11:45',
        fin: '14:00',
        produits: ['Plat chaud déjeuner', 'Dessert'],
      },
      {
        nom: `Dîner — ${date}`,
        type: 'Dîner',
        debut: '19:00',
        fin: '21:30',
        produits: ['Repas du soir', 'Collation'],
      },
    ];

    const created = [];
    for (const m of standardMeals) {
      const id = `dist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const resDist = await query(
        `INSERT INTO distributions (id, session_id, session_nom, nom, date, heure_debut, heure_fin, type_distribution, repas_produits, quantite_prevue, statut, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          id,
          sessionId,
          sessionNom,
          m.nom,
          date,
          m.debut,
          m.fin,
          m.type,
          JSON.stringify(m.produits),
          studentCount,
          'planned',
          `Distribution ${m.type} planifiée pour la journée du ${date}`,
        ]
      );
      created.push(resDist.rows[0]);
    }

    res.status(201).json({ success: true, distributions: created });
  } catch (err) {
    next(err);
  }
});

// UPDATE distribution status (ongoing, completed, cancelled, planned)
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { statut } = req.body;
    if (!statut) {
      return res.status(400).json({ error: 'statut obligatoire' });
    }

    const result = await query(
      `UPDATE distributions
       SET statut = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [statut, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Distribution non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// UPDATE distribution
router.put('/:id', async (req, res, next) => {
  try {
    const {
      nom,
      date,
      heureDebut,
      heureFin,
      typeDistribution,
      repasProduits,
      quantitePrevue,
      statut,
      description,
    } = req.body;

    const result = await query(
      `UPDATE distributions
       SET nom = COALESCE($1, nom),
           date = COALESCE($2, date),
           heure_debut = COALESCE($3, heure_debut),
           heure_fin = COALESCE($4, heure_fin),
           type_distribution = COALESCE($5, type_distribution),
           repas_produits = COALESCE($6, repas_produits),
           quantite_prevue = COALESCE($7, quantite_prevue),
           statut = COALESCE($8, statut),
           description = COALESCE($9, description),
           updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        nom,
        date,
        heureDebut,
        heureFin,
        typeDistribution,
        repasProduits ? JSON.stringify(repasProduits) : null,
        quantitePrevue,
        statut,
        description,
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Distribution non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE distribution
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await query('DELETE FROM distributions WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Distribution non trouvée' });
    }
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    next(err);
  }
});

export default router;

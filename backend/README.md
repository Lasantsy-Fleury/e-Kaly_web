# 🚀 e-Kaly — Backend API & Base de données PostgreSQL

Backend REST haute performance sous **Node.js (Express)** connecté à **PostgreSQL**, spécialement conçu pour un déploiement ultra-rapide sur **[Render.com](https://render.com)** en quelques minutes.

---

## ⚡ Déploiement sur Render en 2 minutes

### Méthode 1 : Blueprint automatique (Recommandée - 1 Clic)
1. Rendez-vous sur votre compte **[dashboard.render.com](https://dashboard.render.com/)**.
2. Cliquez sur le bouton **New +** en haut à droite, puis sélectionnez **Blueprint**.
3. Connectez votre dépôt GitHub (`e-kaly` ou `e-Kaly_web`).
4. Render détecte automatiquement le fichier [`render.yaml`](../render.yaml) :
   - Crée une base **PostgreSQL** gratuite (`ekaly-db`).
   - Crée le **Web Service** Node.js (`ekaly-backend`).
   - Lie automatiquement la variable `DATABASE_URL` avec SSL.
5. Cliquez sur **Apply**.
6. **C'est tout !** Au premier démarrage, les tables PostgreSQL, les index et les données d'amorçage sont créés automatiquement.

---

### Méthode 2 : Déploiement Manuel sur Render (Pas à pas)

1. **Créer la base PostgreSQL sur Render :**
   - Cliquez sur **New +** > **PostgreSQL**.
   - Nom : `ekaly-db`
   - Database : `ekaly`
   - User : `ekaly_user`
   - Plan : **Free**
   - Cliquez sur **Create Database**.
   - Une fois créée, copiez la valeur de **Internal Database URL** (ou *External Database URL* si hébergé ailleurs).

2. **Créer le Web Service sur Render :**
   - Cliquez sur **New +** > **Web Service**.
   - Connectez votre dépôt GitHub.
   - **Root Directory** : `backend`
   - **Environment** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Environment Variables** :
     - `DATABASE_URL` = *(collez l'URL PostgreSQL copiée à l'étape 1)*
     - `NODE_ENV` = `production`
     - `PORT` = `10000`
   - Cliquez sur **Create Web Service**.

---

## 🧪 Test & Démarrage en local

### Prérequis
- Node.js >= 18
- PostgreSQL local ou distant (ex: Render, Neon, Supabase)

### Installation & Lancement
```bash
cd backend
npm install
cp .env.example .env
# Renseignez votre DATABASE_URL dans le fichier .env
npm start
```

Le serveur écoute sur `http://localhost:10000`.

---

## 🩺 Vérification de l'état (Healthcheck)

- `GET /health` ou `GET /api/health`
```json
{
  "status": "ok",
  "service": "e-Kaly PostgreSQL Backend API",
  "database": "connected",
  "currentDb": "ekaly",
  "dbTime": "2026-11-03T10:25:00.000Z",
  "uptimeSeconds": 42,
  "timestamp": "2026-11-03T10:25:00.000Z"
}
```

---

## 📡 Endpoints de l'API REST

### 1. Sessions de voyage (`/api/sessions`)
- `GET /api/sessions` : Liste toutes les sessions de voyage d'études
- `GET /api/sessions/:id` : Détail d'une session
- `POST /api/sessions` : Créer une nouvelle session
- `PUT /api/sessions/:id` : Mettre à jour une session
- `DELETE /api/sessions/:id` : Supprimer une session

### 2. Étudiants (`/api/students`)
- `GET /api/students?sessionId=...` : Liste des étudiants (filtrable par session)
- `GET /api/students/:id` : Détail d'un étudiant
- `GET /api/students/by-matricule/:matricule` : Recherche par matricule
- `POST /api/students` : Ajouter un étudiant
- `POST /api/students/batch` : Import en masse d'étudiants (promotion entière)
- `PUT /api/students/:id` : Mettre à jour un étudiant
- `DELETE /api/students/:id` : Supprimer un étudiant

### 3. Distributions de repas (`/api/distributions`)
- `GET /api/distributions?sessionId=...` : Liste des distributions
- `GET /api/distributions/:id` : Détail d'une distribution
- `POST /api/distributions` : Créer une distribution individuelle
- `POST /api/distributions/full-day` : **Génération automatique des 4 repas de la journée** (Petit-déjeuner, Eau, Déjeuner, Dîner)
- `PATCH /api/distributions/:id/status` : Changer le statut (`ongoing`, `completed`, `cancelled`, `planned`)
- `PUT /api/distributions/:id` : Mettre à jour une distribution
- `DELETE /api/distributions/:id` : Supprimer une distribution

### 4. Pointages (`/api/attendance`)
- `GET /api/attendance?distributionId=...&matricule=...&pointeurId=...` : Liste des pointages
- `GET /api/attendance/summary?distributionId=...` : Synthèse des effectifs validés/doublons par distribution
- `POST /api/attendance` : Enregistrer un pointage en temps réel (vérifie automatiquement l'éligibilité et prévient les doublons)
- `POST /api/attendance/sync` : Synchronisation par lot des pointages hors-ligne depuis l'application mobile (idempotente)
- `DELETE /api/attendance/:id` : Annuler un pointage

### 5. Utilisateurs & Pointers (`/api/users`)
- `GET /api/users` : Liste des utilisateurs
- `GET /api/users/:id` : Détail d'un utilisateur
- `POST /api/users` : Inscrire / synchroniser un profil utilisateur
- `PATCH /api/users/:id/status` : Approuver ou suspendre un pointeur
- `PATCH /api/users/:id/session` : Assigner un pointeur à une session de voyage

### 6. Tableau de bord & Statistiques (`/api/dashboard`)
- `GET /api/dashboard/stats?sessionId=...` : Indicateurs clés (taux de distribution, répartition par repas, présence par parcours GB/IG/SR, charge de travail des pointeurs)

### 7. Journal d'Audit (`/api/audit-logs`)
- `GET /api/audit-logs` : Historique des opérations
- `POST /api/audit-logs` : Enregistrer une action administrative

---

## 🗄️ Structure de la Base de Données

```
sessions (id, nom, annee, statut, date_debut, date_fin, lieu, total_etudiants)
   ├── students (id, session_id, matricule, first_name, last_name, qr_code, faculty, is_eligible)
   └── distributions (id, session_id, nom, date, heure_debut, heure_fin, type_distribution, repas_produits, quantite_prevue, statut)
          └── attendance (id, distribution_id, matricule, student_nom_complet, parcours, repas_produit, timestamp, statut, pointeur_id)

users (id, email, display_name, role, status, assigned_session_id)
audit_logs (id, action, performed_by_uid, details, timestamp)
```

# e-Kaly — Administration des Distributions Alimentaires (Voyages d'Études M1 ENI)

Application web officielle d'administration et de supervision des distributions de repas lors des **Voyages d'Études** des étudiants en **Master 1 (M1)** de l'**École Nationale d'Informatique (ENI - Fianarantsoa, Madagascar)**. Développée avec **React 19**, **TypeScript strict**, **Vite** et **Firebase** (Cloud Firestore, Authentication, Security Rules).

Ce projet fonctionne en synergie avec l'application mobile **e-Kaly** (React Native) en partageant le même projet Firebase et un modèle de données unifié.

---

## 1. Contexte & Spécificités Métier

1. **Organisation en Sessions de Voyages d'Études** : Chaque voyage d'études constitue une session s'étendant sur plusieurs jours consécutifs (`dateDebut` à `dateFin`), avec une destination cible (ex. : Majunga, Tamatave, Nosy Be, Antsirabe).
2. **Distributions multiples par journée** : Chaque jour du voyage comporte plusieurs distributions adaptées au rythme des étudiants :
   - ☕ **Petit-déjeuner** (ex. 06h30 - 08h30)
   - 💧 **Eau minérale** / Ravitaillement (ex. 10h00 - 11h30)
   - 🍽️ **Déjeuner** (ex. 12h00 - 14h00)
   - 🍲 **Dîner** (ex. 19h00 - 21h30)
   - 🥪 **Collation** (optionnelle)
   Un bouton de **génération automatique en 1 clic** permet de créer instantanément les 4 repas d'une journée de voyage.
3. **Règle stricte d'invariance des effectifs** : Les étudiants sont importés et rattachés par session de voyage. Par conséquent, **la quantité prévue pour toute distribution est rigoureusement et automatiquement égale au nombre total d'étudiants inscrits dans la session** (`quantitePrevue = effectifSession`).
4. **Niveau académique unique (M1 ENI)** : L'application est exclusivement calibrée pour la promotion Master 1 de l'École Nationale d'Informatique. Aucun sélecteur de niveau parasite (L1, L2, L3, M2) n'est affiché. La seule différenciation académique concerne les parcours officiels de l'ENI (**ASR** : Administration des Systèmes et Réseaux, **GB** : Génie du Logiciel et Base de Données, **IG** : Informatique Générale).
5. **Ergonomie moderne & Sidebar rétractable** : Navigation intuitive via une barre latérale rétractable (mode étendu avec libellés ou mode compact avec icônes), optimisée pour les écrans d'ordinateur portable et les tablettes des encadreurs.

---

## 2. Fonctionnalités Principales

### 2.1 Gestion des Sessions de Voyages d'Études
- Création et paramétrage des sessions multi-jours (Nom du voyage, dates début/fin, destination, promotion M1).
- Suivi du statut de la session : **Planifiée**, **En cours**, **Clôturée**.
- Filtrage transversal de l'ensemble de l'application (étudiants, distributions, pointages, statistiques) par session sélectionnée.

### 2.2 Tableau de bord statistique en direct
- Calcul automatique des indicateurs réels : nombre d'étudiants de la session, distributions (planifiées, en cours, terminées), pointages valides et anomalies.
- Calcul rigoureux du **taux de participation réel** : ratio entre les bénéficiaires pointés et les étudiants de la session.
- Répartition des repas/produits distribués (Déjeuner, Petit-déjeuner, Dîner, Eau).
- Suivi de la performance et de la cadence des pointeurs sur le terrain.

### 2.3 Répertoire des Étudiants & Importation par Session
- Répertoire complet des étudiants de la session avec recherche instantanée par matricule, nom, prénom ou parcours (ASR, GB, IG).
- Préservation absolue des matricules en chaîne de caractères, y compris les zéros initiaux (ex: `00124`).
- **Assistant d'importation Excel en 6 étapes** :
  1. Sélection du fichier (`.xlsx`, `.xls`, `.csv`) avec téléchargement du modèle `modele_etudiants_voyage_etudes.xlsx`.
  2. Détection automatique des colonnes et mapping intelligent.
  3. Prévisualisation des données.
  4. Validation stricte : unicité des matricules et contrôle d'absence de doublons.
  5. Confirmation prévisionnelle des opérations par session.
  6. Écriture par lots (batches Firestore) avec barre de progression en temps réel et rattachement automatique à la session.

### 2.4 Badges et QR Codes Techniques
- Chaque étudiant dispose d'une identité technique stable et pérenne (`qrCodeToken`).
- **Badge officiel standardisé** avec mention "ÉCOLE NATIONALE D'INFORMATIQUE • VOYAGE D'ÉTUDES M1", photo/avatar, matricule en évidence, parcours et QR Code haute résolution.
- **Téléchargement individuel** au format PNG nommé strictement d'après le matricule (`<matricule>.png`).
- **Export global en archive ZIP** (`badges_voyage_etudes_m1.zip`) pour impression collective avant le départ.

### 2.5 Planification et Suivi des Distributions
- Création unitaire ou génération automatique des 4 repas journaliers (Petit-déjeuner, Eau, Déjeuner, Dîner).
- Quantité prévue verrouillée et indexée en direct sur l'effectif de la session.
- Gestion du cycle de vie : Planifiée ➔ En cours ➔ Terminée ➔ Clôturée.
- Sauvegarde immuable de l'historique des pointages.

### 2.6 Journal et Suivi des Pointages
- Consultation en direct des pointages synchronisés depuis les smartphones des pointeurs.
- Détection des anomalies : tentatives de double passage (étudiant ayant déjà reçu sa ration) et refus d'éligibilité.
- Moteur de recherche et filtres croisés par repas, date, statut et pointeur.
- **Exports certifiés** au format Excel (`.xlsx`) ou CSV (`.csv`).
- **Traçabilité des corrections administratives** avec saisie de motif obligatoire consigné dans les logs d'audit.

### 2.7 Gestion des Comptes Pointers & Sécurité Zero-Trust
- Validation des demandes d'accès envoyées depuis l'application mobile e-Kaly.
- Statuts de compte : **En attente** (`pending`), **Approuvé** (`approved`), **Refusé** (`rejected`), **Suspendu** (`suspended`).
- Règle de sécurité Firestore : un compte non approuvé ou suspendu est bloqué au niveau du moteur de données.
- **Journal d'audit immuable** (`/auditLogs`) consignant toutes les actions administratives.

---

## 3. Modèle de Données Cloud Firestore

| Collection | Description | Document ID | Principaux champs |
|---|---|---|---|
| `/sessions` | Sessions de voyages d'études multi-jours | `sess_<timestamp>_<rand>` | `nom`, `anneeUniversitaire`, `promotion`, `dateDebut`, `dateFin`, `destination`, `statut`, `nombreEtudiants`, `creeLe` |
| `/students` | Étudiants inscrits par session de voyage | `matricule` | `matricule`, `nom`, `prenoms`, `genre`, `niveau` ("M1"), `parcours` (ASR/GB/IG), `sessionId`, `sessionNom`, `qrCodeToken`, `active` |
| `/distributions` | Distributions alimentaires journalières | `dist_<timestamp>_<rand>` | `nom`, `sessionId`, `date`, `heureDebut`, `heureFin`, `typeDistribution`, `repasProduits`, `quantitePrevue` (= effectif session), `statut` |
| `/attendance` | Historique des émargements / pointages | `att_<timestamp>_<mat>_<rand>` | `matricule`, `studentNomComplet`, `sessionId`, `distributionId`, `repasProduit`, `scannedAt`, `syncedAt`, `pointeurId`, `pointeurNom`, `statut` |
| `/users` | Profils et permissions des pointeurs | `uid` (Firebase Auth) | `email`, `displayName`, `role` (`admin`/`pointer`), `status` (`pending`/`approved`/`rejected`/`suspended`) |
| `/auditLogs` | Registre d'audit immuable des actions | `log_<timestamp>_<rand>` | `action`, `details`, `performedByUid`, `performedByName`, `performedByEmail`, `timestamp` |

---

## 4. Sécurité & Règles Firestore (`firestore.rules`)

Les règles de sécurité implémentent les principes de sécurité Zero-Trust :
1. **Refus par défaut** sur l'ensemble de la base.
2. **Administrateur initial garanti** : l'adresse email certifiée de l'administrateur (`tokiniainanarivelosoa@gmail.com`) avec vérification d'email active bénéficie des droits root.
3. **Protection contre l'élévation de privilèges** : un utilisateur qui s'inscrit ne peut ni s'auto-attribuer le rôle `admin`, ni passer son statut à `approved`.
4. **Contrôle des pointeurs** : seuls les comptes au statut `approved` et rôle `pointer` peuvent lire les étudiants et soumettre des pointages.
5. **Intégrité des pointages** : un pointeur ne peut créer un pointage qu'en son propre nom (`request.resource.data.pointeurId == request.auth.uid`).
6. **Immuabilité de l'audit** : les documents de la collection `/auditLogs` ne peuvent être ni modifiés ni supprimés (`allow update, delete: if false`).

---

## 5. Installation et Démarrage Local

### Prérequis
- Node.js (version 18 ou supérieure)
- npm ou bun

### Étapes
```bash
# 1. Cloner le dépôt et entrer dans le dossier
cd e-kaly-web

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement local (sur le port 3000)
npm run dev

# 4. Vérifier la compilation TypeScript
npm run lint

# 5. Créer le build de production
npm run build
```

---

## 6. Connexion avec l'Application Mobile (React Native)

L'application mobile e-Kaly utilisée par les pointeurs sur le terrain se connecte au même backend :

1. **Configuration Firebase commune** :
   Utiliser les identifiants présents dans `firebase-applet-config.json` :
   - `projectId` : `ai-studio-applet-webapp-4b580`
   - `firestoreDatabaseId` : `ai-studio-419debd8-021f-4e67-a11b-faab66f3ac0e`
   - `apiKey`, `authDomain`, `appId`.

2. **Flux d'inscription & Validation du pointeur** :
   - Le pointeur télécharge l'application mobile et se connecte via Google Auth.
   - Son profil est créé dans `/users/{uid}` avec `role: "pointer"` et `status: "pending"`.
   - L'application mobile affiche l'écran d'attente d'approbation.
   - L'administrateur valide la demande depuis l'onglet **Comptes et pointeurs** du portail web.
   - Le pointeur accède immédiatement au scanner de badge sur son terminal.

3. **Format des QR Codes scannés** :
   - Le scanner mobile lit la chaîne encodée dans le badge (`qrCodeToken`, ex: `EKALY-00124` ou le matricule direct).
   - L'application mobile recherche l'étudiant correspondant dans la collection `/students`.
   - L'enregistrement du pointage s'effectue dans `/attendance` avec les horodatages `scannedAt` (heure locale sur le téléphone) et `syncedAt` (heure d'arrivée sur le serveur).

---

## 7. Structure des Fichiers

```
├── .env.example
├── firebase-applet-config.json     # Configuration du projet Firebase
├── firebase-blueprint.json         # Schéma intermédiaire des données
├── firestore.rules                 # Règles de sécurité déployées
├── firestore.rules.test.ts         # Tests d'intégrité et de pénétration des règles
├── index.html                      # Point d'entrée HTML avec balises SEO
├── package.json                    # Dépendances et scripts de build
├── public/
│   ├── robots.txt                  # Directives de non-indexation des pages privées
│   └── sitemap.xml                 # Sitemap des pages publiques
├── src/
│   ├── App.tsx                     # Composant racine avec gestion de l'état global
│   ├── firebase.ts                 # Initialisation Firebase & gestionnaire d'erreurs
│   ├── index.css                   # Styles globaux & Tailwind CSS
│   ├── main.tsx                    # Montage React
│   ├── types.ts                    # Interfaces TypeScript (Student, Distribution, etc.)
│   ├── components/
│   │   ├── accounts/
│   │   │   └── AccountsView.tsx    # Gestion des comptes, approbations & audit
│   │   ├── attendance/
│   │   │   └── AttendanceView.tsx  # Suivi temps réel des pointages & exports
│   │   ├── auth/
│   │   │   └── AuthScreen.tsx      # Portail d'authentification publique
│   │   ├── common/
│   │   │   ├── EmptyState.tsx      # Composant d'état vide
│   │   │   ├── ErrorState.tsx      # Composant d'état d'erreur
│   │   │   ├── LoadingState.tsx    # Indicateur de chargement
│   │   │   ├── Sidebar.tsx         # Barre latérale rétractable (Desktop & Mobile)
│   │   │   └── TopBar.tsx          # Barre d'en-tête avec titres et statut
│   │   ├── dashboard/
│   │   │   └── DashboardView.tsx   # Tableau de bord statistique
│   │   ├── sessions/
│   │   │   ├── SessionsView.tsx    # Interface complète de gestion des sessions
│   │   │   └── SessionModal.tsx    # Modal de création/édition de voyage d'études
│   │   └── students/
│   │       ├── BadgeModal.tsx      # Modal de visualisation/impression de badge
│   │       ├── ImportWizardModal.tsx # Assistant d'import Excel en 6 étapes
│   │       ├── StudentFormModal.tsx # Création et édition d'étudiant
│   │       └── StudentsView.tsx    # Répertoire des étudiants & export ZIP
│   └── services/
│       ├── accountService.ts       # Service d'approbation et d'audit
│       ├── attendanceService.ts    # Service de pointage et exports Excel/CSV
│       ├── authService.ts          # Authentification Google & profil utilisateur
│       ├── distributionService.ts  # Planification des distributions alimentaires
│       ├── excelService.ts         # Analyseur Excel, détection de colonnes et modèle
│       └── studentService.ts       # Gestion des étudiants, badges et archive ZIP
```

---

## 8. Licence

Ce projet est sous licence MIT. Développé pour la gestion des distributions lors des voyages d'études M1 de l'École Nationale d'Informatique.

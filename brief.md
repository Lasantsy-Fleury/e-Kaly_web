# e-Kaly — Brief de développement de l’application Web

## 1. Mission et résultat attendu

Développer une application web fonctionnelle, moderne et facile à utiliser pour administrer les distributions alimentaires destinées aux étudiants.

**Nom du projet :** e-Kaly  
**Frontend obligatoire :** React + TypeScript strict + Vite.  
**Backend :** Firebase.  
**Base de données :** Cloud Firestore.  
**Authentification :** Firebase Authentication.  
**Logique serveur privilégiée :** Firebase Cloud Functions lorsque nécessaire.  
**Hébergement cible :** Firebase Hosting ou une plateforme statique compatible.

Le résultat attendu est une véritable application de gestion, et non une maquette, un prototype visuel ou un tableau de bord alimenté par des données fictives.

L'application doit permettre à un administrateur de gérer les comptes des pointeurs, importer les étudiants, planifier les distributions, consulter les pointages et analyser les statistiques.

Elle doit être compatible avec l'application mobile e-Kaly développée séparément en React Native. Les deux applications doivent utiliser le même projet Firebase et un modèle de données commun.

## 2. Règles impératives de développement

### 2.1 Ne pas inventer de fonctionnalités

Respecter strictement les fonctionnalités décrites dans ce document.

Il est interdit d'ajouter de sa propre initiative :
- Des modules métier non demandés.
- Des rôles supplémentaires.
- Des abonnements, paiements, notifications marketing ou fonctionnalités sociales.
- Des graphiques décoratifs sans utilité.
- Des paramètres de configuration inutiles.
- Des écrans fictifs destinés à donner l'impression que l'application est plus complète.
- Des données de démonstration mélangées aux données réelles.
- Des fonctionnalités annoncées dans l'interface mais non implémentées.

Lorsqu'une fonctionnalité est nécessaire techniquement mais n'est pas définie, choisir la solution la plus simple compatible avec le besoin. Ne pas créer un nouveau module pour résoudre un détail d'implémentation.

Toute extension fonctionnelle doit être demandée et validée explicitement.

### 2.2 Ne pas surcoder

- Utiliser une architecture simple, lisible et modulaire.
- Préférer les composants réutilisables lorsqu'ils apportent une réelle valeur.
- Éviter les couches d'abstraction inutiles.
- Ne pas créer un système générique complexe pour une fonctionnalité simple.
- Ne pas multiplier les bibliothèques pour résoudre un même problème.
- Ne pas introduire de microservices, de backend parallèle ou de framework supplémentaire sans nécessité.
- Ne pas dupliquer les règles métier dans plusieurs composants.
- Ne pas créer de fichiers, hooks, contextes ou services inutilisés.

Utiliser TypeScript strict et corriger les erreurs de compilation et les avertissements significatifs avant livraison.

### 2.3 Ne pas simuler le fonctionnement

Chaque action visible doit avoir un comportement réel.

- Aucun bouton décoratif ou sans action.
- Aucun formulaire qui se contente d'afficher un message de succès.
- Aucun filtre qui ne filtre pas les données.
- Aucun graphique avec des valeurs codées en dur en production.
- Aucun tableau qui utilise uniquement des données statiques.
- Aucun compteur qui ne correspond pas aux enregistrements réels.
- Aucun lien qui mène vers une page inexistante.
- Aucun faux indicateur de synchronisation.

Utiliser Firebase pour les opérations réelles. En cas d'échec, afficher une erreur compréhensible et conserver les données saisies lorsque cela est possible.

## 3. Technologies et structure

Utiliser exclusivement les technologies suivantes pour le cœur du projet :

- React.
- TypeScript strict.
- Vite.
- Firebase Authentication.
- Cloud Firestore.
- Firebase Security Rules.
- Firebase Cloud Functions uniquement pour les opérations qui nécessitent des privilèges serveur ou une validation centralisée.
- Firebase Hosting, ou un hébergement équivalent compatible.

Les autres bibliothèques sont autorisées uniquement lorsqu'elles sont utiles à une fonctionnalité demandée : lecture Excel, graphiques statistiques, génération de fichiers, routage ou composants d'interface.

Ne pas utiliser Next.js, Supabase ou un second backend.

Fournir un fichier `.env.example` pour les paramètres de configuration nécessaires. Les identifiants publics de configuration Firebase ne doivent pas être confondus avec les secrets de serveur. Ne jamais intégrer de clé privée de compte de service dans le frontend.

## 4. Fonctionnalités à implémenter

### 4.1 Authentification et gestion des comptes

L'administrateur doit pouvoir consulter les demandes de création de compte et gérer l'accès des pointeurs.

Fonctionnalités obligatoires :
- Liste des demandes en attente.
- Consultation d'une demande.
- Approbation d'un compte.
- Attribution du rôle « Pointeur ».
- Refus d'une demande.
- Suspension et réactivation d'un compte.
- Consultation du statut d'un compte.

Statuts minimaux :
- En attente.
- Approuvé.
- Refusé.
- Suspendu.

L'inscription est effectuée depuis l'application mobile. Le web gère l'approbation et les autorisations.

Un utilisateur en attente, refusé ou suspendu ne doit pas pouvoir pointer. L'attribution du rôle ne doit jamais être possible depuis le client non autorisé.

Les opérations administratives doivent être contrôlées côté serveur et par les règles de sécurité Firebase, et pas uniquement par l'interface.

### 4.2 Tableau de bord

Afficher uniquement les indicateurs utiles à la gestion :

- Nombre total d'étudiants.
- Nombre d'étudiants éligibles, lorsque cette notion est définie.
- Nombre de distributions planifiées.
- Nombre de distributions en cours.
- Nombre de distributions terminées.
- Nombre de pointages valides.
- Taux de participation pour une distribution sélectionnée.
- Nombre de pointages en attente de synchronisation, si cette information est disponible de manière fiable.

Les statistiques doivent être calculées à partir des données réelles.

Permettre une sélection de période et de distribution si nécessaire. Éviter les tableaux de bord surchargés et les dizaines de cartes sans utilité.

### 4.3 Gestion et importation des étudiants

L'application doit importer les données d'étudiants à partir de fichiers Excel `.xlsx` et, si possible, CSV.

Le fichier de référence fourni est `M1 ASR.xlsx`.

Colonnes notamment présentes ou susceptibles d'être présentes :
- Matricule.
- Niveau.
- Parcours.
- Nom.
- Prénoms.
- Genre.
- Situation matrimoniale.
- Nationalité.
- Date et lieu de naissance.
- Adresse.
- Email.
- Téléphone.
- Photo.
- QR Code.

D'autres colonnes administratives peuvent exister. Le système ne doit pas échouer uniquement parce qu'une colonne supplémentaire est présente.

#### Parcours d'importation obligatoire

**Étape 1 — Sélection du fichier**

Permettre de sélectionner ou déposer un fichier Excel.

Vérifier le format du fichier et afficher une erreur explicite en cas de problème.

**Étape 2 — Analyse**

Lire les en-têtes et reconnaître automatiquement les colonnes connues.

Permettre de faire correspondre manuellement une colonne source à un champ attendu si la reconnaissance automatique échoue.

**Étape 3 — Prévisualisation**

Afficher quelques lignes et le nombre total de lignes détectées.

Ne pas importer automatiquement dès la sélection du fichier.

**Étape 4 — Validation**

Détecter :
- Les matricules absents ou invalides.
- Les doublons dans le fichier.
- Les étudiants déjà présents.
- Les colonnes obligatoires manquantes.
- Les dates et formats incorrects.

**Étape 5 — Confirmation**

Présenter clairement les opérations prévues :
- Nouveaux étudiants.
- Étudiants existants à mettre à jour.
- Lignes ignorées.
- Lignes présentant une erreur.

**Étape 6 — Résultat**

Afficher un bilan réel après l'importation et permettre d'exporter les erreurs pour correction.

#### Règles de gestion

- Le matricule est l'identifiant métier principal.
- Préserver les matricules comme chaînes de caractères, y compris les zéros initiaux.
- Ne pas transformer arbitrairement les identifiants.
- Ne pas créer de doublons.
- Ne pas écraser une donnée existante par une cellule vide sans règle explicite.
- Ne pas supprimer l'historique d'un étudiant lors d'une mise à jour.
- Préserver les champs supplémentaires lorsque cela est nécessaire au métier, sans créer un schéma différent pour chaque colonne.
- Traiter les imports volumineux par lots adaptés aux limites de Firestore.

L'importation doit gérer correctement les erreurs partielles. Une opération partiellement réussie doit produire un rapport précis, sans prétendre que toutes les lignes ont été importées.

### 4.4 Gestion des QR codes et des badges

Chaque étudiant doit disposer d'une identité technique stable et d'un QR code qui lui est associé.

Exigences :
- Reconnaître les QR codes existants lorsqu'ils sont compatibles.
- Générer ou réassocier un QR code lorsque nécessaire.
- Conserver la même identité et le même QR code lors d'une mise à jour ou d'une réimportation du même étudiant.
- Éviter de réutiliser un identifiant d'un autre étudiant.
- Ne pas encoder des informations personnelles sensibles directement dans le QR code.

Permettre :
- De consulter le QR code d'un étudiant.
- De générer un badge individuel.
- D'exporter le badge sous forme d'image nommée par matricule.
- D'exporter tous les badges dans une archive ZIP.

Un badge doit présenter au minimum le nom complet, le matricule et le QR code.

Les badges doivent pouvoir être imprimés et utilisés par l'application mobile.

### 4.5 Planification des distributions

Permettre à l'administrateur de créer, consulter, modifier, planifier, terminer et annuler une distribution.

Champs :
- Nom de la distribution.
- Date.
- Heure de début et de fin.
- Description facultative.
- Repas ou produits distribués.
- Quantités prévues, si renseignées.
- Étudiants éligibles ou critères d'éligibilité.
- Pointeurs autorisés.
- Statut.

Statuts minimaux :
- Brouillon.
- Planifiée.
- En cours.
- Terminée.
- Annulée.

Les repas et produits ne doivent pas être codés en dur. Prévoir les cas du petit-déjeuner, déjeuner, dîner, eau et autres produits.

Une journée peut comporter plusieurs distributions. Un étudiant peut être éligible à plusieurs repas de la même journée.

Les modifications et annulations doivent préserver les pointages existants. Ne pas supprimer automatiquement les historiques.

Ne pas ajouter de système de réservation, de facturation ou de gestion des stocks avancée.

### 4.6 Consultation des pointages

Afficher les pointages synchronisés depuis les appareils mobiles.

Informations minimales :
- Étudiant et matricule.
- Distribution.
- Repas ou produit.
- Date et heure du pointage sur l'appareil.
- Date et heure de réception par le serveur.
- Pointeur responsable.
- Statut de validation ou de synchronisation.
- Anomalie éventuelle.

Fonctionnalités :
- Recherche par matricule ou nom.
- Filtrage par distribution, période, repas et pointeur.
- Consultation des détails.
- Export CSV ou Excel.

Ne pas proposer la modification directe de l'historique par simple édition de cellule. Les corrections exceptionnelles doivent être contrôlées et traçables.

Les pointages en attente sur un appareil déconnecté ne peuvent pas être présentés comme des données déjà reçues par le serveur.

### 4.7 Statistiques et exports

Afficher des statistiques calculées à partir des données réelles :
- Nombre de bénéficiaires pointés par distribution.
- Nombre d'étudiants éligibles.
- Taux de participation.
- Répartition par repas ou produit.
- Évolution dans le temps.
- Nombre de pointages par pointeur.

Prévoir les filtres utiles et des exports CSV/Excel des données concernées.

Définir clairement les formules. Par exemple, le taux de participation est calculé sur les étudiants éligibles à la distribution concernée, et non sur tous les étudiants importés.

Les pointages dupliqués, rejetés ou non validés ne doivent pas gonfler les résultats.

Ne pas ajouter d'analyses prédictives, d'intelligence artificielle ou de rapports complexes non demandés.

## 5. Modèle de données Firebase

Utiliser Cloud Firestore avec une structure explicite et documentée. Exemple indicatif :

- `users` : profil, rôle et statut d'approbation.
- `students` : identité, matricule et données importées utiles.
- `distributions` : planification et statut.
- `distributionItems` : repas ou produits rattachés à une distribution, si cette séparation est nécessaire.
- `attendance` : pointages et identifiants d'opération.
- `auditLogs` : actions administratives critiques.

Ne pas créer des collections supplémentaires sans justification fonctionnelle.

Les relations entre étudiants, distributions et pointages doivent être explicites. Utiliser des identifiants stables et des références cohérentes entre les deux applications.

Prévoir des index Firestore adaptés aux requêtes réellement utilisées.

Le schéma définitif doit être documenté avant l'implémentation des écrans et partagé avec l'agent mobile.

## 6. Sécurité Firebase

- Utiliser Firebase Authentication pour les sessions.
- Définir précisément les rôles administrateur et pointeur.
- Protéger toutes les collections avec Firestore Security Rules.
- Ne jamais considérer une route masquée comme une protection.
- Ne jamais autoriser un utilisateur à modifier son propre rôle.
- Ne jamais exposer de clé privée ou de secret serveur dans le frontend.
- Utiliser Cloud Functions pour les opérations nécessitant des privilèges serveur.
- Valider les données reçues avant de les enregistrer.
- Protéger les données personnelles et limiter les champs accessibles aux pointeurs.
- Prévoir une procédure sécurisée de création du premier administrateur.

Les autorisations doivent être testées avec des comptes ayant différents rôles.

## 7. Exigences UI/UX non négociables

Le précédent processus de génération a produit une interface qui ne satisfaisait pas les exigences d'ergonomie et de fonctionnement. Cette fois, la priorité est une application réellement utilisable.

### Design attendu

- Fond blanc.
- Vert comme couleur principale.
- Gris neutres pour les textes et les surfaces secondaires.
- Rouge pour les erreurs.
- Orange pour les avertissements.
- Typographie lisible.
- Espacement cohérent.
- Interface sobre et professionnelle.

Ne pas créer un dashboard surchargé, un design futuriste inutile ou une succession de cartes sans hiérarchie.

### Navigation

Limiter la navigation aux sections métier :
1. Tableau de bord.
2. Étudiants.
3. Distributions.
4. Pointages.
5. Comptes et pointeurs.

Les sections doivent être accessibles en quelques actions et présenter un état actif clairement identifiable.

### Chaque écran doit gérer quatre états

1. Chargement.
2. Données disponibles.
3. Aucune donnée.
4. Erreur.

Les opérations d'importation doivent aussi présenter une progression et un bilan.

### Formulaires et tableaux

- Libellés toujours visibles.
- Validation des champs.
- Messages d'erreur à proximité du champ concerné.
- Boutons désactivés lorsque l'opération est impossible.
- Confirmation avant suppression ou annulation.
- Recherche réellement fonctionnelle.
- Pagination ou chargement progressif des grandes listes.
- Filtres réellement appliqués.
- Conservation des saisies lorsqu'une opération échoue.
- Retour de succès uniquement après confirmation réelle de l'opération.

Ne pas afficher de faux chargements ou de notifications de succès anticipées.

### Responsive et accessibilité

Le site doit fonctionner sur ordinateur, tablette et téléphone.

Utiliser une structure HTML sémantique, des libellés accessibles, un contraste suffisant, des états de focus visibles et une navigation clavier correcte.

Ne pas sacrifier l'ergonomie mobile pour reproduire un tableau de bord desktop.

## 8. SEO obligatoire pour l'application web

Le SEO concerne les pages publiques. Les interfaces d'administration et les données privées ne doivent pas être indexées.

### Pages et métadonnées

- Définir un titre et une description pertinents pour chaque page publique.
- Utiliser des titres HTML hiérarchisés.
- Employer des URL lisibles et stables.
- Prévoir une page 404 fonctionnelle.
- Configurer les balises canonical lorsque des pages publiques indexables existent.
- Fournir un `robots.txt` adapté.
- Générer un sitemap uniquement pour les pages publiques indexables.
- Prévoir les métadonnées Open Graph pour les partages si nécessaire.
- Éviter les titres et descriptions dupliqués.
- Ne pas exposer les données des étudiants, les pointages ou les pages d'administration aux moteurs de recherche.

### React et indexation

Une SPA React/Vite ne garantit pas à elle seule une indexation optimale.

Vérifier le rendu réel des pages publiques et leur accessibilité aux robots. Si un besoin d'indexation exige un rendu côté serveur ou une génération statique, proposer uniquement la solution minimale compatible avec le périmètre, sans remplacer arbitrairement la stack demandée.

Ne pas installer un framework supplémentaire uniquement pour ajouter une couche de complexité si aucune page publique indexable ne le justifie.

### Performance

- Limiter les dépendances et la taille des bundles.
- Optimiser les images.
- Éviter les requêtes Firestore inutiles.
- Mettre en place des chargements progressifs pertinents.
- Vérifier les performances sur des appareils modestes et des connexions lentes.

Le SEO ne doit jamais conduire à rendre les données privées publiques.

## 9. Tests obligatoires

Tester au minimum :

- Connexion et déconnexion.
- Approbation et refus d'un compte.
- Attribution du rôle Pointeur.
- Blocage d'un utilisateur suspendu.
- Importation d'un fichier Excel représentatif.
- Détection des doublons.
- Réimportation sans perte d'historique.
- Génération et export des badges.
- Création et modification d'une distribution.
- Consultation des pointages synchronisés.
- Calcul des statistiques.
- Exports CSV/Excel.
- Autorisations Firestore.
- États de chargement, d'erreur et de liste vide.
- Navigation responsive.
- Métadonnées SEO des pages publiques.

## 10. Livrables

- Code source complet.
- Projet Firebase et configuration documentée.
- Schéma Firestore.
- Firestore Security Rules.
- Cloud Functions nécessaires.
- Index Firestore requis.
- Fichier `.env.example`.
- Importateur Excel fonctionnel.
- Application web connectée aux données réelles.
- Documentation d'installation et de déploiement.
- Instructions de connexion à l'application mobile.
- Tests automatisés des fonctionnalités critiques.
- Liste des fonctionnalités réellement implémentées et des éventuelles limitations.

## 11. Conditions de livraison

La livraison n'est acceptée que si :

- L'application démarre sans erreur.
- Les fonctionnalités demandées sont réellement opérationnelles.
- Les données sont persistées dans Firebase.
- Les rôles et permissions sont appliqués côté serveur.
- L'importation Excel fonctionne sur un fichier réel.
- Les statistiques utilisent les données réelles.
- Les écrans sont utilisables et responsive.
- Les actions, boutons, filtres et formulaires fonctionnent.
- Les pages publiques respectent les exigences SEO applicables.
- Aucun module non demandé ni aucune donnée fictive ne sont ajoutés.

Avant de terminer, exécuter les tests, corriger les erreurs et fournir une liste claire des vérifications effectuées. Ne pas déclarer une fonctionnalité terminée uniquement parce que son interface a été créée.

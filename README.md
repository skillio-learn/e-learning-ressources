# Skillio LMS

Plateforme e-learning full stack pour créer des formations en **parcours étape par étape**, intégrer vos **modules interactifs HTML**, faire passer des **quiz** et évaluer les apprenants avec des **grilles d'évaluation critériées**.

**Stack** : Next.js 15 (App Router, Server Actions) · TypeScript · Prisma · PostgreSQL (**Supabase**) · Tailwind CSS.

---

## Fonctionnalités

### Multi-organismes et rôles

Skillio héberge plusieurs **organismes de formation (OF)**. Chacun a son espace (`/of`), son équipe, ses formations, ses apprenants et ses paramètres réglementaires : SIRET, NDA, Qualiopi, signataire, justificatifs exigés, délai d'inactivité.

| Rôle | Droits |
|---|---|
| **Super admin Skillio** | Gère la plateforme : organismes, tous les comptes, pages légales, journal d'audit global. |
| **Responsable OF** | Gère son OF : dossiers d'inscription, inscriptions définitives, apprenants, sessions et émargement, rapports OPCO / France Travail, qualité, équipe, paramètres. |
| **Formateur** | Crée ses formations, quiz et grilles ; corrige ; suit ses apprenants. |
| **Apprenant** | Candidate en ligne, suit ses formations, émarge, donne son avis, gère ses données (RGPD). |

### Dossier d'inscription (candidature → inscription définitive)
1. L'apprenant dépose son dossier en ligne : profil administratif (identité, adresse, situation, identifiant France Travail, employeur/SIRET/OPCO, handicap), projet et financement (CPF, OPCO, France Travail, employeur…), session souhaitée, justificatifs (10 Mo, PDF/images/Word) et consentements (RGPD, CGV, règlement intérieur).
2. **Contrôles automatiques** avant dépôt : les champs obligatoires dépendent de la situation et du financement, et les justificatifs exigés combinent la liste de la formation (ou de l'OF) et les pièces liées au financement : récapitulatif CPF, attestation France Travail, accord de prise en charge OPCO ou employeur.
3. L'OF instruit le dossier : il **valide ou refuse chaque pièce avec un motif**, demande des compléments (le dossier se rouvre pour l'apprenant), puis valide ou refuse le dossier. Messagerie avec l'apprenant et notes internes.
4. **Inscription définitive** : session, dates, heures prévues, financement, n° de prise en charge, avec contrôle de la capacité de la session.
5. Chaque étape est historisée (timeline), notifiée dans l'application et tracée dans le journal d'audit.

### Traçabilité (contrôles OPCO, France Travail, CPF, Qualiopi)
- **Journal des connexions** : connexions, déconnexions et échecs, avec date, adresse IP et navigateur. Verrouillage 15 min après 5 échecs.
- **Temps actif mesuré** : signal d'activité toutes les 30 s, uniquement quand la page est visible et que l'apprenant est actif. Au-delà du délai d'inactivité de l'OF, le chronomètre se met en pause et l'apprenant doit confirmer sa présence (« Êtes-vous toujours là ? »). Le temps est enregistré par session de connexion et par segment de leçon.
- **Chronomètre visible** sur chaque leçon et **temps minimum** paramétrable par leçon avant validation, vérifié côté navigateur et côté serveur.
- **Documents imprimables / PDF** : relevé de connexions (jour par jour, par étape, connexions, sessions, émargements), attestation d'assiduité, **certificat de réalisation** (modèle du ministère du Travail).
- **Rapports & exports CSV** filtrables par formation et par période : synthèse d'assiduité (heures réalisées/prévues, taux, progression), journal des connexions, sessions de travail, temps détaillé par leçon, journal d'audit.
- **Émargement électronique** : créneaux générés sur une période (matin/après-midi), signature manuscrite horodatée avec IP, feuille d'émargement imprimable.
- **Journal d'audit** : décisions sur les dossiers, vérification des pièces, inscriptions, notes, téléchargements de justificatifs, exports, paramètres, rôles.
- Détection du **décrochage** (aucune activité depuis 7 jours) sur le tableau de bord OF.

### Qualité et RGPD
- Questionnaire de **satisfaction** à chaud (6 critères + recommandation + commentaire), avec statistiques par critère (Qualiopi, indicateur 30).
- **Réclamations et demandes** avec suivi du traitement et réponse notifiée (Qualiopi, indicateur 31).
- Consentement à l'inscription, pages mentions légales, CGU, confidentialité et accessibilité (modifiables), **export des données personnelles** (JSON), demande de suppression de compte.

### Formations et parcours
- Formation → **Modules** → **Leçons** (ex. : Module 1 avec 13 leçons), dans l'ordre que vous voulez (boutons ↑/↓) et duplicables.
- **Parcours séquentiel** : chaque étape obligatoire terminée débloque la suivante, avec des cadenas dans le plan.
- **Création en masse** : collez une leçon par ligne (`Titre | URL du module`) pour créer tout un module d'un coup.
- Types d'étapes : ✨ module interactif · 📄 contenu Markdown · 🎬 vidéo (YouTube, Vimeo, MP4) · ❓ quiz · 📝 devoir évalué · 📎 ressource.
- Fiche formation : objectifs, prérequis, public visé, niveau, durée, catégorie, image de couverture.
- Statuts brouillon / publiée / archivée, inscription libre ou sur invitation, co-formateurs, duplication d'une formation entière.
- Aperçu « comme l'apprenant » pour le formateur.

### Modules interactifs (vos modules Vercel)
- Intégration par **URL** (iframe avec bouton plein écran) ou **import d'un fichier HTML** (servi dans un bac à sable sécurisé).
- Validation de l'étape au choix : bouton « Marquer comme terminé », automatique à l'ouverture, ou **automatique quand le module signale sa fin**.
- Pour la validation automatique, ajoutez dans votre module :
  ```html
  <script src="https://VOTRE-LMS/lms-bridge.js"></script>
  <script>
    // à la fin du module (ex. bouton « Terminer »)
    LMS.complete();        // ou LMS.complete(85) pour remonter un score
  </script>
  ```
  Sans code : `<body data-lms-complete-on="#bouton-fin">` ou `<body data-lms-complete-at-end>`.

### Quiz
- QCM à réponse unique, QCM à réponses multiples (crédit partiel), vrai/faux, réponse courte (tolère les accents et les majuscules) et **question ouverte** corrigée par le formateur.
- Score de réussite, nombre de tentatives, chronomètre, mélange des questions, affichage de la correction, quiz noté ou d'auto-évaluation.
- **Import rapide** de questions au format texte (`?`, `+`, `-`, `=`, `>`).
- Le formateur corrige les questions ouvertes, ajuste les points, commente et peut réinitialiser les tentatives d'un apprenant.

### Grilles d'évaluation
- Grilles critériées : critères, coefficients, niveaux de maîtrise (points + descripteurs), seuil de validation. Chaque grille est propre à une formation ou partagée.
- Associées aux **devoirs évalués** : l'apprenant voit la grille, remet un texte, un lien et/ou un fichier.
- Le formateur évalue en cliquant sur un niveau par critère (total calculé en direct), commente, valide ou **demande une reprise**.
- **Récupération des grilles** : impression / PDF de chaque grille remplie ou vierge, et **export CSV** (compatible Excel) de toutes les grilles remplies d'une formation.

### Suivi et résultats
- Tableaux de bord par rôle, progression, temps passé, dernière activité.
- **Carnet de notes** de chaque formation, avec export CSV : notes par évaluation, moyenne, validation et certificat.
- Export CSV des **réponses détaillées aux quiz**, question par question.
- Analyse des quiz : taux de réussite par question.
- Validation manuelle d'une étape (présentiel, oral…).
- **Certificats** délivrés automatiquement à la validation (toutes les étapes obligatoires faites, évaluations réussies et moyenne ≥ seuil), imprimables et vérifiables par leur code.

---

## Base de données : Supabase

Le projet Supabase **`skillio-lms`** (organisation *Skillio*, région Paris `eu-west-3`, id `nzhnwcodxbngsjivzkmb`) est déjà prêt :
- schéma créé (migrations Prisma `prisma/migrations`, historique enregistré dans `_prisma_migrations`) ;
- **RLS activé sur toutes les tables**, sans politique : l'API REST publique de Supabase (clé `anon`) n'a accès à rien, seule l'application y accède côté serveur via Prisma ;
- données de démonstration chargées (voir « Comptes de démonstration »).

### Connexion
1. Supabase → **Project Settings → Database** → définissez ou réinitialisez le mot de passe de la base.
2. Bouton **Connect** → **ORM → Prisma** : copiez les deux URL dans `.env`, en local et sur Vercel :
   - `DATABASE_URL` : pooler *Transaction* (port **6543**), avec `?pgbouncer=true&connection_limit=1` ;
   - `DIRECT_URL` : pooler *Session* (port **5432**).
3. `AUTH_SECRET` : une longue chaîne aléatoire (`openssl rand -base64 32`).

Les futures évolutions du schéma se déploient avec `npx prisma migrate deploy`, qui utilise `DIRECT_URL`.

---

## Démarrage

```bash
npm install
cp .env.example .env        # puis renseignez DATABASE_URL, DIRECT_URL, AUTH_SECRET
npx prisma migrate deploy   # inutile sur le projet Supabase déjà initialisé
npm run db:seed             # facultatif : données de démo (base vide uniquement)
npm run dev                 # http://localhost:3000
```

### Déploiement sur Vercel
1. Importez le dépôt GitHub dans Vercel.
2. Ajoutez `DATABASE_URL`, `DIRECT_URL` et `AUTH_SECRET` dans les variables d'environnement.
3. Déployez : le build lance `prisma generate && next build`.

### Comptes de démonstration
Mot de passe : `Skillio2026!` — **changez-le ou désactivez ces comptes avant la mise en production** (menu Administration).

| Email | Rôle |
|---|---|
| admin@skillio.fr | Super admin Skillio |
| of@skillio.fr | Responsable OF (Skillio Formation) |
| formateur@skillio.fr | Formateur |
| apprenant@skillio.fr | Apprenant inscrit à la formation de démo |
| candidat@skillio.fr | Apprenant sans inscription, pour tester le dossier de candidature |

La formation de démo « Production de contenus audiovisuels sur les réseaux sociaux » contient un Module 1 de 13 leçons : votre module interactif Vercel, des contenus, une vidéo, une ressource, un quiz de 5 questions (tous les types) et un devoir évalué avec sa grille à 4 critères.

---

## Structure

```
prisma/schema.prisma        Modèle de données (utilisateurs, formations, modules, leçons, quiz, grilles, progression…)
src/lib/                    Auth (sessions JWT), permissions, progression, correction des quiz, exports
src/app/actions/            Server Actions (auth, apprenant, formateur, admin)
src/app/learn/              Espace apprenant (plan du parcours + lecteur de leçon)
src/app/of/                 Espace OF : dossiers, apprenants, formations, sessions, rapports, qualité, audit, équipe (constructeur, quiz, apprenants, résultats, grilles, corrections)
src/app/admin/              Super admin : organismes, utilisateurs, paramètres et pages légales
src/app/applications/       Dossiers de candidature (apprenant)
src/app/documents/          Relevé de connexions, attestation d'assiduité, certificat de réalisation
src/app/api/                HTML des modules importés, fichiers remis, exports CSV
public/lms-bridge.js        Pont de suivi pour vos modules interactifs
```

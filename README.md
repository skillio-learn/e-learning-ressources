# Skillio LMS

Plateforme e-learning full stack pour créer des formations en **parcours étape par étape**, intégrer vos **modules interactifs HTML**, faire passer des **quiz** et évaluer les apprenants avec des **grilles d'évaluation critériées**.

**Stack** : Next.js 15 (App Router, Server Actions) · TypeScript · Prisma · PostgreSQL (**Supabase**) · Tailwind CSS.

---

## Fonctionnalités

### Rôles

| Rôle | Droits |
|---|---|
| **Administrateur** | Gère les utilisateurs et les rôles (création, désactivation, réinitialisation du mot de passe), les paramètres de la plateforme et **toutes** les formations. |
| **Formateur** | Crée ses formations (et celles où il est co-formateur), ses quiz et ses grilles, inscrit et suit ses apprenants, corrige et exporte les résultats. |
| **Apprenant** | Suit les formations auxquelles il est inscrit, passe les quiz, remet ses devoirs et obtient ses certificats. |

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
| admin@skillio.fr | Administrateur |
| formateur@skillio.fr | Formateur |
| apprenant@skillio.fr | Apprenant (inscrit à la formation de démo) |

La formation de démo « Production de contenus audiovisuels sur les réseaux sociaux » contient un Module 1 de 13 leçons : votre module interactif Vercel, des contenus, une vidéo, une ressource, un quiz de 5 questions (tous les types) et un devoir évalué avec sa grille à 4 critères.

---

## Structure

```
prisma/schema.prisma        Modèle de données (utilisateurs, formations, modules, leçons, quiz, grilles, progression…)
src/lib/                    Auth (sessions JWT), permissions, progression, correction des quiz, exports
src/app/actions/            Server Actions (auth, apprenant, formateur, admin)
src/app/learn/              Espace apprenant (plan du parcours + lecteur de leçon)
src/app/trainer/            Espace formateur (constructeur, quiz, apprenants, résultats, grilles, corrections)
src/app/admin/              Administration (utilisateurs, rôles, paramètres)
src/app/api/                HTML des modules importés, fichiers remis, exports CSV
public/lms-bridge.js        Pont de suivi pour vos modules interactifs
```

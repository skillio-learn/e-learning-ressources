/**
 * Données de démonstration.
 *   npm run db:seed
 * Comptes créés (mot de passe : Skillio2026!) :
 *   admin@skillio.fr (Super admin) · of@skillio.fr (Responsable OF) · formateur@skillio.fr (Formateur)
 *   apprenant@skillio.fr (Apprenant inscrit) · candidat@skillio.fr (Apprenant sans inscription : test du dossier)
 */
import { PrismaClient, type LessonType } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const PASSWORD = "Skillio2026!";
const MODULE_URL =
  "https://ressources-e-learning-skillio3.vercel.app/modules/production-de-contenus-audiovisuels-sur-les-rese-module-1-bienvenue/";

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const org = await db.organization.upsert({
    where: { slug: "skillio-formation" },
    create: {
      id: "org_skillio_default",
      slug: "skillio-formation",
      name: "Skillio Formation",
      legalName: "Skillio Formation SAS",
      siret: "12345678900012",
      nda: "11755555575",
      ndaRegion: "Île-de-France",
      qualiopiNumber: "QUALIOPI-2026-0001",
      address: "10 rue de la Formation",
      postalCode: "75010",
      city: "Paris",
      email: "contact@skillio.fr",
      phone: "01 23 45 67 89",
      managerName: "Responsable de l'organisme (démo)",
      managerTitle: "Directeur",
      requiredDocuments: ["ID", "CV", "PROOF_ADDRESS"],
    },
    update: {},
  });
  const upsertUser = (email: string, name: string, role: "ADMIN" | "OF_ADMIN" | "TRAINER" | "LEARNER") =>
    db.user.upsert({
      where: { email },
      create: { email, name, role, passwordHash: hash, organizationId: role === "ADMIN" ? null : org.id, consentAt: new Date() },
      update: {},
    });

  await upsertUser("admin@skillio.fr", "Admin Skillio", "ADMIN");
  await upsertUser("of@skillio.fr", "Sophie Responsable OF", "OF_ADMIN");
  const trainer = await upsertUser("formateur@skillio.fr", "Camille Formatrice", "TRAINER");
  const learner = await upsertUser("apprenant@skillio.fr", "Alex Apprenant", "LEARNER");
  await upsertUser("candidat@skillio.fr", "Chris Candidat", "LEARNER");

  const slug = "production-de-contenus-audiovisuels-sur-les-reseaux-sociaux";
  if (await db.course.findUnique({ where: { slug } })) {
    console.log("Formation de démonstration déjà présente.");
    return;
  }

  const course = await db.course.create({
    data: {
      slug,
      title: "Production de contenus audiovisuels sur les réseaux sociaux",
      subtitle: "Concevoir, tourner et publier des vidéos qui performent sur Instagram, TikTok et LinkedIn.",
      description:
        "Cette formation vous guide **étape par étape** dans la production de contenus vidéo pour les réseaux sociaux : de la stratégie éditoriale au montage, jusqu'à l'analyse des performances.",
      objectives:
        "- Définir une ligne éditoriale adaptée à chaque réseau\n- Écrire un script et un storyboard\n- Tourner avec un smartphone dans de bonnes conditions\n- Monter, sous-titrer et publier\n- Analyser les statistiques et optimiser",
      prerequisites: "- Disposer d'un smartphone récent\n- Aucune connaissance technique préalable",
      audience: "Community managers, chargés de communication, entrepreneurs.",
      category: "Communication digitale",
      level: "BEGINNER",
      durationHours: 14,
      status: "PUBLISHED",
      enrollmentPolicy: "APPLICATION",
      organizationId: org.id,
      modality: "FOAD",
      rncpCode: "RS5063",
      cpfEligible: true,
      price: 1490,
      sequential: true,
      passingScore: 60,
      authorId: trainer.id,
    },
  });

  // Module 1 : 13 leçons
  const m1 = await db.module.create({
    data: { courseId: course.id, title: "Bienvenue & fondamentaux", position: 0, description: "Découvrir les formats et les codes de chaque réseau." },
  });
  const lessons: { title: string; type: LessonType; embedUrl?: string; content?: string; durationMin?: number; minTimeSec?: number }[] = [
    { title: "Bienvenue dans la formation", type: "INTERACTIVE", embedUrl: MODULE_URL, durationMin: 10 },
    { title: "Pourquoi la vidéo sur les réseaux sociaux ?", type: "CONTENT", minTimeSec: 120, content: "## La vidéo, format roi\n\nPlus de **80 %** du trafic internet est constitué de vidéo…", durationMin: 8 },
    { title: "Panorama des plateformes", type: "CONTENT", content: "## Instagram, TikTok, LinkedIn, YouTube\n\n| Réseau | Format | Durée idéale |\n|---|---|---|\n| TikTok | 9:16 | 15–45 s |\n| Reels | 9:16 | 15–30 s |\n| LinkedIn | 1:1 / 4:5 | 30–90 s |", durationMin: 12 },
    { title: "Les formats verticaux", type: "CONTENT", content: "Le format **9:16** occupe tout l'écran du smartphone.", durationMin: 6 },
    { title: "Définir sa cible", type: "CONTENT", content: "Construisez votre **persona** : âge, usages, attentes, freins.", durationMin: 10 },
    { title: "La ligne éditoriale", type: "CONTENT", content: "Définissez 3 à 5 **piliers de contenu**.", durationMin: 10 },
    { title: "Vidéo : les bases du cadrage", type: "VIDEO", content: "Observez la règle des tiers dans cet exemple.", durationMin: 7 },
    { title: "L'accroche des 3 premières secondes", type: "CONTENT", content: "Une question, un chiffre choc, un mouvement : captez l'attention immédiatement.", durationMin: 8 },
    { title: "Son et lumière avec un smartphone", type: "CONTENT", content: "- Lumière naturelle face à vous\n- Micro-cravate\n- Pièce sans écho", durationMin: 10 },
    { title: "Sous-titres et accessibilité", type: "CONTENT", content: "85 % des vidéos sont regardées **sans le son**.", durationMin: 6 },
    { title: "Fiche mémo à télécharger", type: "RESOURCE", content: "Retrouvez l'essentiel du module dans cette fiche.", durationMin: 3 },
    { title: "Quiz – Les fondamentaux", type: "QUIZ", durationMin: 10 },
    { title: "Mise en situation : votre première vidéo", type: "ASSIGNMENT", content: "Réalisez une vidéo verticale de **30 secondes** présentant votre activité.\n\nRemettez le lien de la vidéo (Drive, YouTube non répertoriée…) et quelques lignes expliquant vos choix.", durationMin: 60 },
  ];
  const created: Record<string, string> = {};
  for (const [i, l] of lessons.entries()) {
    const lesson = await db.lesson.create({
      data: {
        moduleId: m1.id,
        position: i,
        title: l.title,
        type: l.type,
        embedUrl: l.embedUrl ?? null,
        content: l.content ?? null,
        durationMin: l.durationMin,
        minTimeSec: l.minTimeSec ?? null,
        videoUrl: l.type === "VIDEO" ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ" : null,
        resourceUrl: l.type === "RESOURCE" ? "https://example.com/fiche-memo.pdf" : null,
      },
    });
    created[l.type + i] = lesson.id;
  }

  // Quiz
  const quizLessonId = created["QUIZ11"];
  await db.quiz.create({
    data: {
      lessonId: quizLessonId,
      instructions: "Vérifiez vos acquis sur le module 1. Il faut **70 %** pour valider.",
      passingScore: 70,
      maxAttempts: 3,
      questions: {
        create: [
          {
            position: 0, type: "SINGLE", points: 1, text: "Quel format est le plus adapté à TikTok ?",
            explanation: "Le format vertical 9:16 occupe tout l'écran.",
            options: { create: [{ text: "16:9", isCorrect: false, position: 0 }, { text: "9:16", isCorrect: true, position: 1 }, { text: "1:1", isCorrect: false, position: 2 }] },
          },
          {
            position: 1, type: "MULTIPLE", points: 2, text: "Quels éléments améliorent la rétention ?",
            options: { create: [
              { text: "Une accroche forte dans les 3 premières secondes", isCorrect: true, position: 0 },
              { text: "Des sous-titres", isCorrect: true, position: 1 },
              { text: "Une longue introduction", isCorrect: false, position: 2 },
            ] },
          },
          {
            position: 2, type: "TRUE_FALSE", points: 1, text: "La majorité des vidéos sont regardées sans le son.",
            options: { create: [{ text: "Vrai", isCorrect: true, position: 0 }, { text: "Faux", isCorrect: false, position: 1 }] },
          },
          { position: 3, type: "SHORT", points: 1, text: "Quel ratio d'image correspond au format vertical ? (ex : 4:3)", acceptedAnswers: ["9:16", "9/16", "9 16"] },
          { position: 4, type: "OPEN", points: 3, text: "Décrivez en quelques lignes la ligne éditoriale que vous envisagez pour votre marque.", explanation: "Attendu : cible, piliers de contenu, ton, fréquence." },
        ],
      },
    },
  });

  // Grille d'évaluation + devoir
  const rubric = await db.rubric.create({
    data: {
      title: "Grille – Vidéo courte réseaux sociaux",
      description: "Évaluation de la première vidéo verticale produite par l'apprenant.",
      courseId: course.id,
      authorId: trainer.id,
      passingScore: 50,
      criteria: {
        create: [
          ["Accroche", "L'attention est captée dans les 3 premières secondes."],
          ["Cadrage & format", "Format vertical, règle des tiers, stabilité."],
          ["Son & lumière", "Voix intelligible, image lumineuse."],
          ["Message & appel à l'action", "Message clair et CTA explicite."],
        ].map(([title, description], i) => ({
          title,
          description,
          position: i,
          weight: i === 3 ? 2 : 1,
          levels: {
            create: [
              { label: "Insuffisant", points: 0, position: 0, description: "Critère non atteint." },
              { label: "À améliorer", points: 1, position: 1, description: "Partiellement atteint." },
              { label: "Satisfaisant", points: 2, position: 2, description: "Atteint." },
              { label: "Excellent", points: 3, position: 3, description: "Dépassé, maîtrise remarquable." },
            ],
          },
        })),
      },
    },
  });
  await db.lesson.update({ where: { id: created["ASSIGNMENT12"] }, data: { rubricId: rubric.id } });

  // Modules suivants (structure)
  const others = ["Stratégie & écriture", "Tournage", "Montage & publication", "Analyse & optimisation"];
  for (const [i, title] of others.entries()) {
    const m = await db.module.create({ data: { courseId: course.id, title, position: i + 1 } });
    await db.lesson.create({ data: { moduleId: m.id, position: 0, title: `Introduction – ${title}`, type: "CONTENT", content: `Contenu du module **${title}** à compléter.` } });
  }

  const now = new Date();
  const session = await db.trainingSession.create({
    data: {
      courseId: course.id,
      name: "Session d'automne",
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 2, 28),
      capacity: 20,
      location: "À distance",
    },
  });
  await db.enrollment.create({
    data: {
      userId: learner.id,
      courseId: course.id,
      sessionId: session.id,
      startDate: session.startDate,
      endDate: session.endDate,
      plannedHours: 14,
      fundingType: "CPF",
    },
  });
  console.log("✅ Données de démonstration créées. Mot de passe des comptes :", PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

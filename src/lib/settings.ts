import "server-only";
import { cache } from "react";
import { db } from "./db";

export const DEFAULT_SETTINGS = {
  platformName: "Vylia",
  tagline: "L'expertise qui accompagne.", // signature de la charte graphique
  supportEmail: "",
  certificateSignature: "L'équipe pédagogique",
  legalMentions: `## Éditeur de la plateforme

**Vylia** — plateforme de formation en ligne.
Adresse, SIRET et directeur de la publication : à compléter dans Administration → Paramètres.

## Hébergement

Application : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.
Base de données : Supabase (région Union européenne – Paris).

## Organismes de formation

Chaque formation est dispensée par l'organisme de formation mentionné sur sa fiche (raison sociale, numéro de déclaration d'activité, certification Qualiopi).`,
  cgu: `## Objet

Les présentes conditions encadrent l'utilisation de la plateforme par les apprenants, formateurs et organismes de formation.

## Compte utilisateur

L'utilisateur est responsable de la confidentialité de ses identifiants. Le compte est personnel : **la traçabilité du temps de formation (connexions, temps passé, émargements) engage l'apprenant** et peut être transmise aux financeurs (OPCO, France Travail, Caisse des dépôts).

## Engagements de l'apprenant

Suivre personnellement la formation, ne pas partager ses accès, fournir des informations et justificatifs exacts, respecter le règlement intérieur de l'organisme.

## Propriété intellectuelle

Les contenus pédagogiques restent la propriété de leurs auteurs et ne peuvent être reproduits sans autorisation.`,
  privacy: `## Responsable de traitement

L'organisme de formation auprès duquel vous candidatez ou êtes inscrit est responsable des traitements liés à votre formation. Vylia agit en qualité de sous-traitant.

## Données traitées et finalités

- Identité, coordonnées, situation professionnelle, justificatifs : instruction du dossier et contractualisation (base légale : contrat / mesures précontractuelles).
- Connexions, temps passé, progression, résultats, émargements : suivi pédagogique et **justification de la réalisation de la formation auprès des financeurs** (obligation légale, art. L.6353-1 et D.6313-3-1 du Code du travail).
- Situation de handicap (facultatif, avec votre accord) : mise en place d'aménagements.

## Durées de conservation

Dossier administratif et preuves de réalisation : 3 ans après la fin de l'année du dernier paiement (jusqu'à 10 ans en cas de fonds européens). Compte inactif : suppression 3 ans après la dernière connexion.

## Destinataires

Équipe de l'organisme de formation, financeurs (OPCO, France Travail, Caisse des dépôts, employeur) dans la limite de leurs besoins de contrôle, sous-traitants techniques (hébergement UE).

## Vos droits

Accès, rectification, effacement, limitation, portabilité et opposition : depuis « Mon profil » (export de vos données, demande de suppression) ou en contactant l'organisme. Réclamation possible auprès de la CNIL (www.cnil.fr).`,
  accessibility: `## Accessibilité et situation de handicap

Chaque organisme de formation dispose d'un **référent handicap**. Lors de votre candidature, vous pouvez signaler une situation de handicap et vos besoins d'aménagement (temps supplémentaire, supports adaptés, accessibilité numérique).

La plateforme est conçue pour être utilisable au clavier, compatible avec les lecteurs d'écran et consultable sur mobile. Pour toute difficulté, utilisez le formulaire « Aide & réclamations ».`,
};

export type Settings = typeof DEFAULT_SETTINGS;

export const getSettings = cache(async (): Promise<Settings> => {
  try {
    const rows = await db.setting.findMany();
    const s = { ...DEFAULT_SETTINGS };
    for (const r of rows) if (r.key in s) (s as Record<string, string>)[r.key] = r.value;
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
});

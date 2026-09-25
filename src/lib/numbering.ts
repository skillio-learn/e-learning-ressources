import "server-only";
import { Prisma } from "@prisma/client";

/**
 * Crée un enregistrement portant un numéro unique (dossier, ticket).
 * Deux créations simultanées peuvent calculer le même numéro : la contrainte d'unicité
 * rejette la seconde, qui recalcule alors le numéro suivant.
 */
export async function createWithUniqueNumber<T>(next: () => Promise<string>, create: (number: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await create(await next());
    } catch (e) {
      const conflict =
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        JSON.stringify(e.meta?.target ?? "").includes("number");
      if (!conflict || attempt >= 5) throw e;
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 80));
    }
  }
}

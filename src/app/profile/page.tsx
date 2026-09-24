import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { changePasswordAction, updateProfileAction } from "@/app/actions/admin";
import { StateForm } from "@/components/StateForm";
import { Container, Field, PageHeader } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/utils";

export const metadata = { title: "Mon profil" };

export default async function Profile() {
  const user = await requireUser();
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  return (
    <Container className="max-w-3xl">
      <PageHeader title="Mon profil" subtitle={`${u.email} · ${ROLE_LABELS[u.role]}`} />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-4">Informations</h2>
          <StateForm action={updateProfileAction}>
            <Field label="Nom complet"><input name="name" defaultValue={u.name} className="input" /></Field>
            <Field label="Présentation"><textarea name="bio" rows={4} defaultValue={u.bio ?? ""} className="input" /></Field>
          </StateForm>
        </div>
        <div className="card p-6">
          <h2 className="mb-4">Mot de passe</h2>
          <StateForm action={changePasswordAction} submitLabel="Modifier le mot de passe">
            <Field label="Mot de passe actuel"><input name="current" type="password" required className="input" autoComplete="current-password" /></Field>
            <Field label="Nouveau mot de passe"><input name="next" type="password" required minLength={8} className="input" autoComplete="new-password" /></Field>
          </StateForm>
        </div>
      </div>
    </Container>
  );
}

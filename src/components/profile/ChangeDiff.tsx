import { PROFILE_FIELD_LABELS } from "@/lib/labels";
import { displayProfileValue } from "@/lib/profile";

/** Tableau « avant → après » d'une demande de modification du profil. */
export function ChangeDiff({ changes }: { changes: unknown }) {
  const entries = Object.entries((changes ?? {}) as Record<string, { from: unknown; to: unknown }>);
  return (
    <table className="table text-sm">
      <thead><tr><th>Information</th><th>Actuellement</th><th>Demandé</th></tr></thead>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k}>
            <td className="font-medium">{PROFILE_FIELD_LABELS[k] ?? k}</td>
            <td className="text-slate-500 line-through decoration-slate-300">{displayProfileValue(k, v.from)}</td>
            <td className="font-medium text-slate-900">{displayProfileValue(k, v.to)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

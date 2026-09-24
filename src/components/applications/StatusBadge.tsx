import type { ApplicationStatus } from "@prisma/client";
import { APPLICATION_STATUS } from "@/lib/labels";
import { Badge } from "@/components/ui";

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const s = APPLICATION_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

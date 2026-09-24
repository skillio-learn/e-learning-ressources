import { CircleHelp, FileText, Paperclip, PenLine, PlayCircle, Sparkles } from "lucide-react";
import { cn, LESSON_TYPE_LABELS } from "@/lib/utils";

const ICONS = { INTERACTIVE: Sparkles, CONTENT: FileText, VIDEO: PlayCircle, QUIZ: CircleHelp, ASSIGNMENT: PenLine, RESOURCE: Paperclip } as const;

export function LessonTypeIcon({ type, className }: { type: keyof typeof ICONS; className?: string }) {
  const Icon = ICONS[type];
  return (
    <span title={LESSON_TYPE_LABELS[type]} className={cn("inline-grid place-items-center text-slate-400", className)}>
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </span>
  );
}

import Link from "next/link";
import { LEVEL_LABELS } from "@/lib/utils";
import { Badge, ProgressBar } from "./ui";

export function CourseCard({
  href,
  course,
  progress,
  footer,
}: {
  href: string;
  course: {
    title: string;
    subtitle?: string | null;
    coverUrl?: string | null;
    category?: string | null;
    level: keyof typeof LEVEL_LABELS;
    durationHours?: number | null;
    _count?: { modules?: number };
  };
  progress?: number;
  footer?: React.ReactNode;
}) {
  return (
    <Link href={href} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[16/9] bg-gradient-to-br from-brand-500 to-violet-600">
        {course.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center p-4 text-center text-lg font-bold text-white/90">{course.title}</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-1.5">
          {course.category && <Badge tone="blue">{course.category}</Badge>}
          <Badge>{LEVEL_LABELS[course.level]}</Badge>
          {course.durationHours ? <Badge>{course.durationHours} h</Badge> : null}
        </div>
        <h3 className="font-semibold text-slate-900 group-hover:text-brand-700">{course.title}</h3>
        {course.subtitle && <p className="line-clamp-2 text-sm text-slate-500">{course.subtitle}</p>}
        <div className="mt-auto pt-2">
          {progress !== undefined && (
            <div className="space-y-1">
              <ProgressBar value={progress} />
              <div className="text-xs text-slate-500">{progress} % terminé</div>
            </div>
          )}
          {footer}
        </div>
      </div>
    </Link>
  );
}

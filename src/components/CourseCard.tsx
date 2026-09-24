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
    <Link href={href} className="card card-hover group flex flex-col overflow-hidden">
      <div className="relative aspect-[16/9] overflow-hidden bg-[linear-gradient(135deg,#f5f5f7,#ececf1)]">
        {course.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.coverUrl} alt="" className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]" />
        ) : (
          <>
            <div className="absolute -left-10 -top-16 h-48 w-48 rounded-full bg-[#0071e3]/20 blur-3xl transition duration-700 group-hover:translate-x-6" />
            <div className="absolute -bottom-20 right-0 h-56 w-56 rounded-full bg-[#bf5af2]/20 blur-3xl transition duration-700 group-hover:-translate-x-6" />
            <div className="bg-grid absolute inset-0 opacity-60" />
            <div className="relative grid h-full place-items-center p-6 text-center font-display text-lg font-medium leading-snug tracking-tight text-slate-900">
              {course.title}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <div className="flex flex-wrap gap-1.5">
          {course.category && <Badge tone="blue">{course.category}</Badge>}
          <Badge>{LEVEL_LABELS[course.level]}</Badge>
          {course.durationHours ? <Badge>{course.durationHours} h</Badge> : null}
        </div>
        <h3 className="font-semibold text-slate-900 transition-colors group-hover:text-brand-500">{course.title}</h3>
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

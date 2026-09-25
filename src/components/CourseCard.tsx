import Link from "next/link";
import { Award, BookOpen } from "lucide-react";
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
      {course.coverUrl ? (
        <div className="aspect-[16/9] overflow-hidden bg-brand-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={course.coverUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        // Carte de formation de la charte : bandeau Pétrole 50 avec icône au trait (Ambre 100 une fois terminée)
        <div className={progress === 100 ? "bg-ambre-100 px-5 py-5 text-brand-600" : "bg-brand-50 px-5 py-5 text-brand-600"}>
          {progress === 100 ? <Award className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" /> : <BookOpen className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <div className="flex flex-wrap gap-1.5">
          {course.category && <Badge tone="blue">{course.category}</Badge>}
          <Badge>{LEVEL_LABELS[course.level]}</Badge>
          {course.durationHours ? <Badge>{course.durationHours} h</Badge> : null}
        </div>
        <h3 className="font-title text-xl leading-7 text-slate-900 transition-colors group-hover:text-brand-600">{course.title}</h3>
        {course.subtitle && <p className="line-clamp-2 text-sm text-slate-500">{course.subtitle}</p>}
        <div className="mt-auto pt-2">
          {progress !== undefined && (
            <div className="space-y-1">
              <ProgressBar value={progress} />
              <div className="text-sm text-slate-500">{progress === 100 ? "Parcours terminé" : `${progress} % terminé`}</div>
            </div>
          )}
          {footer}
        </div>
      </div>
    </Link>
  );
}

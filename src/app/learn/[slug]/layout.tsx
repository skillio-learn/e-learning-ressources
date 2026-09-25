import Link from "next/link";
import { getLearnContext } from "@/lib/learn";
import { ProgressBar } from "@/components/ui";
import { OutlineNav } from "@/components/learn/OutlineNav";

export default async function LearnLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { course, outline, preview, manager } = await getLearnContext(slug);
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col lg:flex-row">
      <aside className="no-print border-b border-black/[0.08] lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="border-b border-black/[0.06] p-5">
          <Link href={`/learn/${course.slug}`} className="font-display text-[15px] font-semibold leading-snug tracking-tight text-slate-900 transition hover:text-brand-500">
            {course.title}
          </Link>
          <div className="mt-3 flex items-center gap-2">
            <ProgressBar value={outline.percent} />
            <span className="text-xs font-semibold text-slate-600">{outline.percent}%</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {outline.completed}/{outline.total} étapes terminées
          </div>
          {!preview && (
            <nav className="mt-4 flex flex-wrap gap-1.5 text-xs">
              <Link href={`/learn/${course.slug}/ressources`} className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-200">Ressources</Link>
              <Link href={`/learn/${course.slug}/documents`} className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-200">Mes documents</Link>
              <Link href={`/learn/${course.slug}/messages`} className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-200">Mon formateur</Link>
            </nav>
          )}
          {preview && (
            <div className="mt-3 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Mode aperçu formateur : la progression n&apos;est pas enregistrée.
            </div>
          )}
          {manager && (
            <Link href={`/of/courses/${course.id}`} className="mt-2 inline-block text-xs text-brand-600 hover:underline">
              Modifier cette formation →
            </Link>
          )}
        </div>
        <OutlineNav slug={course.slug} modules={outline.modules} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

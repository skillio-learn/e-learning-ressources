import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PROTECTED = [
  "/dashboard", "/learn", "/of", "/admin", "/profile", "/applications", "/apply", "/attendance", "/support", "/notifications",
  "/onboarding", "/enrollments", "/courses",
];

/** Transmet le chemin demandé aux composants serveur (garde « compte non validé » dans requireUser). */
function next(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) return next(req);

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard?denied=1", req.url));
  }
  if (pathname === "/of" || pathname.startsWith("/of/")) {
    if (session.role === "LEARNER") return NextResponse.redirect(new URL("/dashboard?denied=1", req.url));
    // L'administrateur Vylia n'intervient pas dans l'espace des organismes : il les accompagne via le support
    if (session.role === "ADMIN") return NextResponse.redirect(new URL("/admin", req.url));
  }
  return next(req);
}

export const config = {
  // Toutes les pages et API, hors fichiers statiques.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|opengraph-image.png|twitter-image.png|brand/|lms-bridge.js).*)"],
};
